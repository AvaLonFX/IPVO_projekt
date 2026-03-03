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

# SVE IDE POD python/analiza
ANALYSE_ROOT = "python/analiza"
OUTPUT_CSV = str(Path(ANALYSE_ROOT) / "pipeline_results.csv")
DEBUG_VIDEO_DIR = Path(ANALYSE_ROOT) / "debug_videos"
TORSO_DIR = Path(ANALYSE_ROOT) / "torso_crops"

SCORING_WINDOW_SEC = 3
CONF_THRESHOLD = 0.3

# TEAM vote: koliko prvih frameova scoring windowa koristimo za stabilizaciju timova
TEAM_VOTE_FRAMES = 10

# Scoreboard crop (donjih X% framea) — prošireno da češće uhvati scoreboard
SCOREBOARD_Y0_RATIO = 0.70  # (ranije 0.75)

# Logo zone unutar scoreboarda (lijevo/desno) — prošireno da češće uhvati logoe
LOGO_SIDE_W_RATIO = 0.28    # (ranije 0.22)

# Threshold za prihvaćanje logo matcha
LOGO_MATCH_THRESHOLD = 0.30

# ===== PLAYER/JERSEY HEURISTICS =====
# Za trice: shooter često nije najveći. Zato OCR-amo top-K igrača po frameu.
TOPK_PLAYERS_FOR_JERSEY = 3

# Ako nađemo jedinstveni PERSON_ID, možemo prekinuti ranije (štedi vrijeme i smanjuje šum).
EARLY_STOP_ON_MATCH = True
# Minimalno koliko jersey OCR uzoraka želimo prije nego vjerujemo vote-u (da ne early-stopamo prerano bez potrebe)
MIN_JERSEY_SAMPLES_BEFORE_STOP = 6

# ===== DEBUG / ANALYSIS SETTINGS =====
SAVE_DEBUG_VIDEO = True
DEBUG_FPS = 30
DRAW_ALL_PLAYERS = False      # preporuka: False (manje šuma). True ako baš želiš sve.
SAVE_TORSO_CROPS = True
MAX_TORSO_CROPS = 12
TORSO_SHARPNESS_MIN = 35.0
PICK_TORSO_STRATEGY = "hybrid"  # "area" / "sharpness" / "hybrid"

# ===== INIT OUTPUT DIRS =====
os.makedirs(ANALYSE_ROOT, exist_ok=True)
os.makedirs(DEBUG_VIDEO_DIR, exist_ok=True)
os.makedirs(TORSO_DIR, exist_ok=True)

# ===== LOAD MODELS =====
print("Loading YOLO...")
yolo = YOLO("yolov8n.pt")
yolo.to("cuda")

print("Loading OCR...")
ocr_reader = easyocr.Reader(["en"], gpu=True)

# ===== LOAD DATABASE =====
db = pd.read_csv(OSNOVNO_CSV)
db["TEAM_ABBREVIATION"] = db["TEAM_ABBREVIATION"].astype(str).str.strip().str.upper()
db["JERSEY_NUMBER"] = db["JERSEY_NUMBER"].astype(str).str.strip()

valid_teams = set(db["TEAM_ABBREVIATION"].unique())

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

        team = fp.stem.strip().upper()  # dal.png -> DAL
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

def draw_label(img, text, org, scale=0.7, thickness=2, color=(255, 255, 255)):
    # shadow
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thickness, cv2.LINE_AA)

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

def extract_teams_once(frame):
    """Extract teams from a single frame (OCR first, then logo fallback)."""
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
    """Returns list of players: (area, conf, (x1,y1,x2,y2)) sorted by area desc."""
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

def try_resolve_from_votes(teams, jersey_candidates):
    """Try resolve using best jersey vote first, then fallback to full list."""
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

    # --- team vote state (IMPORTANT: not reset every frame)
    teams_votes = Counter()
    teams_source_votes = Counter()
    teams = []
    teams_source = ""

    # jersey state
    jersey_candidates = []

    # torso crops pool
    torso_pool = []

    # debug writer
    debug_writer = None
    debug_out_path = None
    if SAVE_DEBUG_VIDEO:
        out_name = f"{safe_slug(video_path.parent.name)}_{safe_slug(video_path.stem)}_debug.mp4"
        debug_out_path = DEBUG_VIDEO_DIR / out_name
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        debug_writer = cv2.VideoWriter(str(debug_out_path), fourcc, DEBUG_FPS, (width, height))

    # for debug: keep track of last "winner" bbox
    winner_bbox = None
    winner_num = None
    winner_pid = None

    frame_i = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # --- TEAM VOTE from first TEAM_VOTE_FRAMES frames
        if frame_i < TEAM_VOTE_FRAMES:
            t, src = extract_teams_once(frame)
            if t:
                for x in t:
                    teams_votes[x] += 1
                teams_source_votes[src] += 1

        # finalize teams as soon as we have enough votes (or at least 2 teams seen)
        if not teams and len(teams_votes) >= 2 and frame_i >= 2:
            teams = [k for k, _ in teams_votes.most_common(2)]
            teams_source = teams_source_votes.most_common(1)[0][0] if teams_source_votes else ""

        players = detect_players(frame)

        # pick TOP-K candidates for jersey OCR
        top_candidates = players[:TOPK_PLAYERS_FOR_JERSEY]

        # collect jersey candidates from top-K
        candidate_infos = []  # for debug overlay: [(bbox, conf, nums)]
        for rank, (area, conf, bbox) in enumerate(top_candidates, start=1):
            x1, y1, x2, y2 = bbox
            torso = frame[y1:int(y1 + (y2 - y1) * 0.6), x1:x2]
            if torso.size == 0:
                candidate_infos.append((bbox, conf, []))
                continue

            nums = extract_jersey_number(torso)
            candidate_infos.append((bbox, conf, nums))

            if nums:
                jersey_candidates.extend(nums)

            # save torso crop candidates (bonus)
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

        # attempt early resolve once we have teams + enough jersey samples
        if EARLY_STOP_ON_MATCH and teams and len(jersey_candidates) >= MIN_JERSEY_SAMPLES_BEFORE_STOP:
            pid, best_num, used_vote = try_resolve_from_votes(teams, jersey_candidates)
            if pid is not None:
                # determine winner bbox for debug: pick first candidate that produced best_num (or any)
                winner_pid = pid
                winner_num = best_num
                for bbox, conf, nums in candidate_infos:
                    if best_num and best_num in nums:
                        winner_bbox = bbox
                        break
                if winner_bbox is None and candidate_infos:
                    winner_bbox = candidate_infos[0][0]
                break

        # DEBUG OVERLAY
        if debug_writer is not None:
            overlay = frame.copy()

            if DRAW_ALL_PLAYERS:
                for _, conf, bbox in players:
                    x1, y1, x2, y2 = bbox
                    cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    draw_label(overlay, f"{conf:.2f}", (x1, max(20, y1 - 8)), scale=0.7)

            # draw TOP-K candidates
            for idx, (bbox, conf, nums) in enumerate(candidate_infos, start=1):
                x1, y1, x2, y2 = bbox
                cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 200, 0), 2)
                label = f"K{idx} {conf:.2f}"
                if nums:
                    label += f" nums:{','.join(nums)}"
                draw_label(overlay, label, (x1, max(20, y1 - 10)), scale=0.65, color=(255, 255, 255))

            # if already have a winner, highlight
            if winner_bbox:
                x1, y1, x2, y2 = winner_bbox
                cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 0, 255), 3)
                draw_label(overlay, "WINNER", (x1, max(20, y1 - 12)), scale=0.9, color=(255, 255, 255))

            # info
            best_num, best_cnt, best_total = majority_vote(jersey_candidates)
            info1 = f"teams_vote: {','.join(teams) if teams else 'NA'} (src:{teams_source if teams_source else 'NA'})"
            info2 = f"jersey_vote: {best_num if best_num else 'NA'} ({best_cnt}/{best_total})"
            info3 = f"frame: {frame_i}"

            draw_label(overlay, info1, (20, 40), scale=0.8)
            draw_label(overlay, info2, (20, 75), scale=0.8)
            draw_label(overlay, info3, (20, 110), scale=0.8)

            debug_writer.write(overlay)

        frame_i += 1

    cap.release()
    if debug_writer is not None:
        debug_writer.release()

    # finalize teams if we never set them during loop
    if not teams and teams_votes:
        teams = [k for k, _ in teams_votes.most_common(2)]
        teams_source = teams_source_votes.most_common(1)[0][0] if teams_source_votes else ""

    # final resolve
    person_id, best_num, used_vote = try_resolve_from_votes(teams, jersey_candidates)

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
            f.write(f"teams_vote: {teams}\n")
            f.write(f"teams_votes: {teams_votes}\n")
            f.write(f"teams_source_votes: {teams_source_votes}\n")
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
        "teams_votes": str(dict(teams_votes)) if teams_votes else "",
        "jersey_candidates": ",".join(jersey_candidates),
        "jersey_vote": str(best_num2) if best_num2 is not None else "",
        "jersey_vote_cnt": best_cnt,
        "jersey_vote_total": best_total,
        "resolved_person_id": person_id,
        "used_vote_first": bool(used_vote),
        "debug_video_path": str(debug_out_path) if debug_out_path else "",
        "torso_crops_dir": str(torso_saved_dir) if torso_saved_dir else "",
    }

# ===== RUN ALL =====
results = []

for game_dir in Path(CLIPS_ROOT).iterdir():
    if not game_dir.is_dir():
        continue

    for video_file in sorted(game_dir.glob("*.mp4")):
        print(f"Processing: {video_file}")
        row = process_clip(video_file)
        print(
            f" → teams({row['teams_source']}): {row['detected_teams']} "
            f"| vote: {row['jersey_vote']} ({row['jersey_vote_cnt']}/{row['jersey_vote_total']}) "
            f"| PERSON_ID: {row['resolved_person_id']}"
        )
        results.append(row)

# ===== SAVE CSV =====
df = pd.DataFrame(results)
df.to_csv(OUTPUT_CSV, index=False)

# ===== STATS =====
total = len(df)
resolved = df["resolved_person_id"].notna().sum()
failed = total - resolved
success_rate = (resolved / total * 100) if total > 0 else 0

ocr_used = (df["teams_source"] == "ocr").sum()
logo_used = (df["teams_source"] == "logo").sum()

print("\n===== PIPELINE SUMMARY =====")
print(f"Total clips: {total}")
print(f"Resolved PERSON_ID: {resolved}")
print(f"Failed: {failed}")
print(f"Success rate: {success_rate:.2f}%")
print(f"OCR used:  {ocr_used}")
print(f"Logo used: {logo_used}")
print(f"Saved results to: {OUTPUT_CSV}")
print(f"Debug videos: {DEBUG_VIDEO_DIR}")
print(f"Torso crops:  {TORSO_DIR}")