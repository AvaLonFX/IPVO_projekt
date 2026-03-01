import subprocess
from pathlib import Path

RAW_VIDEO = "python/data/raw_videos/xQLBmcnCE-k.withaudio.mp4"
OUT_DIR = Path("python/data/clips/2026-03-06-DALMEM")

clips = [
    (1, 0, 6),
    (2, 18, 24),
    (3, 36, 42),
    (4, 71, 78),
    (5, 82, 90),
    (6, 91, 97),
    (7, 115, 122),
    (8, 125, 133),
    (9, 137, 145),
    (10, 240, 247)
]

OUT_DIR.mkdir(parents=True, exist_ok=True)

for rank, start, end in clips:
    out_file = OUT_DIR / f"{rank:02d}.mp4"

    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(start),
        "-to", str(end),
        "-i", RAW_VIDEO,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "aac",
        str(out_file)
    ]

    print(f"Cutting clip {rank}...")
    subprocess.run(cmd, check=True)

print("All clips created.")