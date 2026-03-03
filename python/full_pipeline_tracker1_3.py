import os
import cv2
import easyocr
import re
import pandas as pd
from pathlib import Path
from ultralytics import YOLO
import numpy as np
from collections import Counter

# ===== CONFIG =====
CLIPS_ROOT = "python/data/clips"
OSNOVNO_CSV = "osnovno_nba.csv"
LOGO_DIR = "python/team_logos"

# GT file (clip_id 1..70, player_id, event)
GT_CSV_CANDIDATES = [
    "python/analiza/player_highlights_rows.csv",
    "player_highlights_rows.csv",
    "python/player_highlights_rows.csv",
]

# SVE IDE POD python/analiza
ANALYSE_ROOT = "python/analiza"
OUTPUT_CSV = str(Path(ANALYSE_ROOT) / "pipeline_results.csv")
DEBUG_VIDEO_DIR = Path(ANALYSE_ROOT) / "debug_videos"
TORSO_DIR = Path(ANALYSE_ROOT) / "torso_crops"

SCORING_WINDOW_SEC = 4
CONF_THRESHOLD = 0.3

# ===== PATCH 1: TEAM VOTE =====
TEAM_VOTE_FRAMES = 16  # (ranije 8)

# ===== PATCH 2: bolji scoreboard/logo crop =====
SCOREBOARD_Y0_RATIO = 0.68   # (ranije 0.65 / 0.75)
LOGO_SIDE_W_RATIO = 0.32     # (ranije 0.22)
LOGO_MATCH_THRESHOLD = 0.35 # ok

# ===== PATCH 3: top-K igrača po frameu za jersey OCR (bolje za trice) =====
TOPK_PLAYERS_FOR_JERSEY = 5

# ===== PATCH 4: early stop kad nađe validan match =====
EARLY_STOP_ON_MATCH = True
MIN_JERSEY_SAMPLES_BEFORE_STOP = 6

# ===== DEBUG / ANALYSIS SETTINGS =====
SAVE_DEBUG_VIDEO = True
DEBUG_FPS = 30
DRAW_ALL_PLAYERS = True
SAVE_TORSO_CROPS = True
MAX_TORSO_CROPS = 10
TORSO_SHARPNESS_MIN = 45.0
PICK_TORSO_STRATEGY = "area"  # "area" / "sharpness" / "hybrid"

# ===== INIT OUTPUT DIRS =====
os.makedirs(ANALYSE_ROOT, exist_ok=True)
os.makedirs(DEBUG_VIDEO_DIR, exist_ok=True)
os.makedirs(TORSO_DIR, exist_ok=True)

# ===== LOAD MODELS =====
print("Loading YOLO...")
yolo = YOLO("yolov8s.pt")
yolo.to("cuda")

print("Loading OCR...")
ocr_reader = easyocr.Reader(["en"], gpu=True)

# ===== LOAD DATABASE =====
db = pd.read_csv(OSNOVNO_CSV)
db["TEAM_ABBREVIATION"] = db["TEAM_ABBREVIATION"].astype(str).str.strip().str.upper()
db["JERSEY_NUMBER"] = db["JERSEY_NUMBER"].astype(str).str.strip()
valid_teams = set(db["TEAM_ABBREVIATION"].unique())

# ===== LOAD GT (event + player_id) =====
def load_gt():
    gt_path = None
    for p in GT_CSV_CANDIDATES:
        if Path(p).exists():
            gt_path = p
            break
    if gt_path is None:
        print("[WARN] GT file not found. event/is_correct will be empty.")
        return None

    gt = pd.read_csv(gt_path)
    # expected columns: clip_id, player_id, event
    if "clip_id" not in gt.columns or "player_id" not in gt.columns or "event" not in gt.columns:
        print("[WARN] GT file missing required columns (clip_id, player_id, event). event/is_correct will be empty.")
        return None

    gt = gt.copy()
    gt["clip_id"] = pd.to_numeric(gt["clip_id"], errors="coerce").astype("Int64")
    gt["player_id"] = pd.to_numeric(gt["player_id"], errors="coerce").astype("Int64")
    gt["event"] = gt["event"].astype(str).str.strip().str.lower()
    return gt

gt_df = load_gt()

# ===== LOAD LOGO TEMPLATES =====
def load_logo_templates(logo_dir: str):
    templates = {}
    p = Path(logo_dir)
    if not p.exists():
        print(f"[WARN] LOGO_DIR not found: {logo_dir} (logo matching disabled)")
        return templates

    for fp in p.glob("*.*"):
        if fp.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
            continue

        team = fp.stem.strip().upper()
        img = cv2.imread(str(fp), cv2.IMREAD_UNCHANGED)
        if img is None:
            continue

        if len(img.shape) == 3 and img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        templates[team] = gray

    print(f"Loaded {len(templates)} logo templates from {logo_dir}")
    return templates

logo_templates = load_logo_templates(LOGO_DIR)

# ===== UTILS =====
def safe_slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_\-]+", "_", s)

def laplacian_sharpness(bgr_img) -> float:
    gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())

def draw_label(img, text, org, scale=0.7, thickness=2):
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, (255, 255, 255), thickness, cv2.LINE_AA)

# ===== TEAM DETECTION =====
def extract_team_abbrev_ocr(scoreboard_bgr):
    gray = cv2.cvtColor(scoreboard_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    texts = ocr_reader.readtext(gray, detail=0)

    teams = []
    for t in texts:
        matches = re.findall(r"\b[A-Z]{2,3}\b", str(t).upper())
        teams.extend(matches)

    teams = [t for t in teams if t in valid_teams]

    seen = set()
    out = []
    for t in teams:
        if t not in seen:
            out.append(t)
            seen.add(t)

    return out

def match_logo(logo_crop_bgr):
    if not logo_templates:
        return None, 0.0

    crop = cv2.cvtColor(logo_crop_bgr, cv2.COLOR_BGR2GRAY)
    crop = cv2.equalizeHist(crop)

    h, w = crop.shape[:2]
    if h < 20 or w < 20:
        return None, 0.0

    best_team, best_score = None, -1.0
    for team, templ in logo_templates.items():
        templ_resized = cv2.resize(templ, (w, h), interpolation=cv2.INTER_AREA)
        res = cv2.matchTemplate(crop, templ_resized, cv2.TM_CCOEFF_NORMED)
        score = float(np.max(res))
        if score > best_score:
            best_score = score
            best_team = team

    if best_score >= LOGO_MATCH_THRESHOLD:
        return best_team, best_score
    return None, best_score

def extract_teams(frame):
    h, w = frame.shape[:2]
    y0 = int(h * SCOREBOARD_Y0_RATIO)
    scoreboard = frame[y0:h, :]

    teams_ocr = extract_team_abbrev_ocr(scoreboard)
    if len(teams_ocr) >= 2:
        return teams_ocr[:2], "ocr"

    side_w = int(w * LOGO_SIDE_W_RATIO)
    left_crop = scoreboard[:, :side_w]
    right_crop = scoreboard[:, w - side_w:]

    left_team, _ = match_logo(left_crop)
    right_team, _ = match_logo(right_crop)

    detected = []
    if left_team:
        detected.append(left_team)
    if right_team and right_team != left_team:
        detected.append(right_team)

    return detected, "logo"

# ===== PLAYER DETECTION =====
def detect_players(frame):
    results = yolo(frame)[0]
    players = []
    for box in results.boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        if cls == 0 and conf > CONF_THRESHOLD:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            area = (x2 - x1) * (y2 - y1)
            players.append((area, conf, (int(x1), int(y1), int(x2), int(y2))))
    players.sort(key=lambda t: t[0], reverse=True)
    return players

# ===== JERSEY OCR =====
def extract_jersey_number(crop):
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    texts = ocr_reader.readtext(gray, detail=0)

    numbers = []
    for t in texts:
        matches = re.findall(r"\d{1,2}", str(t))
        numbers.extend(matches)

    return numbers

def majority_vote(numbers):
    if not numbers:
        return None, 0, 0
    c = Counter(numbers)
    best, cnt = c.most_common(1)[0]
    return best, cnt, sum(c.values())

# ===== LOOKUP =====
def lookup_person(team_list, jersey_numbers):
    team_list = [t.strip().upper() for t in team_list if t and str(t).strip() != ""]
    jersey_numbers = [str(n).strip() for n in jersey_numbers if n and str(n).strip() != ""]

    for team in team_list:
        for num in jersey_numbers:
            match = db[(db["TEAM_ABBREVIATION"] == team) & (db["JERSEY_NUMBER"] == num)]
            if len(match) == 1:
                return int(match.iloc[0]["PERSON_ID"])
    return None

def lookup_person_with_vote_first(teams, jersey_candidates):
    best_num, _, _ = majority_vote(jersey_candidates)
    if best_num:
        pid = lookup_person(teams, [best_num])
        if pid is not None:
            return pid, best_num, True
    pid = lookup_person(teams, jersey_candidates)
    return pid, best_num, False

# ===== MAIN PER-CLIP =====
def process_clip(video_path: Path):
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    start_frame = max(0, total_frames - int(fps * SCORING_WINDOW_SEC))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    teams = []
    teams_source = ""
    jersey_candidates = []

    # ===== PATCH: TEAM VOTE STATE (NE SMIJE biti u while petlji resetan) =====
    teams_votes = Counter()
    teams_source_votes = Counter()

    # spremanje najboljih torso cropova
    torso_pool = []

    # debug video writer
    debug_writer = None
    debug_out_path = None
    if SAVE_DEBUG_VIDEO:
        out_name = f"{safe_slug(video_path.parent.name)}_{safe_slug(video_path.stem)}_debug.mp4"
        debug_out_path = DEBUG_VIDEO_DIR / out_name
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        debug_writer = cv2.VideoWriter(str(debug_out_path), fourcc, DEBUG_FPS, (width, height))

    frame_i = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # ===== TEAM VOTE (prvih TEAM_VOTE_FRAMES frameova) =====
        if frame_i < TEAM_VOTE_FRAMES:
            t, src = extract_teams(frame)
            if t:
                for x in t:
                    teams_votes[x] += 1
                teams_source_votes[src] += 1

        # čim imamo 2 tima u voteu, zaključaj
        if not teams and len(teams_votes) >= 2 and frame_i >= 2:
            teams = [k for k, _ in teams_votes.most_common(2)]
            teams_source = teams_source_votes.most_common(1)[0][0] if teams_source_votes else ""

        players = detect_players(frame)

        # ===== PATCH: top-K kandidata za jersey OCR =====
        top_players = players[:TOPK_PLAYERS_FOR_JERSEY]

        shooter_torso = None
        shooter_nums = []

        # za debug: spremi candidate bboxove + nums
        candidate_infos = []

        for rank, (area, conf, bbox) in enumerate(top_players, start=1):
            x1, y1, x2, y2 = bbox
            torso = frame[y1:int(y1 + (y2 - y1) * 0.6), x1:x2]
            if torso.size <= 0:
                candidate_infos.append((rank, conf, bbox, []))
                continue

            nums = extract_jersey_number(torso)
            candidate_infos.append((rank, conf, bbox, nums))

            if nums:
                jersey_candidates.extend(nums)

            # bonus: spremi crop kandidata (filtriraj blur)
            if SAVE_TORSO_CROPS:
                sharp = laplacian_sharpness(torso)
                area_px = torso.shape[0] * torso.shape[1]
                if sharp >= TORSO_SHARPNESS_MIN:
                    if PICK_TORSO_STRATEGY == "sharpness":
                        score = sharp
                    elif PICK_TORSO_STRATEGY == "hybrid":
                        score = sharp * (area_px ** 0.5)
                    else:
                        score = area_px
                    torso_pool.append({
                        "score": score,
                        "sharp": sharp,
                        "area": area_px,
                        "img": torso.copy(),
                        "frame_i": frame_i,
                        "nums": nums
                    })

            # samo za thumbnail u debug videu (uzmi rank1)
            if rank == 1:
                shooter_torso = torso
                shooter_nums = nums

        # ===== PATCH: EARLY STOP =====
        if EARLY_STOP_ON_MATCH and teams and len(jersey_candidates) >= MIN_JERSEY_SAMPLES_BEFORE_STOP:
            pid, best_num, used_vote = lookup_person_with_vote_first(teams, jersey_candidates)
            if pid is not None:
                # napiši zadnji frame u debug (s winner info)
                if debug_writer is not None:
                    overlay = frame.copy()
                    # draw candidates
                    for rank, conf, bbox, nums in candidate_infos:
                        x1, y1, x2, y2 = bbox
                        cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 200, 0), 2)
                        label = f"K{rank} {conf:.2f}"
                        if nums:
                            label += f" nums:{','.join(nums)}"
                        draw_label(overlay, label, (x1, max(20, y1 - 10)), scale=0.65)

                    info1 = f"teams({teams_source}): {','.join(teams) if teams else 'NA'}"
                    bn, bc, bt = majority_vote(jersey_candidates)
                    info2 = f"jersey_vote: {bn if bn else 'NA'} ({bc}/{bt})"
                    info3 = f"EARLY STOP pid={pid}"
                    draw_label(overlay, info1, (20, 40), scale=0.8)
                    draw_label(overlay, info2, (20, 75), scale=0.8)
                    draw_label(overlay, info3, (20, 110), scale=0.8)
                    debug_writer.write(overlay)
                break

        # ===== DEBUG OVERLAY =====
        if debug_writer is not None:
            overlay = frame.copy()

            # draw all players
            if DRAW_ALL_PLAYERS and players:
                for _, conf, (px1, py1, px2, py2) in players:
                    cv2.rectangle(overlay, (px1, py1), (px2, py2), (0, 255, 0), 2)
                    draw_label(overlay, f"{conf:.2f}", (px1, max(20, py1 - 8)), scale=0.7)

            # draw top-K candidates
            for rank, conf, bbox, nums in candidate_infos:
                x1, y1, x2, y2 = bbox
                cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 200, 0), 2)
                label = f"K{rank} {conf:.2f}"
                if nums:
                    label += f" nums:{','.join(nums)}"
                draw_label(overlay, label, (x1, max(20, y1 - 10)), scale=0.65)

            # top-left info
            info1 = f"teams({teams_source}): {','.join(teams) if teams else 'NA'}"
            best_num, best_cnt, best_total = majority_vote(jersey_candidates)
            info2 = f"jersey_vote: {best_num if best_num else 'NA'} ({best_cnt}/{best_total})"
            info3 = f"frame: {frame_i}"

            draw_label(overlay, info1, (20, 40), scale=0.8)
            draw_label(overlay, info2, (20, 75), scale=0.8)
            draw_label(overlay, info3, (20, 110), scale=0.8)

            # thumbnail
            if shooter_torso is not None and shooter_torso.size > 0:
                thumb = cv2.resize(shooter_torso, (160, 160), interpolation=cv2.INTER_AREA)
                ox, oy = 20, 140
                overlay[oy:oy+160, ox:ox+160] = thumb
                if shooter_nums:
                    draw_label(overlay, f"ocr: {','.join(shooter_nums)}", (ox, oy + 175), scale=0.7)

            debug_writer.write(overlay)

        frame_i += 1

    cap.release()
    if debug_writer is not None:
        debug_writer.release()

    # finalize teams if still empty
    if not teams and teams_votes:
        teams = [k for k, _ in teams_votes.most_common(2)]
        teams_source = teams_source_votes.most_common(1)[0][0] if teams_source_votes else ""

    # final resolve
    person_id, best_num, used_vote = lookup_person_with_vote_first(teams, jersey_candidates)
    best_num2, best_cnt, best_total = majority_vote(jersey_candidates)

    # Save torso crops (top-N)
    torso_saved_dir = None
    if SAVE_TORSO_CROPS and torso_pool:
        torso_saved_dir = TORSO_DIR / f"{safe_slug(video_path.parent.name)}_{safe_slug(video_path.stem)}"
        os.makedirs(torso_saved_dir, exist_ok=True)

        torso_pool.sort(key=lambda d: d["score"], reverse=True)
        top = torso_pool[:MAX_TORSO_CROPS]
        for i, item in enumerate(top, start=1):
            fp = torso_saved_dir / f"{i:02d}_frame{item['frame_i']:04d}_sharp{item['sharp']:.1f}.jpg"
            cv2.imwrite(str(fp), item["img"])

        manifest_fp = torso_saved_dir / "crops_manifest.txt"
        with open(manifest_fp, "w", encoding="utf-8") as f:
            f.write(f"video: {video_path}\n")
            f.write(f"teams({teams_source}): {teams}\n")
            f.write(f"teams_votes: {dict(teams_votes)}\n")
            f.write(f"best_num_vote: {best_num2} ({best_cnt}/{best_total})\n")
            f.write(f"resolved_person_id: {person_id}\n")
            f.write("Top crops:\n")
            for i, item in enumerate(top, start=1):
                f.write(f"{i:02d} frame={item['frame_i']} sharp={item['sharp']:.2f} area={item['area']} nums={item['nums']}\n")

    return {
        "game_folder": video_path.parent.name,
        "clip": video_path.name,
        "teams_source": teams_source,
        "detected_teams": ",".join(teams) if teams else "",
        "jersey_candidates": ",".join(jersey_candidates),
        "jersey_vote": str(best_num2) if best_num2 is not None else "",
        "jersey_vote_cnt": best_cnt,
        "jersey_vote_total": best_total,
        "resolved_person_id": person_id,
        "used_vote_first": bool(used_vote),
        "debug_video_path": str(debug_out_path) if debug_out_path else "",
        "torso_crops_dir": str(torso_saved_dir) if torso_saved_dir else "",
    }

# ===== RUN ALL (clip_id 1..70 by processing order) =====
results = []
clip_id = 0

for game_dir in Path(CLIPS_ROOT).iterdir():
    if not game_dir.is_dir():
        continue

    for video_file in sorted(game_dir.glob("*.mp4")):
        clip_id += 1
        print(f"Processing clip_id={clip_id}: {video_file}")
        row = process_clip(video_file)
        row["clip_id"] = clip_id  # 1..70
        results.append(row)

        print(
            f" → teams({row['teams_source']}): {row['detected_teams']} "
            f"| vote: {row['jersey_vote']} ({row['jersey_vote_cnt']}/{row['jersey_vote_total']}) "
            f"| PERSON_ID: {row['resolved_person_id']}"
        )

# ===== SAVE CSV =====
df = pd.DataFrame(results)

# ===== ADD EVENT + GT + is_correct =====
if gt_df is not None:
    df = df.merge(
        gt_df[["clip_id", "player_id", "event"]],
        on="clip_id",
        how="left"
    )
    df = df.rename(columns={"player_id": "gt_player_id", "event": "event"})
    df["gt_player_id"] = pd.to_numeric(df["gt_player_id"], errors="coerce").astype("Int64")
    df["resolved_person_id"] = pd.to_numeric(df["resolved_person_id"], errors="coerce").astype("Int64")
    df["is_correct"] = (df["resolved_person_id"] == df["gt_player_id"]) & df["resolved_person_id"].notna() & df["gt_player_id"].notna()
else:
    df["gt_player_id"] = pd.Series([pd.NA] * len(df), dtype="Int64")
    df["event"] = ""
    df["is_correct"] = False

df.to_csv(OUTPUT_CSV, index=False)

# ===== STATS =====
total = len(df)
resolved = int(df["resolved_person_id"].notna().sum())
failed = total - resolved
success_rate = (resolved / total * 100) if total > 0 else 0.0

ocr_used = int((df["teams_source"] == "ocr").sum())
logo_used = int((df["teams_source"] == "logo").sum())

correct = int(df["is_correct"].sum()) if "is_correct" in df.columns else 0
accuracy = (correct / total * 100) if total > 0 else 0.0
precision = (correct / resolved * 100) if resolved > 0 else 0.0

print("\n===== PIPELINE SUMMARY =====")
print(f"Total clips: {total}")
print(f"Resolved PERSON_ID (coverage): {resolved}")
print(f"Failed: {failed}")
print(f"Coverage: {success_rate:.2f}%")
print(f"OCR used:  {ocr_used}")
print(f"Logo used: {logo_used}")
print(f"Saved results to: {OUTPUT_CSV}")

if gt_df is not None:
    print("\n===== EVALUATION vs GT =====")
    print(f"Correct: {correct}")
    print(f"Accuracy (correct/total): {accuracy:.2f}%")
    print(f"Precision (correct/resolved): {precision:.2f}%")

    # by event
    df_ev = df[df["event"].notna() & (df["event"].astype(str).str.len() > 0)].copy()
    if len(df_ev):
        for ev in sorted(df_ev["event"].astype(str).str.lower().unique()):
            sub = df_ev[df_ev["event"].astype(str).str.lower() == ev]
            t = len(sub)
            r = int(sub["resolved_person_id"].notna().sum())
            c = int(sub["is_correct"].sum())
            cov = (r / t * 100) if t else 0.0
            acc = (c / t * 100) if t else 0.0
            prec = (c / r * 100) if r else 0.0
            print(f"\n--- EVENT: {ev} ---")
            print(f"Total: {t}")
            print(f"Resolved: {r}  (coverage {cov:.2f}%)")
            print(f"Correct:  {c}  (accuracy {acc:.2f}%, precision {prec:.2f}%)")

print(f"Debug videos: {DEBUG_VIDEO_DIR}")
print(f"Torso crops:  {TORSO_DIR}")