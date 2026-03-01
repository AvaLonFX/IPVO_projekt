import subprocess
from pathlib import Path

CLIPS_DIR = Path("python/data/clips/2026-03-06-DALMEM")
FPS = 5  # dovoljno za baseline; kasnije možeš 10

def run(cmd):
    print(" ".join(cmd))
    subprocess.run(cmd, check=True)

def main():
    clips = sorted(CLIPS_DIR.glob("*.mp4"))
    if not clips:
        raise FileNotFoundError(f"No mp4 clips found in {CLIPS_DIR}")

    for clip in clips:
        out_dir = clip.with_suffix("")  # npr. 01
        frames_dir = out_dir.parent / f"{out_dir.name}_frames"
        frames_dir.mkdir(parents=True, exist_ok=True)

        # ffmpeg extract frames
        run([
            "ffmpeg", "-y",
            "-i", str(clip),
            "-vf", f"fps={FPS}",
            str(frames_dir / "%04d.jpg")
        ])

    print("Frames extracted for all clips.")

if __name__ == "__main__":
    main()