# python/train_event_model_r3d18_v4.py
# R3D-18 v4:
# - Train: same as v3 (uniform+jitter, consistent aug, MixUp, Focal)
# - Eval: stronger TTA (more temporal shifts + flip TTA + 2 sampling styles)
# - Choose decision threshold for "three" on VAL to maximize accuracy (or F1)
# - Apply same threshold on TEST

import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image

import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
import torchvision
from torchvision.transforms import functional as F

from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report, f1_score

from dotenv import load_dotenv
from supabase import create_client


# ========= CONFIG =========
ENV_FILE = Path(".env.local")
CLIPS_ROOT = Path("python/data/clips")
MODEL_OUT = Path("python/models/event_r3d18_v4.pt")

NUM_FRAMES_PER_CLIP = 16
IMAGE_SIZE = 112
BATCH_SIZE = 8
EPOCHS = 70
SEED = 42

WARMUP_EPOCHS = 12

LR_HEAD_WARMUP = 2e-3
LR_HEAD_FINETUNE = 5e-4
LR_BACKBONE_FINETUNE = 3e-5

WEIGHT_DECAY = 1e-4
DROPOUT_P = 0.4

EARLY_STOP_PATIENCE = 12

# MixUp
MIXUP_PROB = 0.6
MIXUP_ALPHA = 0.2

# Focal loss
FOCAL_GAMMA = 2.0

# Stronger TTA
TTA_SHIFTS = [-4, -3, -2, -1, 0, 1, 2]  # 7
USE_FLIP_TTA = True

LABEL_TO_ID = {"dunk": 0, "three": 1}
ID_TO_LABEL = {v: k for k, v in LABEL_TO_ID.items()}

KINETICS_MEAN = (0.43216, 0.394666, 0.37645)
KINETICS_STD = (0.22803, 0.22145, 0.216989)
# ==========================


def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def must_get(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing env var: {name} (check {ENV_FILE})")
    return v


@dataclass
class Sample:
    frames_dir: Path
    label: int


def rank_to_str(rank: int) -> str:
    return f"{rank:02d}"


def count_labels(samples: List[Sample]):
    dunk = sum(s.label == 0 for s in samples)
    three = sum(s.label == 1 for s in samples)
    return dunk, three


def build_dataset_from_supabase() -> List[Sample]:
    repo_root = Path(__file__).resolve().parents[1]
    load_dotenv(dotenv_path=repo_root / ENV_FILE)

    url = must_get("NEXT_PUBLIC_SUPABASE_URL")
    key = must_get("SERVICE_ROLE_KEY")
    sb = create_client(url, key)

    clips = sb.table("yt_video_clips").select("id,rank,daily_video_id").execute().data or []
    dailies = sb.table("yt_daily_videos").select("id,day,clips_folder").execute().data or []
    highs = sb.table("player_highlights").select("clip_id,event").execute().data or []

    if not clips:
        raise RuntimeError("No rows in yt_video_clips")
    if not dailies:
        raise RuntimeError("No rows in yt_daily_videos")
    if not highs:
        raise RuntimeError("No rows in player_highlights")

    clip_id_to_meta = {int(c["id"]): (int(c["rank"]), int(c["daily_video_id"])) for c in clips}
    daily_id_to_folder = {int(d["id"]): (d.get("clips_folder") or str(d.get("day"))) for d in dailies}

    samples: List[Sample] = []
    skipped = 0

    for h in highs:
        event = h.get("event")
        if event not in LABEL_TO_ID:
            skipped += 1
            continue

        clip_id = int(h["clip_id"])
        meta = clip_id_to_meta.get(clip_id)
        if not meta:
            skipped += 1
            continue

        rank, daily_video_id = meta
        folder_key = daily_id_to_folder.get(daily_video_id)
        if not folder_key:
            skipped += 1
            continue

        day_folder = repo_root / CLIPS_ROOT / folder_key
        frames_dir = day_folder / f"{rank_to_str(rank)}_frames"

        if not frames_dir.exists():
            skipped += 1
            continue

        samples.append(Sample(frames_dir=frames_dir, label=LABEL_TO_ID[event]))

    print(f"Loaded samples: {len(samples)} (skipped {skipped})")
    return samples


def _list_frames(frames_dir: Path) -> List[Path]:
    return sorted(frames_dir.glob("*.jpg"))


def uniform_indices(n: int, t: int) -> np.ndarray:
    if n <= 0:
        return np.zeros((t,), dtype=np.int64)
    if n == 1:
        return np.zeros((t,), dtype=np.int64)
    return np.linspace(0, n - 1, t).round().astype(np.int64)


def center_weighted_indices(n: int, t: int) -> np.ndarray:
    """
    Slightly center-biased sampling: take uniform over central 80% of frames.
    Helps when action is mid-clip but we still want spread.
    """
    if n <= 0:
        return np.zeros((t,), dtype=np.int64)
    if n == 1:
        return np.zeros((t,), dtype=np.int64)

    lo = int(n * 0.10)
    hi = int(n * 0.90) - 1
    if hi <= lo:
        lo, hi = 0, n - 1
    return np.linspace(lo, hi, t).round().astype(np.int64)


def jitter_indices(idxs: np.ndarray, n: int, jitter: int = 2) -> np.ndarray:
    if n <= 1:
        return idxs
    out = []
    for i in idxs.tolist():
        j = i + random.randint(-jitter, jitter)
        j = max(0, min(n - 1, j))
        out.append(j)
    return np.array(out, dtype=np.int64)


def shift_indices(idxs: np.ndarray, n: int, shift: int) -> np.ndarray:
    if n <= 1:
        return idxs
    out = idxs.astype(np.int64) + int(shift)
    out = np.clip(out, 0, n - 1)
    return out.astype(np.int64)


class VideoAugmentTrain:
    def __init__(self, size: int):
        self.size = size

    def __call__(self, frames: List[Image.Image]) -> torch.Tensor:
        i, j, h, w = torchvision.transforms.RandomResizedCrop.get_params(
            frames[0], scale=(0.72, 1.0), ratio=(0.9, 1.1)
        )
        do_flip = random.random() < 0.5

        brightness = 1.0 + random.uniform(-0.10, 0.10)
        contrast = 1.0 + random.uniform(-0.10, 0.10)
        saturation = 1.0 + random.uniform(-0.10, 0.10)
        hue = random.uniform(-0.02, 0.02)

        out = []
        for img in frames:
            img = F.resized_crop(img, i, j, h, w, size=[self.size, self.size], interpolation=F.InterpolationMode.BILINEAR)
            if do_flip:
                img = F.hflip(img)
            img = F.adjust_brightness(img, brightness)
            img = F.adjust_contrast(img, contrast)
            img = F.adjust_saturation(img, saturation)
            img = F.adjust_hue(img, hue)

            x = F.to_tensor(img)
            x = F.normalize(x, KINETICS_MEAN, KINETICS_STD)
            out.append(x)

        return torch.stack(out, dim=0).permute(1, 0, 2, 3).contiguous()


class VideoAugmentEval:
    def __init__(self, size: int):
        self.size = size

    def __call__(self, frames: List[Image.Image], flip: bool = False) -> torch.Tensor:
        out = []
        for img in frames:
            img = F.resize(img, [self.size, self.size], interpolation=F.InterpolationMode.BILINEAR)
            if flip:
                img = F.hflip(img)
            x = F.to_tensor(img)
            x = F.normalize(x, KINETICS_MEAN, KINETICS_STD)
            out.append(x)
        return torch.stack(out, dim=0).permute(1, 0, 2, 3).contiguous()


class ClipVideoDataset(Dataset):
    def __init__(self, samples: List[Sample], num_frames: int, augment_train: VideoAugmentTrain):
        self.samples = samples
        self.num_frames = num_frames
        self.augment = augment_train

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx: int):
        s = self.samples[idx]
        frames = _list_frames(s.frames_dir)

        if not frames:
            x = torch.zeros((3, self.num_frames, IMAGE_SIZE, IMAGE_SIZE), dtype=torch.float32)
            y = torch.tensor(s.label, dtype=torch.long)
            return x, y

        n = len(frames)
        idxs = uniform_indices(n, self.num_frames)
        idxs = jitter_indices(idxs, n, jitter=2)

        imgs = [Image.open(frames[int(i)]).convert("RGB") for i in idxs.tolist()]
        x = self.augment(imgs)
        y = torch.tensor(s.label, dtype=torch.long)
        return x, y


class FocalLoss(nn.Module):
    def __init__(self, gamma: float = 2.0):
        super().__init__()
        self.gamma = gamma

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        ce = torch.nn.functional.cross_entropy(logits, targets, reduction="none")
        pt = torch.exp(-ce)
        loss = ((1 - pt) ** self.gamma) * ce
        return loss.mean()


def make_r3d18(num_classes: int = 2) -> nn.Module:
    try:
        weights = torchvision.models.video.R3D_18_Weights.DEFAULT
        base = torchvision.models.video.r3d_18(weights=weights)
    except Exception:
        base = torchvision.models.video.r3d_18(pretrained=True)

    in_features = base.fc.in_features
    base.fc = nn.Sequential(
        nn.Dropout(DROPOUT_P),
        nn.Linear(in_features, num_classes),
    )
    return base


def set_trainable_stage(model: nn.Module, stage: str):
    for p in model.parameters():
        p.requires_grad = False

    for p in model.fc.parameters():
        p.requires_grad = True

    if stage == "finetune":
        for p in model.layer4.parameters():
            p.requires_grad = True


def make_optimizer(model: nn.Module, stage: str):
    if stage == "head_only":
        return torch.optim.AdamW(model.fc.parameters(), lr=LR_HEAD_WARMUP, weight_decay=WEIGHT_DECAY)

    params = [
        {"params": model.fc.parameters(), "lr": LR_HEAD_FINETUNE},
        {"params": model.layer4.parameters(), "lr": LR_BACKBONE_FINETUNE},
    ]
    return torch.optim.AdamW(params, weight_decay=WEIGHT_DECAY)


def mixup_batch(x: torch.Tensor, y: torch.Tensor, alpha: float):
    lam = np.random.beta(alpha, alpha)
    idx = torch.randperm(x.size(0), device=x.device)
    mixed = lam * x + (1 - lam) * x[idx]
    return mixed, y, y[idx], float(lam)


def train_one_epoch(model, loader, opt, criterion, device):
    model.train()
    total_loss, correct, total = 0.0, 0, 0

    for xb, yb in loader:
        xb, yb = xb.to(device), yb.to(device)
        opt.zero_grad(set_to_none=True)

        if random.random() < MIXUP_PROB:
            xb_m, y_a, y_b2, lam = mixup_batch(xb, yb, MIXUP_ALPHA)
            logits = model(xb_m)
            loss = lam * criterion(logits, y_a) + (1 - lam) * criterion(logits, y_b2)
        else:
            logits = model(xb)
            loss = criterion(logits, yb)

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        opt.step()

        total_loss += loss.item() * yb.size(0)
        correct += (logits.argmax(dim=1) == yb).sum().item()
        total += yb.size(0)

    return total_loss / max(total, 1), correct / max(total, 1)


@torch.no_grad()
def tta_logits_for_sample(model, s: Sample, augment_eval: VideoAugmentEval, device) -> torch.Tensor:
    frames = _list_frames(s.frames_dir)
    if not frames:
        return torch.zeros((1, 2), device=device)

    n = len(frames)
    bases = [
        uniform_indices(n, NUM_FRAMES_PER_CLIP),
        center_weighted_indices(n, NUM_FRAMES_PER_CLIP),
    ]

    logits_list = []
    for base in bases:
        for sh in TTA_SHIFTS:
            idxs = shift_indices(base, n, sh)
            imgs = [Image.open(frames[int(i)]).convert("RGB") for i in idxs.tolist()]

            # normal
            clip = augment_eval(imgs, flip=False).unsqueeze(0).to(device)
            logits_list.append(model(clip))

            # flip TTA
            if USE_FLIP_TTA:
                clip_f = augment_eval(imgs, flip=True).unsqueeze(0).to(device)
                logits_list.append(model(clip_f))

    return torch.stack(logits_list, dim=0).mean(dim=0)  # [1,2]


@torch.no_grad()
def probs_and_labels_with_tta(model, samples: List[Sample], augment_eval: VideoAugmentEval, device):
    model.eval()
    probs_three = []
    labels = []
    ce = nn.CrossEntropyLoss()

    total_loss = 0.0
    for s in samples:
        y = torch.tensor([s.label], dtype=torch.long, device=device)
        logits = tta_logits_for_sample(model, s, augment_eval, device)
        loss = ce(logits, y)
        total_loss += float(loss.item())

        p = torch.softmax(logits, dim=1)[0, 1].item()
        probs_three.append(p)
        labels.append(int(s.label))

    return total_loss / max(len(samples), 1), np.array(probs_three), np.array(labels)


def pick_threshold(probs_three: np.ndarray, labels: np.ndarray, metric: str = "acc") -> Tuple[float, float]:
    """
    metric: "acc" or "f1"
    returns best_threshold, best_score
    """
    best_thr, best_score = 0.5, -1.0
    for thr in np.linspace(0.20, 0.80, 61):
        preds = (probs_three >= thr).astype(np.int64)  # 1=three else 0=dunk
        if metric == "f1":
            score = f1_score(labels, preds, average="macro")
        else:
            score = (preds == labels).mean()
        if score > best_score:
            best_score = float(score)
            best_thr = float(thr)
    return best_thr, best_score


def eval_with_threshold(probs_three: np.ndarray, labels: np.ndarray, thr: float):
    preds = (probs_three >= thr).astype(np.int64)
    acc = float((preds == labels).mean())
    return acc, preds


def main():
    set_seed(SEED)
    repo_root = Path(__file__).resolve().parents[1]
    if not (repo_root / CLIPS_ROOT).exists():
        raise FileNotFoundError(f"Missing clips root: {repo_root / CLIPS_ROOT}")

    samples = build_dataset_from_supabase()
    y = [s.label for s in samples]
    train_s, test_s = train_test_split(samples, test_size=0.15, random_state=SEED, stratify=y)
    y_train = [s.label for s in train_s]
    train_s, val_s = train_test_split(train_s, test_size=0.18, random_state=SEED, stratify=y_train)

    print(f"Split: train={len(train_s)} val={len(val_s)} test={len(test_s)}")
    print("Train counts (dunk, three):", count_labels(train_s))
    print("Val counts   (dunk, three):", count_labels(val_s))
    print("Test counts  (dunk, three):", count_labels(test_s))

    train_ds = ClipVideoDataset(train_s, NUM_FRAMES_PER_CLIP, VideoAugmentTrain(size=IMAGE_SIZE))
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0, pin_memory=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Device:", device)

    model = make_r3d18(num_classes=2).to(device)

    stage = "head_only"
    set_trainable_stage(model, stage)
    opt = make_optimizer(model, stage)

    criterion = FocalLoss(gamma=FOCAL_GAMMA)

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        opt, mode="max", factor=0.5, patience=3
    )

    aug_eval = VideoAugmentEval(size=IMAGE_SIZE)

    best_val_acc = -1.0
    best_state: Optional[dict] = None
    bad = 0

    for epoch in range(1, EPOCHS + 1):
        if epoch == WARMUP_EPOCHS + 1:
            stage = "finetune"
            set_trainable_stage(model, stage)
            opt = make_optimizer(model, stage)
            scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
                opt, mode="max", factor=0.5, patience=3
            )
            print(f"\n==> Switched to FINETUNE (layer4 unfrozen) at epoch {epoch}\n")

        tr_loss, tr_acc = train_one_epoch(model, train_loader, opt, criterion, device)

        # VAL with TTA + threshold picked on VAL
        va_loss, va_probs, va_labels = probs_and_labels_with_tta(model, val_s, aug_eval, device)
        thr_acc, _ = pick_threshold(va_probs, va_labels, metric="acc")
        va_acc, _ = eval_with_threshold(va_probs, va_labels, thr_acc)

        scheduler.step(va_acc)

        if len(opt.param_groups) == 1:
            lr0 = opt.param_groups[0]["lr"]
            lr1 = 0.0
        else:
            lr0 = opt.param_groups[0]["lr"]
            lr1 = opt.param_groups[1]["lr"]

        print(
            f"Epoch {epoch:02d}/{EPOCHS}  "
            f"train: loss={tr_loss:.4f} acc={tr_acc:.3f}   "
            f"val(TTA+thr): loss={va_loss:.4f} acc={va_acc:.3f} thr={thr_acc:.2f}   "
            f"lr0={lr0:.1e} lr1={lr1:.1e}"
        )

        if va_acc > best_val_acc + 1e-4:
            best_val_acc = va_acc
            bad = 0
            best_state = {k: v.detach().cpu() for k, v in model.state_dict().items()}
        else:
            bad += 1
            if bad >= EARLY_STOP_PATIENCE:
                print(f"\nEarly stopping at epoch {epoch} (best val acc={best_val_acc:.3f})")
                break

    if best_state:
        model.load_state_dict({k: v.to(device) for k, v in best_state.items()})

    # FINAL: pick threshold on VAL once, apply to TEST
    va_loss, va_probs, va_labels = probs_and_labels_with_tta(model, val_s, aug_eval, device)
    thr_acc, score_acc = pick_threshold(va_probs, va_labels, metric="acc")
    thr_f1, score_f1 = pick_threshold(va_probs, va_labels, metric="f1")

    # Choose threshold strategy (ACC usually better for you right now)
    chosen_thr = thr_acc

    te_loss, te_probs, te_labels = probs_and_labels_with_tta(model, test_s, aug_eval, device)
    te_acc, te_pred = eval_with_threshold(te_probs, te_labels, chosen_thr)

    print(f"\nBEST VAL ACC (TTA+thr): {best_val_acc:.3f}")
    print(f"VAL threshold candidates: thr_acc={thr_acc:.2f} (acc={score_acc:.3f})  thr_f1={thr_f1:.2f} (macroF1={score_f1:.3f})")
    print(f"USING threshold: {chosen_thr:.2f}")
    print(f"TEST (TTA+thr): loss={te_loss:.4f} acc={te_acc:.3f}\n")

    cm = confusion_matrix(te_labels.tolist(), te_pred.tolist())
    print("Confusion matrix (rows=true, cols=pred):")
    print(cm)

    print("\nClassification report:")
    print(classification_report(
        te_labels.tolist(), te_pred.tolist(),
        target_names=[ID_TO_LABEL[0], ID_TO_LABEL[1]],
        zero_division=0
    ))

    out_path = repo_root / MODEL_OUT
    out_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        "state_dict": model.state_dict(),
        "label_to_id": LABEL_TO_ID,
        "num_frames": NUM_FRAMES_PER_CLIP,
        "image_size": IMAGE_SIZE,
        "arch": "r3d_18_v4_strong_tta_val_threshold_mixup_focal",
        "best_val_acc": float(best_val_acc),
        "chosen_threshold_three": float(chosen_thr),
        "tta": {
            "shifts": TTA_SHIFTS,
            "flip": USE_FLIP_TTA,
            "bases": ["uniform", "center_weighted"],
        },
        "config": {
            "frames": NUM_FRAMES_PER_CLIP,
            "image_size": IMAGE_SIZE,
            "warmup_epochs": WARMUP_EPOCHS,
            "lr_head_warmup": LR_HEAD_WARMUP,
            "lr_head_finetune": LR_HEAD_FINETUNE,
            "lr_backbone_finetune": LR_BACKBONE_FINETUNE,
            "weight_decay": WEIGHT_DECAY,
            "dropout_p": DROPOUT_P,
            "mixup_prob": MIXUP_PROB,
            "mixup_alpha": MIXUP_ALPHA,
            "focal_gamma": FOCAL_GAMMA,
        }
    }, out_path)
    print(f"Saved model to: {out_path}")


if __name__ == "__main__":
    main()