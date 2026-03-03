import cv2
import easyocr
import re
import pandas as pd
from pathlib import Path
from ultralytics import YOLO
import numpy as np

# ===== CONFIG =====
CLIPS_ROOT = "python/data/clips"
OSNOVNO_CSV = "osnovno_nba.csv"
OUTPUT_CSV = "pipeline_results.csv"
LOGO_DIR = "python/team_logos"

SCORING_WINDOW_SEC = 2
CONF_THRESHOLD = 0.3

# Scoreboard crop (donjih 25% framea)
SCOREBOARD_Y0_RATIO = 0.75

# Logo zone unutar scoreboarda (lijevih/desnih ~22% širine)
LOGO_SIDE_W_RATIO = 0.22

# Threshold za prihvaćanje logo matcha
LOGO_MATCH_THRESHOLD = 0.35

# ===== LOAD MODELS =====
print("Loading YOLO...")
yolo = YOLO("yolov8n.pt")
yolo.to("cuda")

print("Loading OCR...")
ocr_reader = easyocr.Reader(["en"], gpu=True)

# ===== LOAD DATABASE =====
db = pd.read_csv(OSNOVNO_CSV)

# normalizacija (case-insensitive)
db["TEAM_ABBREVIATION"] = db["TEAM_ABBREVIATION"].astype(str).str.strip().str.upper()
db["JERSEY_NUMBER"] = db["JERSEY_NUMBER"].astype(str).str.strip()

# valid team abbrevs iz baze (za filtriranje OCR smeća tipa "TO", "1ST", itd.)
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

        # Ako ima alpha kanal, makni ga (pretvori u BGR)
        if len(img.shape) == 3 and img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # malo normalizacije
        gray = cv2.equalizeHist(gray)

        templates[team] = gray

    print(f"Loaded {len(templates)} logo templates from {logo_dir}")
    return templates

logo_templates = load_logo_templates(LOGO_DIR)

# ===== FUNCTIONS =====
def extract_team_abbrev_ocr(scoreboard_bgr):
    """Vrati listu team abbrev iz OCR-a (filtrirano na valid_teams)."""
    gray = cv2.cvtColor(scoreboard_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    texts = ocr_reader.readtext(gray, detail=0)

    teams = []
    for t in texts:
        matches = re.findall(r"\b[A-Z]{2,3}\b", str(t).upper())
        teams.extend(matches)

    # filtriraj na poznate teamove iz baze
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
    """Vrati (team, score) za najbolji template match."""
    if not logo_templates:
        return None, 0.0

    crop = cv2.cvtColor(logo_crop_bgr, cv2.COLOR_BGR2GRAY)
    crop = cv2.equalizeHist(crop)

    best_team, best_score = None, -1.0

    # Radimo match tako da template resizeamo na crop size
    h, w = crop.shape[:2]
    if h < 20 or w < 20:
        return None, 0.0

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
    """
    1) crop scoreboard (donjih 25%)
    2) OCR -> ako nađe >=2 valid team abbrev, uzmi prva 2
    3) inače logo matching na lijevoj i desnoj strani scoreboarda
    """
    h, w = frame.shape[:2]
    y0 = int(h * SCOREBOARD_Y0_RATIO)
    scoreboard = frame[y0:h, :]

    # 1) OCR
    teams_ocr = extract_team_abbrev_ocr(scoreboard)
    if len(teams_ocr) >= 2:
        return teams_ocr[:2], "ocr"

    # 2) logo matching fallback
    side_w = int(w * LOGO_SIDE_W_RATIO)
    left_crop = scoreboard[:, :side_w]
    right_crop = scoreboard[:, w - side_w :]

    left_team, left_score = match_logo(left_crop)
    right_team, right_score = match_logo(right_crop)

    detected = []
    if left_team:
        detected.append(left_team)
    if right_team and right_team != left_team:
        detected.append(right_team)

    # ako imamo barem 2, super; ako 1, vraćamo 1 (pa lookup može pokušati s jednim)
    return detected, "logo"


def detect_shooter(frame):
    results = yolo(frame)[0]

    players = []
    for box in results.boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        if cls == 0 and conf > CONF_THRESHOLD:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            area = (x2 - x1) * (y2 - y1)
            players.append((area, (int(x1), int(y1), int(x2), int(y2))))

    if not players:
        return None

    players.sort(reverse=True)
    return players[0][1]


def extract_jersey_number(crop):
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    texts = ocr_reader.readtext(gray, detail=0)

    numbers = []
    for t in texts:
        matches = re.findall(r"\d{1,2}", str(t))
        numbers.extend(matches)

    return numbers


def lookup_person(team_list, jersey_numbers):
    # normalizacija timova
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


def process_clip(video_path: Path):
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    start_frame = max(0, total_frames - int(fps * SCORING_WINDOW_SEC))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    teams = []
    teams_source = ""
    jersey_candidates = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if not teams:
            teams, teams_source = extract_teams(frame)

        bbox = detect_shooter(frame)
        if bbox:
            x1, y1, x2, y2 = bbox
            torso = frame[y1:int(y1 + (y2 - y1) * 0.6), x1:x2]
            nums = extract_jersey_number(torso)
            jersey_candidates.extend(nums)

    cap.release()

    person_id = lookup_person(teams, jersey_candidates)

    return {
        "game_folder": video_path.parent.name,
        "clip": video_path.name,
        "teams_source": teams_source,
        "detected_teams": ",".join(teams) if teams else "",
        "jersey_candidates": ",".join(jersey_candidates),
        "resolved_person_id": person_id,
    }


# ===== RUN ALL =====
results = []

for game_dir in Path(CLIPS_ROOT).iterdir():
    if not game_dir.is_dir():
        continue

    for video_file in sorted(game_dir.glob("*.mp4")):
        print(f"Processing: {video_file}")
        row = process_clip(video_file)
        print(f" → teams({row['teams_source']}): {row['detected_teams']} | PERSON_ID: {row['resolved_person_id']}")
        results.append(row)

# ===== SAVE CSV =====
df = pd.DataFrame(results)
df.to_csv(OUTPUT_CSV, index=False)

# ===== STATS =====
total = len(df)
resolved = df["resolved_person_id"].notna().sum()
failed = total - resolved
success_rate = (resolved / total * 100) if total > 0 else 0

# koliko je puta OCR vs logo
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