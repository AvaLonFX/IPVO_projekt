import subprocess
from pathlib import Path

RAW_VIDEO = "python/data/raw_videos/2zlzBk7A5tw.withaudio.mp4"
OUT_DIR = Path("python/data/clips/2026-03-15-OKCDAL")

clips = [
    (1, 17, 24),    # 3pt
    (2, 27, 34),    # Dunk
    (3, 66, 73),    # Dunk
    (4, 80, 87),    # 3pt
    (5, 90, 97),    # 3pt
    (6, 102, 108),  # Dunk
    (7, 110, 114),  # Dunk
    (8, 123, 129),  # Dunk
    (9, 154, 162),  # 3pt
    (10, 182, 189)  # 3pt
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