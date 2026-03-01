import json
import subprocess
from pathlib import Path

import cv2
import numpy as np

# === CONFIG ===
CLIPS_DIR = Path("python/data/clips/2026-02-03")
OUT_JSON = Path("python/data/features_2026-02-03.json")
FPS_NOTE = "Frames assumed already extracted at 5 fps"


# =======================
# AUDIO FEATURE (STABLE)
# =======================
def ffmpeg_audio_mean_db(video_path: Path) -> float:
    """
    Returns mean volume in dB using ffmpeg volumedetect.
    Stable across ffmpeg versions.
    """
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-i", str(video_path),
        "-vn",
        "-af", "volumedetect",
        "-f", "null",
        "NUL"  # Windows null sink
    ]

    p = subprocess.run(cmd, capture_output=True, text=True)
    text = p.stderr

    mean_db = None
    for line in text.splitlines():
        line = line.strip()
        if "mean_volume:" in line:
            try:
                mean_db = float(
                    line.split("mean_volume:")[1]
                        .split("dB")[0]
                        .strip()
                )
            except:
                pass

    if mean_db is None:
        return float("nan")

    return float(mean_db)


# =======================
# MOTION FEATURE
# =======================
def motion_energy_from_frames(frames_dir: Path) -> float:
    """
    Simple motion proxy using frame-to-frame absolute difference.
    Returns mean normalized motion magnitude.
    """
    frames = sorted(frames_dir.glob("*.jpg"))
    if len(frames) < 2:
        return 0.0

    prev = cv2.imread(str(frames[0]), cv2.IMREAD_GRAYSCALE)
    prev = cv2.resize(prev, (320, 180))

    diffs = []

    for f in frames[1:]:
        img = cv2.imread(str(f), cv2.IMREAD_GRAYSCALE)
        img = cv2.resize(img, (320, 180))

        diff = cv2.absdiff(img, prev)
        diffs.append(float(np.mean(diff)))

        prev = img

    # Normalize roughly to 0–1
    return float(np.mean(diffs) / 255.0)


# =======================
# MAIN
# =======================
def main():
    out = []

    clips = sorted(CLIPS_DIR.glob("*.mp4"))
    if not clips:
        raise FileNotFoundError(f"No mp4 clips found in {CLIPS_DIR}")

    print(f"Found {len(clips)} clips.")
    print(FPS_NOTE)
    print("")

    for clip in clips:
        rank = int(clip.stem)  # "01" -> 1
        frames_dir = CLIPS_DIR / f"{clip.stem}_frames"

        motion = motion_energy_from_frames(frames_dir)
        audio_db = ffmpeg_audio_mean_db(clip)

        print(f"#{rank:02d} motion={motion:.4f} audio_mean_db={audio_db:.2f}")

        out.append({
            "rank": rank,
            "clip_file": str(clip).replace("\\", "/"),
            "frames_dir": str(frames_dir).replace("\\", "/"),
            "motion_energy": motion,
            "audio_mean_db": audio_db,
        })

    OUT_JSON.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nSaved features to: {OUT_JSON}")


if __name__ == "__main__":
    main()