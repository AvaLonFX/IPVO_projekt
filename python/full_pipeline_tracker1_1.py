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
TEAM_VOTE_FRAMES = 8
# Scoreboard crop (donjih 25% framea)
SCOREBOARD_Y0_RATIO = 0.65

# Logo zone unutar scoreboarda (lijevih/desnih ~22% širine)
LOGO_SIDE_W_RATIO = 0.22

# Threshold za prihvaćanje logo matcha
LOGO_MATCH_THRESHOLD = 0.30

# ===== DEBUG / ANALYSIS SETTINGS =====
SAVE_DEBUG_VIDEO = True
DEBUG_FPS = 30                # fps debug videa (ne mora biti original)
DRAW_ALL_PLAYERS = True       # nacrtaj sve detektirane osobe
SAVE_TORSO_CROPS = True
MAX_TORSO_CROPS = 10          # koliko cropova spremiti po klipu
TORSO_SHARPNESS_MIN = 35.0    # filter: preniska oštrina = blur (heuristika)
PICK_TORSO_STRATEGY = "area"  # "area" ili "sharpness" ili "hybrid"

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

        # Ako ima alpha kanal, makni ga
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
    """Veća vrijednost = oštrije (manje blur)."""
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

    # unique, stabilno
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

    left_team, left_score = match_logo(left_crop)
    right_team, right_score = match_logo(right_crop)

    detected = []
    if left_team:
        detected.append(left_team)
    if right_team and right_team != left_team:
        detected.append(right_team)

    return detected, "logo"

# ===== PLAYER DETECTION + HEURISTIC SHOOTER =====
def detect_players_and_shooter(frame):
    """
    Vraća:
      - players: lista (area, conf, (x1,y1,x2,y2))
      - shooter_bbox: bbox najveće osobe (baseline heuristika)
    """
    results = yolo(frame)[0]

    players = []
    for box in results.boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        if cls == 0 and conf > CONF_THRESHOLD:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            area = (x2 - x1) * (y2 - y1)
            players.append((area, conf, (int(x1), int(y1), int(x2), int(y2))))

    if not players:
        return [], None

    players_sorted = sorted(players, key=lambda t: t[0], reverse=True)
    shooter_bbox = players_sorted[0][2]
    return players_sorted, shooter_bbox

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
    """Vrati (best_num, count, total)"""
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
            match = db[
                (db["TEAM_ABBREVIATION"] == team) &
                (db["JERSEY_NUMBER"] == num)
            ]
            if len(match) == 1:
                return int(match.iloc[0]["PERSON_ID"])
    return None

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

    # spremanje najboljih torso cropova
    torso_pool = []  # list of dict: {"score":..., "sharp":..., "area":..., "img":..., "frame_i":...}

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
        teams_votes = Counter()
        team_source = ""
        if frame_i < TEAM_VOTE_FRAMES:
            t, src = extract_teams(frame)
            if t:
                for x in t:
                    teams_votes[x] += 1
                teams_source = src
        if not teams and teams_votes:
            teams = [k for k, _ in teams_votes.most_common(2)]
        players, shooter_bbox = detect_players_and_shooter(frame)

        shooter_torso = None
        shooter_nums = []

        if shooter_bbox:
            x1, y1, x2, y2 = shooter_bbox
            torso = frame[y1:int(y1 + (y2 - y1) * 0.6), x1:x2]
            if torso.size > 0:
                shooter_torso = torso
                shooter_nums = extract_jersey_number(torso)
                jersey_candidates.extend(shooter_nums)

                # bonus: spremi crop kandidata (filtriraj blur)
                if SAVE_TORSO_CROPS:
                    sharp = laplacian_sharpness(torso)
                    area = torso.shape[0] * torso.shape[1]
                    if sharp >= TORSO_SHARPNESS_MIN:
                        if PICK_TORSO_STRATEGY == "sharpness":
                            score = sharp
                        elif PICK_TORSO_STRATEGY == "hybrid":
                            score = sharp * (area ** 0.5)
                        else:
                            score = area  # default "area"
                        torso_pool.append({
                            "score": score,
                            "sharp": sharp,
                            "area": area,
                            "img": torso.copy(),
                            "frame_i": frame_i,
                            "nums": shooter_nums
                        })

        # DEBUG OVERLAY
        if debug_writer is not None:
            overlay = frame.copy()

            # draw all players
            if DRAW_ALL_PLAYERS and players:
                for _, conf, (px1, py1, px2, py2) in players:
                    cv2.rectangle(overlay, (px1, py1), (px2, py2), (0, 255, 0), 2)
                    draw_label(overlay, f"{conf:.2f}", (px1, max(20, py1 - 8)), scale=0.7)

            # draw shooter
            if shooter_bbox:
                sx1, sy1, sx2, sy2 = shooter_bbox
                cv2.rectangle(overlay, (sx1, sy1), (sx2, sy2), (0, 0, 255), 3)
                draw_label(overlay, "SHOOTER", (sx1, max(20, sy1 - 12)), scale=0.9)

            # top-left info
            info1 = f"teams({teams_source}): {','.join(teams) if teams else 'NA'}"
            best_num, best_cnt, best_total = majority_vote(jersey_candidates)
            info2 = f"jersey_vote: {best_num if best_num else 'NA'} ({best_cnt}/{best_total})"
            info3 = f"frame: {frame_i}"

            draw_label(overlay, info1, (20, 40), scale=0.8)
            draw_label(overlay, info2, (20, 75), scale=0.8)
            draw_label(overlay, info3, (20, 110), scale=0.8)

            # small thumbnail of torso (optional)
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

    # Majority vote broja za informaciju (lookup i dalje pokušava s listom)
    best_num, best_cnt, best_total = majority_vote(jersey_candidates)

    person_id = lookup_person(teams, jersey_candidates)

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

        # also save a tiny manifest for crops
        manifest_fp = torso_saved_dir / "crops_manifest.txt"
        with open(manifest_fp, "w", encoding="utf-8") as f:
            f.write(f"video: {video_path}\n")
            f.write(f"teams({teams_source}): {teams}\n")
            f.write(f"best_num_vote: {best_num} ({best_cnt}/{best_total})\n")
            f.write("Top crops:\n")
            for i, item in enumerate(top, start=1):
                f.write(f"{i:02d} frame={item['frame_i']} sharp={item['sharp']:.2f} area={item['area']} nums={item['nums']}\n")

    return {
        "game_folder": video_path.parent.name,
        "clip": video_path.name,
        "teams_source": teams_source,
        "detected_teams": ",".join(teams) if teams else "",
        "jersey_candidates": ",".join(jersey_candidates),
        "jersey_vote": str(best_num) if best_num is not None else "",
        "jersey_vote_cnt": best_cnt,
        "jersey_vote_total": best_total,
        "resolved_person_id": person_id,
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