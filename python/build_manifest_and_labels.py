import csv
from pathlib import Path

def list_game_dirs(clips_root: Path):
    return sorted([p for p in clips_root.iterdir() if p.is_dir()], key=lambda p: p.name)

def list_local_frame_dirs(game_dir: Path):
    # uzmi 01_frames, 02_frames, ... sortirano po broju
    frame_dirs = []
    for p in game_dir.iterdir():
        if p.is_dir() and p.name.endswith("_frames"):
            frame_dirs.append(p)
    def key_fn(p: Path):
        # "01_frames" -> 1
        try:
            return int(p.name.split("_")[0])
        except:
            return 9999
    return sorted(frame_dirs, key=key_fn)

def list_frame_files(frames_dir: Path):
    exts = {".jpg", ".jpeg", ".png", ".webp"}
    files = [p for p in frames_dir.iterdir() if p.is_file() and p.suffix.lower() in exts]
    files.sort(key=lambda p: p.name)  # "0001", "0002" ...
    return files

def read_highlights_csv(path: Path):
    rows = []
    with open(path, "r", newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            if row.get("player_id") in (None, "", "NULL", "null"):
                continue
            rows.append((int(row["clip_id"]), int(row["player_id"])))
    rows.sort(key=lambda x: x[0])  # po clip_id
    return rows

def main(
    clips_root="python/data/clips",
    highlights_csv="highlights.csv",
    out_manifest="manifest.csv",
    out_labels="labels.csv",
    frames_per_clip=12,      # uzmi zadnjih N frameova kao baseline
    take_from_end=True
):
    clips_root = Path(clips_root)
    highlights_csv = Path(highlights_csv)

    assert clips_root.exists(), f"Missing clips_root: {clips_root}"
    assert highlights_csv.exists(), f"Missing highlights_csv: {highlights_csv}"

    gt = read_highlights_csv(highlights_csv)  # [(clip_id, player_id), ...]
    if not gt:
        raise ValueError("highlights.csv nema valjanih redova (clip_id, player_id).")

    # Skupljaj sve local clipove (game_folder + local_idx)
    local_clips = []
    for game_dir in list_game_dirs(clips_root):
        for frames_dir in list_local_frame_dirs(game_dir):
            # local_idx = 1 iz "01_frames"
            try:
                local_idx = int(frames_dir.name.split("_")[0])
            except:
                continue
            local_clips.append((game_dir, local_idx, frames_dir))

    # Sort: game folder name, pa local_idx
    local_clips.sort(key=lambda t: (t[0].name, t[1]))

    if len(local_clips) < len(gt):
        raise ValueError(
            f"Našao sam {len(local_clips)} local klipova (XX_frames), ali u highlights ima {len(gt)} redova."
        )

    # Zipaj redom: i-ti GT red ide na i-ti local clip
    manifest_rows = []
    label_rows = []

    for i, (clip_id, player_id) in enumerate(gt):
        game_dir, local_idx, frames_dir = local_clips[i]

        manifest_rows.append({
            "clip_id": clip_id,
            "player_id": player_id,
            "game_folder": game_dir.name,
            "local_idx": local_idx,
            "frames_dir": str(frames_dir).replace("\\", "/")
        })

        frames = list_frame_files(frames_dir)
        if not frames:
            continue

        chosen = frames[-frames_per_clip:] if (take_from_end and frames_per_clip > 0) else frames[:frames_per_clip]

        for fp in chosen:
            label_rows.append({
                "image_path": str(fp).replace("\\", "/"),
                "person_id": player_id,
                "clip_id": clip_id,
                "game_folder": game_dir.name,
                "local_idx": local_idx
            })

    # Save manifest (da možeš vizualno provjeriti je li mapping OK)
    with open(out_manifest, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["clip_id", "player_id", "game_folder", "local_idx", "frames_dir"])
        w.writeheader()
        w.writerows(manifest_rows)

    # Save labels
    with open(out_labels, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["image_path", "person_id", "clip_id", "game_folder", "local_idx"])
        w.writeheader()
        w.writerows(label_rows)

    print(f"OK: manifest saved -> {out_manifest} ({len(manifest_rows)} rows)")
    print(f"OK: labels saved   -> {out_labels} ({len(label_rows)} rows)")

if __name__ == "__main__":
    main()