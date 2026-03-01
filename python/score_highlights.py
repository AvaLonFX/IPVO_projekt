import json
from pathlib import Path

IN_JSON = Path("python/data/features_2026-02-03.json")
OUT_JSON = Path("python/data/scored_2026-02-03.json")

W_MOTION = 0.65
W_AUDIO = 0.35

def minmax(values):
    mn = min(values)
    mx = max(values)
    if mx - mn < 1e-9:
        return mn, mx, lambda x: 0.5
    return mn, mx, lambda x: (x - mn) / (mx - mn)

def main():
    data = json.loads(IN_JSON.read_text(encoding="utf-8"))

    motions = [d["motion_energy"] for d in data]
    audios = [d["audio_mean_db"] for d in data]

    m_min, m_max, m_norm = minmax(motions)

    # audio: veći (manje negativan) = glasnije => veći score
    a_min, a_max, a_norm = minmax(audios)

    scored = []
    for d in data:
        mn = float(m_norm(d["motion_energy"]))
        an = float(a_norm(d["audio_mean_db"]))
        score = W_MOTION * mn + W_AUDIO * an

        scored.append({
            **d,
            "motion_norm": mn,
            "audio_norm": an,
            "score": float(round(score, 4)),
            "score_breakdown": {
                "motion_energy": d["motion_energy"],
                "audio_mean_db": d["audio_mean_db"],
                "motion_norm": mn,
                "audio_norm": an,
                "weights": {"motion": W_MOTION, "audio": W_AUDIO},
            }
        })

    # sort desc by score
    scored_sorted = sorted(scored, key=lambda x: x["score"], reverse=True)

    OUT_JSON.write_text(json.dumps(scored_sorted, indent=2), encoding="utf-8")
    print(f"Saved: {OUT_JSON}")
    print("Top 3 by score:")
    for x in scored_sorted[:3]:
        print(f"  rank #{x['rank']:02d} score={x['score']} motion={x['motion_energy']:.4f} audio={x['audio_mean_db']:.2f}")

if __name__ == "__main__":
    main()