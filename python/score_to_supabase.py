import json
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# ====== CONFIG (današnji posao) ======
YOUTUBE_VIDEO_ID = "xQLBmcnCE-k"
DAY = "2026-03-06"
TITLE = "Top10 2026-03-06"

# VAŽNO: mora biti VALIDNA enum vrijednost iz Supabase dropdowna!
DEFAULT_EVENT = "dunk"   # promijeni u npr. "three" ako ti enum nije "dunk"

CLIPS = [
    (1, 0, 6),      # Dunk
    (2, 18, 24),    # 3pt
    (3, 36, 42),    # Dunk
    (4, 71, 78),    # Dunk
    (5, 82, 90),    # 3pt
    (6, 91, 97),    # Dunk
    (7, 115, 122),  # 3pt
    (8, 125, 133),  # Dunk
    (9, 137, 145),  # 3pt
    (10, 240, 247)  # 3pt
]

SCORED_JSON = Path("python/data/scored_2026-03-06-DALMEM.json")
ENV_FILE = Path(".env.local")
# ====================================


def must_get(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing env var: {name}")
    return v


def main():
    root = Path(__file__).resolve().parents[1]
    load_dotenv(dotenv_path=root / ENV_FILE)

    url = must_get("NEXT_PUBLIC_SUPABASE_URL")
    key = must_get("SERVICE_ROLE_KEY")
    sb = create_client(url, key)

    scored_path = root / SCORED_JSON
    scored = json.loads(scored_path.read_text(encoding="utf-8"))
    scored_by_rank = {int(x["rank"]): x for x in scored}

    # 1) Find or insert yt_daily_videos
    existing_daily = (
        sb.table("yt_daily_videos")
        .select("id,youtube_video_id,day,title")
        .eq("youtube_video_id", YOUTUBE_VIDEO_ID)
        .order("id", desc=True)
        .limit(1)
        .execute()
        .data
    )

    if existing_daily:
        daily_id = int(existing_daily[0]["id"])
        print(f"Found yt_daily_videos row: id={daily_id} for {YOUTUBE_VIDEO_ID}")
    else:
        inserted = (
            sb.table("yt_daily_videos")
            .insert({"day": DAY, "youtube_video_id": YOUTUBE_VIDEO_ID, "title": TITLE})
            .execute()
            .data
        )
        daily_id = int(inserted[0]["id"])
        print(f"Inserted yt_daily_videos row: id={daily_id} for {YOUTUBE_VIDEO_ID}")

    # 2) For each clip: upsert yt_video_clips by (daily_id, rank), then upsert player_highlights by clip_id
    for rank, start_sec, end_sec in CLIPS:
        # find clip
        existing_clip = (
            sb.table("yt_video_clips")
            .select("id,rank,daily_video_id")
            .eq("daily_video_id", daily_id)
            .eq("rank", rank)
            .limit(1)
            .execute()
            .data
        )

        if existing_clip:
            clip_id = int(existing_clip[0]["id"])
            sb.table("yt_video_clips").update({
                "start_sec": int(start_sec),
                "end_sec": int(end_sec),
            }).eq("id", clip_id).execute()
            print(f"Updated yt_video_clips: rank={rank} id={clip_id} [{start_sec}-{end_sec}]")
        else:
            inserted_clip = (
                sb.table("yt_video_clips")
                .insert({
                    "daily_video_id": daily_id,
                    "rank": int(rank),
                    "start_sec": int(start_sec),
                    "end_sec": int(end_sec),
                })
                .execute()
                .data
            )
            clip_id = int(inserted_clip[0]["id"])
            print(f"Inserted yt_video_clips: rank={rank} id={clip_id} [{start_sec}-{end_sec}]")

        # score data
        s = scored_by_rank.get(rank)
        if not s:
            print(f"  (no scored data for rank {rank}, skipping player_highlights)")
            continue

        score = float(s.get("score", 0.0))
        breakdown = s.get("score_breakdown", {})

        # upsert into player_highlights (event is NOT NULL + enum)
        existing_ph = (
            sb.table("player_highlights")
            .select("id,clip_id")
            .eq("clip_id", clip_id)
            .limit(1)
            .execute()
            .data
        )

        if existing_ph:
            ph_id = existing_ph[0]["id"]
            sb.table("player_highlights").update({
                "score": score,
                "score_breakdown": breakdown,
                "event": DEFAULT_EVENT,   # keep valid
                "event_conf": 0,
            }).eq("id", ph_id).execute()
            print(f"  Updated player_highlights for clip_id={clip_id} score={score}")
        else:
            sb.table("player_highlights").insert({
                "clip_id": clip_id,
                "score": score,
                "score_breakdown": breakdown,
                "event": DEFAULT_EVENT,   # REQUIRED
                "event_conf": 0,
            }).execute()
            print(f"  Inserted player_highlights for clip_id={clip_id} score={score}")

    print("\nDONE ✅")


if __name__ == "__main__":
    main()