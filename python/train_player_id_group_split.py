import os
import csv
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from torchvision.models import resnet18, ResNet18_Weights
from PIL import Image


@dataclass
class Config:
    labels_csv: str = "labels.csv"     # image_path,person_id,clip_id,game_folder,local_idx
    out_dir: str = "runs/player_id_baseline"

    img_size: int = 224
    batch_size: int = 32
    num_workers: int = 4

    epochs: int = 25
    lr: float = 3e-4
    weight_decay: float = 1e-4

    val_clip_ratio: float = 0.2  # split po clip_id
    seed: int = 42

    freeze_backbone_epochs: int = 3  # prvo treniraj samo head
    device: str = "cuda" if torch.cuda.is_available() else "cpu"


def set_seed(seed: int):
    random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def read_labels(path: str):
    rows = []
    with open(path, "r", newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            rows.append({
                "image_path": row["image_path"],
                "person_id": int(row["person_id"]),
                "clip_id": int(row["clip_id"]),
            })
    if not rows:
        raise ValueError("labels.csv is empty or unreadable.")
    return rows


def build_id_map(rows) -> Dict[int, int]:
    pids = sorted({r["person_id"] for r in rows})
    return {pid: i for i, pid in enumerate(pids)}


def split_by_clip(rows, val_clip_ratio: float, seed: int):
    set_seed(seed)
    clip_ids = sorted({r["clip_id"] for r in rows})
    random.shuffle(clip_ids)
    n_val = max(1, int(len(clip_ids) * val_clip_ratio))
    val_clips = set(clip_ids[:n_val])
    train = [r for r in rows if r["clip_id"] not in val_clips]
    val = [r for r in rows if r["clip_id"] in val_clips]
    return train, val, sorted(val_clips)


class FrameDataset(Dataset):
    def __init__(self, rows, id_map: Dict[int, int], tfm):
        self.rows = rows
        self.id_map = id_map
        self.tfm = tfm

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx):
        r = self.rows[idx]
        img = Image.open(r["image_path"]).convert("RGB")
        x = self.tfm(img)
        y = self.id_map[r["person_id"]]
        return x, torch.tensor(y, dtype=torch.long)


def make_model(num_classes: int, pretrained=True):
    weights = ResNet18_Weights.DEFAULT if pretrained else None
    model = resnet18(weights=weights)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    ce = nn.CrossEntropyLoss()
    loss_sum = 0.0
    correct = 0
    total = 0
    for x, y in loader:
        x = x.to(device)
        y = y.to(device)
        logits = model(x)
        loss = ce(logits, y)
        loss_sum += float(loss.item()) * x.size(0)
        pred = logits.argmax(dim=1)
        correct += int((pred == y).sum().item())
        total += int(y.numel())
    return loss_sum / max(total, 1), correct / max(total, 1)


def set_backbone_trainable(model, trainable: bool):
    for name, p in model.named_parameters():
        if name.startswith("fc."):
            p.requires_grad = True
        else:
            p.requires_grad = trainable


def main(cfg: Config):
    os.makedirs(cfg.out_dir, exist_ok=True)
    set_seed(cfg.seed)

    rows = read_labels(cfg.labels_csv)
    id_map = build_id_map(rows)
    num_classes = len(id_map)

    train_rows, val_rows, val_clips = split_by_clip(rows, cfg.val_clip_ratio, cfg.seed)

    print(f"Samples: total={len(rows)} train={len(train_rows)} val={len(val_rows)}")
    print(f"Clips: total={len(set(r['clip_id'] for r in rows))} val_clips={len(val_clips)}")
    print(f"Classes (unique players): {num_classes}")

    tfm_train = transforms.Compose([
        transforms.Resize((cfg.img_size, cfg.img_size)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.25, hue=0.02),
        transforms.RandomGrayscale(p=0.05),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]),
    ])
    tfm_val = transforms.Compose([
        transforms.Resize((cfg.img_size, cfg.img_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]),
    ])

    ds_train = FrameDataset(train_rows, id_map, tfm_train)
    ds_val = FrameDataset(val_rows, id_map, tfm_val)

    dl_train = DataLoader(ds_train, batch_size=cfg.batch_size, shuffle=True,
                          num_workers=cfg.num_workers, pin_memory=True)
    dl_val = DataLoader(ds_val, batch_size=cfg.batch_size, shuffle=False,
                        num_workers=cfg.num_workers, pin_memory=True)

    device = torch.device(cfg.device)
    model = make_model(num_classes, pretrained=True).to(device)

    # prvo treniraj samo head par epoha (pomaže kod malo podataka)
    set_backbone_trainable(model, trainable=False)

    opt = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()),
                            lr=cfg.lr, weight_decay=cfg.weight_decay)
    ce = nn.CrossEntropyLoss()

    best_acc = -1.0
    best_path = os.path.join(cfg.out_dir, "best.pt")

    for epoch in range(1, cfg.epochs + 1):
        model.train()

        # nakon freeze_backbone_epochs odmrzni backbone
        if epoch == cfg.freeze_backbone_epochs + 1:
            set_backbone_trainable(model, trainable=True)
            opt = torch.optim.AdamW(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)

        running = 0.0
        seen = 0

        for x, y in dl_train:
            x = x.to(device, non_blocking=True)
            y = y.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            logits = model(x)
            loss = ce(logits, y)
            loss.backward()
            opt.step()
            running += float(loss.item()) * x.size(0)
            seen += x.size(0)

        train_loss = running / max(seen, 1)
        val_loss, val_acc = evaluate(model, dl_val, device)
        print(f"Epoch {epoch:03d}/{cfg.epochs} | train_loss={train_loss:.4f} | val_loss={val_loss:.4f} | val_acc={val_acc:.4f}")

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save({
                "state_dict": model.state_dict(),
                "id_map": id_map,  # person_id -> class_id
                "img_size": cfg.img_size,
            }, best_path)

    print(f"Done. Best val_acc={best_acc:.4f}")
    print(f"Saved: {best_path}")


if __name__ == "__main__":
    cfg = Config()
    main(cfg)