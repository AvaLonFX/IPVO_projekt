import subprocess
from pathlib import Path

RAW_VIDEO = "python/data/raw_videos/niEOSQrtpt0.withaudio.mp4"
OUT_DIR = Path("python/data/clips/2026-02-03")

clips = [
    (1, 0, 4),
    (2, 16, 22),
    (3, 27, 32),
    (4, 35, 42),
    (5, 50, 59),
    (6, 62, 68),
    (7, 82, 88),
    (8, 95, 102),
    (9, 106, 113),
    (10, 125, 132),
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