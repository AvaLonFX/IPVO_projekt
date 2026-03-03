import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Tuple

import numpy as np
from PIL import Image

import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms

from sklearn.metrics import confusion_matrix, classification_report
from dotenv import load_dotenv
from supabase import create_client


# ========= CONFIG =========
ENV_FILE = Path(".env.local")
CLIPS_ROOT = Path("python/data/clips")
MODEL_OUT = Path("python/models/event_resnet18_v1_4_group_finetune.pt")

NUM_FRAMES_PER_CLIP = 10
IMAGE_SIZE = 224
BATCH_SIZE = 16
EPOCHS = 30
SEED = 42

LR_HEAD = 3e-4        # smaller than before
LR_BACKBONE = 1e-5    # very small to avoid overfit
WEIGHT_DECAY = 1e-4

PATIENCE = 6          # early stopping patience (epochs)
MIN_DELTA = 0.001

LABEL_TO_ID = {"dunk": 0, "three": 1}
ID_TO_LABEL = {v: k for k, v in LABEL_TO_ID.items()}

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
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
    group: int  # daily_video_id


def rank_to_str(rank: int) -> str:
    return f"{rank:02d}"


def count_labels(samples: List[Sample]) -> Tuple[int, int]:
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

        frames_dir = repo_root / CLIPS_ROOT / folder_key / f"{rank_to_str(rank)}_frames"
        if not frames_dir.exists():
            skipped += 1
            continue

        samples.append(Sample(frames_dir=frames_dir, label=LABEL_TO_ID[event], group=daily_video_id))

    print(f"Loaded samples: {len(samples)} (skipped {skipped})")
    return samples


def group_split(samples: List[Sample], seed: int = 42) -> Tuple[List[Sample], List[Sample], List[Sample]]:
    rng = random.Random(seed)
    groups: Dict[int, List[Sample]] = {}
    for s in samples:
        groups.setdefault(s.group, []).append(s)

    group_ids = list(groups.keys())
    rng.shuffle(group_ids)

    total = len(samples)
    target_test = int(round(total * 0.15))
    target_val = int(round(total * 0.15))

    test, val, train = [], [], []
    test_n = val_n = 0

    for gid in group_ids:
        g = groups[gid]
        if test_n < target_test:
            test.extend(g); test_n += len(g)
        elif val_n < target_val:
            val.extend(g); val_n += len(g)
        else:
            train.extend(g)

    return train, val, test


class ClipFramesDataset(Dataset):
    def __init__(self, samples: List[Sample], num_frames: int, tfm):
        self.samples = samples
        self.num_frames = num_frames
        self.tfm = tfm

    def __len__(self):
        return len(self.samples)

    def _pick_frames_mid_focus(self, frames_dir: Path) -> List[Path]:
        frames = sorted(frames_dir.glob("*.jpg"))
        if not frames:
            return []
        n = len(frames)
        if n <= self.num_frames:
            return frames
        lo = int(n * 0.20)
        hi = int(n * 0.80) - 1
        if hi <= lo:
            lo, hi = 0, n - 1
        idxs = np.linspace(lo, hi, self.num_frames).astype(int).tolist()
        return [frames[i] for i in idxs]

    def __getitem__(self, idx):
        s = self.samples[idx]
        frame_paths = self._pick_frames_mid_focus(s.frames_dir)
        if not frame_paths:
            x = torch.zeros((self.num_frames, 3, IMAGE_SIZE, IMAGE_SIZE))
        else:
            imgs = []
            for p in frame_paths:
                img = Image.open(p).convert("RGB")
                imgs.append(self.tfm(img))
            while len(imgs) < self.num_frames:
                imgs.append(imgs[-1].clone())
            x = torch.stack(imgs, dim=0)
        y = torch.tensor(s.label, dtype=torch.long)
        return x, y


class TemporalAverageModel(nn.Module):
    def __init__(self, backbone: nn.Module, num_classes: int = 2):
        super().__init__()
        self.backbone = backbone
        in_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Identity()
        self.head = nn.Sequential(
            nn.Dropout(p=0.35),
            nn.Linear(in_features, num_classes),
        )

    def forward(self, x):
        b, t, c, h, w = x.shape
        x = x.view(b * t, c, h, w)
        feats = self.backbone(x)
        logits = self.head(feats)
        return logits.view(b, t, -1).mean(dim=1)


def train_one_epoch(model, loader, opt, criterion, device):
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    for xb, yb in loader:
        xb, yb = xb.to(device), yb.to(device)
        opt.zero_grad()
        logits = model(xb)
        loss = criterion(logits, yb)
        loss.backward()
        opt.step()
        total_loss += loss.item() * yb.size(0)
        correct += (logits.argmax(dim=1) == yb).sum().item()
        total += yb.size(0)
    return total_loss / max(total, 1), correct / max(total, 1)


@torch.no_grad()
def eval_model(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    all_y, all_p = [], []
    for xb, yb in loader:
        xb, yb = xb.to(device), yb.to(device)
        logits = model(xb)
        loss = criterion(logits, yb)
        preds = logits.argmax(dim=1)
        total_loss += loss.item() * yb.size(0)
        correct += (preds == yb).sum().item()
        total += yb.size(0)
        all_y.extend(yb.cpu().numpy().tolist())
        all_p.extend(preds.cpu().numpy().tolist())
    return total_loss / max(total, 1), correct / max(total, 1), all_y, all_p


def main():
    set_seed(SEED)
    repo_root = Path(__file__).resolve().parents[1]

    samples = build_dataset_from_supabase()
    train_s, val_s, test_s = group_split(samples, seed=SEED)

    print(f"Split (GROUP): train={len(train_s)} val={len(val_s)} test={len(test_s)}")
    print("Train counts (dunk, three):", count_labels(train_s))
    print("Val counts   (dunk, three):", count_labels(val_s))
    print("Test counts  (dunk, three):", count_labels(test_s))

    tfm_train = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    tfm_eval = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    train_loader = DataLoader(ClipFramesDataset(train_s, NUM_FRAMES_PER_CLIP, tfm_train),
                              batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(ClipFramesDataset(val_s, NUM_FRAMES_PER_CLIP, tfm_eval),
                            batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    test_loader = DataLoader(ClipFramesDataset(test_s, NUM_FRAMES_PER_CLIP, tfm_eval),
                             batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Device:", device)

    backbone = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    model = TemporalAverageModel(backbone, num_classes=2).to(device)

    # Freeze all first
    for p in model.backbone.parameters():
        p.requires_grad = False
    # Unfreeze layer4 only (controlled fine-tune)
    for p in model.backbone.layer4.parameters():
        p.requires_grad = True

    # Class weights from TRAIN split
    dunk_n, three_n = count_labels(train_s)
    total = dunk_n + three_n
    w = torch.tensor([total / max(dunk_n, 1), total / max(three_n, 1)], dtype=torch.float32).to(device)
    print("Class weights [dunk, three]:", w.tolist())
    criterion = nn.CrossEntropyLoss(weight=w)

    opt = torch.optim.Adam(
        [
            {"params": model.head.parameters(), "lr": LR_HEAD},
            {"params": model.backbone.layer4.parameters(), "lr": LR_BACKBONE},
        ],
        weight_decay=WEIGHT_DECAY
    )

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, mode="max", factor=0.5, patience=3)

    best_val = -1.0
    best_state = None
    bad_epochs = 0

    for epoch in range(1, EPOCHS + 1):
        tr_loss, tr_acc = train_one_epoch(model, train_loader, opt, criterion, device)
        va_loss, va_acc, _, _ = eval_model(model, val_loader, criterion, device)
        scheduler.step(va_acc)

        print(
            f"Epoch {epoch:02d}/{EPOCHS} "
            f"train: loss={tr_loss:.4f} acc={tr_acc:.3f}   "
            f"val: loss={va_loss:.4f} acc={va_acc:.3f}"
        )

        if va_acc > best_val + MIN_DELTA:
            best_val = va_acc
            best_state = {k: v.detach().cpu() for k, v in model.state_dict().items()}
            bad_epochs = 0
        else:
            bad_epochs += 1

        if bad_epochs >= PATIENCE:
            print(f"Early stopping at epoch {epoch} (no val improvement for {PATIENCE} epochs).")
            break

    if best_state:
        model.load_state_dict({k: v.to(device) for k, v in best_state.items()})

    te_loss, te_acc, y_true, y_pred = eval_model(model, test_loader, criterion, device)
    print(f"\nBEST VAL ACC: {best_val:.3f}")
    print(f"TEST: loss={te_loss:.4f} acc={te_acc:.3f}\n")

    cm = confusion_matrix(y_true, y_pred)
    print("Confusion matrix (rows=true, cols=pred):")
    print(cm)

    print("\nClassification report:")
    print(classification_report(y_true, y_pred, target_names=[ID_TO_LABEL[0], ID_TO_LABEL[1]], zero_division=0))

    out_path = repo_root / MODEL_OUT
    out_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        "state_dict": model.state_dict(),
        "label_to_id": LABEL_TO_ID,
        "num_frames": NUM_FRAMES_PER_CLIP,
        "image_size": IMAGE_SIZE,
        "arch": "resnet18_temporal_avg_group_split_finetune_layer4_earlystop",
        "best_val_acc": float(best_val),
    }, out_path)
    print(f"Saved model to: {out_path}")


if __name__ == "__main__":
    main()