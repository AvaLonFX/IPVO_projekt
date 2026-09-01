import os
import cv2
import easyocr
import re
import pandas as pd
from pathlib import Path
from ultralytics import YOLO
import numpy as np
from collections import Counter

# =========================
# ===== CONFIG ============
# =========================
CLIPS_ROOT = "python/data/clips"
OSNOVNO_CSV = "osnovno_nba.csv"
LOGO_DIR = "python/team_logos"

# GT file (clip_id, player_id, event)
GT_CSV_CANDIDATES = [
    "python/analiza/player_highlights_rows.csv",
    "player_highlights_rows.csv",
    "python/player_highlights_rows.csv",
]

ANALYSE_ROOT = "python/analiza"
OUTPUT_CSV = str(Path(ANALYSE_ROOT) / "pipeline_results.csv")
DEBUG_VIDEO_DIR = Path(ANALYSE_ROOT) / "debug_videos"
TORSO_DIR = Path(ANALYSE_ROOT) / "torso_crops"

SCORING_WINDOW_SEC = 4
CONF_THRESHOLD = 0.30

# Team vote
TEAM_VOTE_FRAMES = 16

# Scoreboard / logo crop tuning
SCOREBOARD_Y0_RATIO = 0.68
LOGO_SIDE_W_RATIO = 0.32
LOGO_MATCH_THRESHOLD = 0.35

# Player OCR candidates
TOPK_PLAYERS_FOR_JERSEY = 5

# Early stop
EARLY_STOP_ON_MATCH = True
MIN_TRACK_SAMPLES_BEFORE_STOP = 6  # broj OCR sampleova unutar najboljeg tracka

# Debug / analysis
SAVE_DEBUG_VIDEO = True
DEBUG_FPS = 30
DRAW_ALL_PLAYERS = True
SAVE_TORSO_CROPS = True
MAX_TORSO_CROPS = 10
TORSO_SHARPNESS_MIN = 45.0
PICK_TORSO_STRATEGY = "area"  # "area" / "sharpness" / "hybrid"

# Tracking
TRACK_IOU_TH = 0.30
TRACK_MAX_AGE = 12  # koliko frameova track smije "nestati"

# =========================
# ===== INIT DIRS =========
# =========================
os.makedirs(ANALYSE_ROOT, exist_ok=True)
os.makedirs(DEBUG_VIDEO_DIR, exist_ok=True)
os.makedirs(TORSO_DIR, exist_ok=True)

# =========================
# ===== LOAD MODELS =======
# =========================
print("Loading YOLO...")
yolo = YOLO("yolov8s.pt")
yolo.to("cuda")

print("Loading OCR...")
ocr_reader = easyocr.Reader(["en"], gpu=True)

# =========================
# ===== LOAD DATABASE =====
# =========================
db = pd.read_csv(OSNOVNO_CSV)

# normalize columns if present
for col in ["TEAM_ABBREVIATION", "JERSEY_NUMBER"]:
    if col in db.columns:
        db[col] = db[col].astype(str).str.strip()

if "TEAM_ABBREVIATION" in db.columns:
    db["TEAM_ABBREVIATION"] = db["TEAM_ABBREVIATION"].astype(str).str.upper()

if "JERSEY_NUMBER" in db.columns:
    # normalize: "08" -> "8"
    def _norm_num(x):
        s = str(x).strip()
        if s == "" or s.lower() == "nan":
            return ""
        try:
            return str(int(s))
        except:
            return s
    db["JERSEY_NUMBER"] = db["JERSEY_NUMBER"].apply(_norm_num)

# choose which ID column to return (to match GT)
PREFERRED_ID_COLS = ["PLAYER_ID", "player_id", "PERSON_ID", "person_id", "NBA_PLAYER_ID", "ID"]
RETURN_ID_COL = None
for c in PREFERRED_ID_COLS:
    if c in db.columns:
        RETURN_ID_COL = c
        break

if RETURN_ID_COL is None:
    raise RuntimeError(
        f"[FATAL] Could not find any ID column in DB. Tried: {PREFERRED_ID_COLS}\n"
        f"DB columns: {list(db.columns)}"
    )

print(f"[INFO] Using DB return id column: {RETURN_ID_COL}")

valid_teams = set(db["TEAM_ABBREVIATION"].dropna().astype(str).str.strip().str.upper().unique().tolist()) \
    if "TEAM_ABBREVIATION" in db.columns else set()

# =========================
# ===== LOAD GT ===========
# =========================
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
    if "clip_id" not in gt.columns or "player_id" not in gt.columns or "event" not in gt.columns:
        print("[WARN] GT file missing required columns (clip_id, player_id, event).")
        return None

    gt = gt.copy()
    gt["clip_id"] = pd.to_numeric(gt["clip_id"], errors="coerce").astype("Int64")
    gt["player_id"] = pd.to_numeric(gt["player_id"], errors="coerce").astype("Int64")
    gt["event"] = gt["event"].astype(str).str.strip().str.lower()
    return gt

gt_df = load_gt()
if gt_df is not None:
    # sanity overlap check
    db_ids = set(pd.to_numeric(db[RETURN_ID_COL], errors="coerce").dropna().astype(int).tolist())
    gt_ids = set(pd.to_numeric(gt_df["player_id"], errors="coerce").dropna().astype(int).tolist())
    inter = len(db_ids.intersection(gt_ids))
    print(f"[SANITY] {RETURN_ID_COL} ∩ GT player_id = {inter} (db={len(db_ids)}, gt={len(gt_ids)})")
    if inter == 0:
        print("[WARN] Zero overlap between DB IDs and GT IDs. "
              "Točnost će biti 0% dok ne koristiš kompatibilan ID stupac ili mapping.")

# =========================
# ===== LOAD LOGOS ========
# =========================
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

# =========================
# ===== UTILS =============
# =========================
def safe_slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_\-]+", "_", str(s))

def laplacian_sharpness(bgr_img) -> float:
    gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())

def draw_label(img, text, org, scale=0.7, thickness=2):
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, (255, 255, 255), thickness, cv2.LINE_AA)

def infer_clip_id_from_filename(video_path: Path):
    nums = re.findall(r"\d+", video_path.stem)
    if not nums:
        return None
    return int(nums[-1])

def iou_xyxy(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    aa = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    bb = max(0, bx2 - bx1) * max(0, by2 - by1)
    denom = aa + bb - inter
    if denom <= 0:
        return 0.0
    return inter / denom

# =========================
# ===== TEAM DETECTION =====
# =========================
def extract_team_abbrev_ocr(scoreboard_bgr):
    gray = cv2.cvtColor(scoreboard_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    # allowlist letters to reduce junk
    texts = ocr_reader.readtext(gray, detail=0, allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    teams = []
    for t in texts:
        matches = re.findall(r"\b[A-Z]{2,3}\b", str(t).upper())
        teams.extend(matches)
    teams = [t for t in teams if t in valid_teams]
    # unique preserve order
    seen, out = set(), []
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
    """
    Kombinira OCR + logo u istom frameu i vraća listu kandidata i izvore.
    """
    h, w = frame.shape[:2]
    y0 = int(h * SCOREBOARD_Y0_RATIO)
    scoreboard = frame[y0:h, :]

    teams = []
    sources = []

    # OCR candidates
    ocr_teams = extract_team_abbrev_ocr(scoreboard)
    for t in ocr_teams:
        teams.append(t)
        sources.append("ocr")

    # Logo candidates (always attempt)
    side_w = int(w * LOGO_SIDE_W_RATIO)
    left_crop = scoreboard[:, :side_w]
    right_crop = scoreboard[:, w - side_w:]

    left_team, _ = match_logo(left_crop)
    right_team, _ = match_logo(right_crop)

    for t in [left_team, right_team]:
        if t and t not in teams:
            teams.append(t)
            sources.append("logo")

    return teams, sources

# =========================
# ===== PLAYER DETECTION ===
# =========================
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

# =========================
# ===== JERSEY OCR =========
# =========================
def preprocess_jersey(crop_bgr):
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    # upscale for OCR
    gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    thr = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31, 5
    )

    kernel = np.ones((2, 2), np.uint8)
    thr = cv2.morphologyEx(thr, cv2.MORPH_CLOSE, kernel, iterations=1)
    return thr

def extract_jersey_number(crop):
    if crop is None or crop.size == 0:
        return []

    img = preprocess_jersey(crop)
    texts = ocr_reader.readtext(
        img,
        detail=0,
        allowlist="0123456789"
    )

    numbers = []
    for t in texts:
        matches = re.findall(r"\d{1,2}", str(t))
        for m in matches:
            try:
                v = int(m)
                if 0 <= v <= 99:
                    numbers.append(str(v))  # normalize
            except:
                pass
    return numbers

def majority_vote(numbers):
    if not numbers:
        return None, 0, 0
    c = Counter(numbers)
    best, cnt = c.most_common(1)[0]
    return best, cnt, sum(c.values())

# =========================
# ===== LOOKUP =============
# =========================
def lookup_person(team_list, jersey_numbers):
    team_list = [str(t).strip().upper() for t in team_list if t and str(t).strip() != ""]
    jersey_numbers = [str(n).strip() for n in jersey_numbers if n and str(n).strip() != ""]

    for team in team_list:
        for num in jersey_numbers:
            match = db[(db["TEAM_ABBREVIATION"] == team) & (db["JERSEY_NUMBER"] == num)]
            if len(match) == 1:
                return int(pd.to_numeric(match.iloc[0][RETURN_ID_COL], errors="coerce"))
    return None

def lookup_person_with_vote_first(teams, jersey_candidates):
    best_num, _, _ = majority_vote(jersey_candidates)
    if best_num:
        pid = lookup_person(teams, [best_num])
        if pid is not None:
            return pid, best_num, True
    pid = lookup_person(teams, jersey_candidates)
    return pid, best_num, False

# =========================
# ===== TRACKING ===========
# =========================
def update_tracks(tracks, detections, frame_i):
    """
    tracks: dict tid -> {bbox, last_seen, nums(list), confs(list), areas(list)}
    detections: list of (area, conf, bbox)
    """
    assigned = set()
    det_to_tid = {}

    # match detections to existing tracks by IOU
    for di, (area, conf, bbox) in enumerate(detections):
        best_tid, best_iou = None, 0.0
        for tid, tr in tracks.items():
            iou = iou_xyxy(bbox, tr["bbox"])
            if iou > best_iou:
                best_iou = iou
                best_tid = tid
        if best_tid is not None and best_iou >= TRACK_IOU_TH and best_tid not in assigned:
            det_to_tid[di] = best_tid
            assigned.add(best_tid)

    # update matched
    for di, tid in det_to_tid.items():
        area, conf, bbox = detections[di]
        tr = tracks[tid]
        tr["bbox"] = bbox
        tr["last_seen"] = frame_i
        tr["confs"].append(conf)
        tr["areas"].append(area)

    # create new tracks for unmatched
    next_tid = (max(tracks.keys()) + 1) if tracks else 1
    for di, (area, conf, bbox) in enumerate(detections):
        if di in det_to_tid:
            continue
        tracks[next_tid] = {
            "bbox": bbox,
            "last_seen": frame_i,
            "nums": [],
            "confs": [conf],
            "areas": [area],
        }
        det_to_tid[di] = next_tid
        next_tid += 1

    # remove stale tracks
    stale = [tid for tid, tr in tracks.items() if (frame_i - tr["last_seen"]) > TRACK_MAX_AGE]
    for tid in stale:
        del tracks[tid]

    return det_to_tid

def choose_best_track(tracks):
    """
    Heuristika:
    - najviše OCR sampleova (len(nums))
    - tie-break: veća prosječna area
    """
    best_tid = None
    best_key = None
    for tid, tr in tracks.items():
        nnums = len(tr["nums"])
        mean_area = float(np.mean(tr["areas"])) if tr["areas"] else 0.0
        key = (nnums, mean_area)
        if best_key is None or key > best_key:
            best_key = key
            best_tid = tid
    return best_tid

# =========================
# ===== MAIN PER-CLIP =====
# =========================
def process_clip(video_path: Path):
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # last N seconds
    start_frame = max(0, total_frames - int(fps * SCORING_WINDOW_SEC))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    teams = []
    teams_source = ""

    # team voting
    teams_votes = Counter()
    src_votes = Counter()

    # track-based jersey votes
    tracks = {}
    jersey_candidates_global = []  # only for logging/debug
    best_track_tid_at_end = None
    best_track_nums = []

    # torso crops pool
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

        # TEAM VOTE (first TEAM_VOTE_FRAMES of this window)
        if frame_i < TEAM_VOTE_FRAMES:
            t_list, src_list = extract_teams(frame)
            for t, src in zip(t_list, src_list):
                if t:
                    teams_votes[t] += 1
                    src_votes[src] += 1

        # lock teams when stable-ish
        if not teams and len(teams_votes) >= 2 and frame_i >= 2:
            teams = [k for k, _ in teams_votes.most_common(2)]
            teams_source = src_votes.most_common(1)[0][0] if src_votes else ""

        players = detect_players(frame)
        top_players = players[:TOPK_PLAYERS_FOR_JERSEY]

        # update tracks using detections (only topK)
        det_to_tid = update_tracks(tracks, top_players, frame_i)

        candidate_infos = []
        for rank, (area, conf, bbox) in enumerate(top_players, start=1):
            x1, y1, x2, y2 = bbox
            torso = frame[y1:int(y1 + (y2 - y1) * 0.60), x1:x2]
            nums = []

            if torso.size > 0:
                nums = extract_jersey_number(torso)

                # assign nums to track
                di = rank - 1
                tid = det_to_tid.get(di)
                if tid is not None and nums:
                    tracks[tid]["nums"].extend(nums)
                    jersey_candidates_global.extend(nums)

                # save torso crops (filtered)
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

            candidate_infos.append((rank, conf, bbox, nums))

        # pick best track so far
        best_tid = choose_best_track(tracks)
        best_nums = tracks[best_tid]["nums"] if best_tid is not None else []
        best_num_vote, best_cnt, best_total = majority_vote(best_nums)

        # EARLY STOP when we have teams and enough samples inside best track
        if EARLY_STOP_ON_MATCH and teams and best_total >= MIN_TRACK_SAMPLES_BEFORE_STOP:
            pid, _, used_vote = lookup_person_with_vote_first(teams, best_nums)
            if pid is not None:
                if debug_writer is not None:
                    overlay = frame.copy()
                    for rank, conf, bbox, nums in candidate_infos:
                        x1, y1, x2, y2 = bbox
                        cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 200, 0), 2)
                        label = f"K{rank} {conf:.2f}"
                        if nums:
                            label += f" nums:{','.join(nums)}"
                        draw_label(overlay, label, (x1, max(20, y1 - 10)), scale=0.65)

                    info1 = f"teams({teams_source}): {','.join(teams) if teams else 'NA'}"
                    info2 = f"track#{best_tid} jersey_vote: {best_num_vote if best_num_vote else 'NA'} ({best_cnt}/{best_total})"
                    info3 = f"EARLY STOP pid={pid} (vote_first={used_vote})"
                    draw_label(overlay, info1, (20, 40), scale=0.8)
                    draw_label(overlay, info2, (20, 75), scale=0.8)
                    draw_label(overlay, info3, (20, 110), scale=0.8)
                    debug_writer.write(overlay)
                best_track_tid_at_end = best_tid
                best_track_nums = best_nums
                break

        # DEBUG overlay
        if debug_writer is not None:
            overlay = frame.copy()

            if DRAW_ALL_PLAYERS and players:
                for _, conf, (px1, py1, px2, py2) in players:
                    cv2.rectangle(overlay, (px1, py1), (px2, py2), (0, 255, 0), 2)
                    draw_label(overlay, f"{conf:.2f}", (px1, max(20, py1 - 8)), scale=0.7)

            for rank, conf, bbox, nums in candidate_infos:
                x1, y1, x2, y2 = bbox
                cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 200, 0), 2)
                label = f"K{rank} {conf:.2f}"
                if nums:
                    label += f" nums:{','.join(nums)}"
                draw_label(overlay, label, (x1, max(20, y1 - 10)), scale=0.65)

            info1 = f"teams({teams_source}): {','.join(teams) if teams else 'NA'}"
            info2 = f"track#{best_tid} jersey_vote: {best_num_vote if best_num_vote else 'NA'} ({best_cnt}/{best_total})"
            info3 = f"frame: {frame_i}"
            draw_label(overlay, info1, (20, 40), scale=0.8)
            draw_label(overlay, info2, (20, 75), scale=0.8)
            draw_label(overlay, info3, (20, 110), scale=0.8)

            debug_writer.write(overlay)

        frame_i += 1

    cap.release()
    if debug_writer is not None:
        debug_writer.release()

    # finalize teams if still empty
    if not teams and teams_votes:
        teams = [k for k, _ in teams_votes.most_common(2)]
        teams_source = src_votes.most_common(1)[0][0] if src_votes else ""

    # finalize best track at end if not early-stopped
    if best_track_tid_at_end is None:
        best_track_tid_at_end = choose_best_track(tracks)
        best_track_nums = tracks[best_track_tid_at_end]["nums"] if best_track_tid_at_end is not None else []

    # final resolve
    person_id, best_num_lookup, used_vote = lookup_person_with_vote_first(teams, best_track_nums)
    best_num_vote, best_cnt, best_total = majority_vote(best_track_nums)

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
            f.write(f"best_track: {best_track_tid_at_end}\n")
            f.write(f"best_track_vote: {best_num_vote} ({best_cnt}/{best_total})\n")
            f.write(f"resolved_id({RETURN_ID_COL}): {person_id}\n")
            f.write("Top crops:\n")
            for i, item in enumerate(top, start=1):
                f.write(f"{i:02d} frame={item['frame_i']} sharp={item['sharp']:.2f} area={item['area']} nums={item['nums']}\n")

    return {
        "game_folder": video_path.parent.name,
        "clip": video_path.name,
        "teams_source": teams_source,
        "detected_teams": ",".join(teams) if teams else "",
        "best_track_id": best_track_tid_at_end if best_track_tid_at_end is not None else "",
        "jersey_candidates_global": ",".join(jersey_candidates_global),
        "best_track_nums": ",".join(best_track_nums),
        "jersey_vote": str(best_num_vote) if best_num_vote is not None else "",
        "jersey_vote_cnt": best_cnt,
        "jersey_vote_total": best_total,
        "resolved_id": person_id,  # <-- ovo je u namespaceu RETURN_ID_COL
        "used_vote_first": bool(used_vote),
        "debug_video_path": str(debug_out_path) if debug_out_path else "",
        "torso_crops_dir": str(torso_saved_dir) if torso_saved_dir else "",
    }

# =========================
# ===== RUN ALL ============
# =========================
results = []

for game_dir in Path(CLIPS_ROOT).iterdir():
    if not game_dir.is_dir():
        continue

    for video_file in sorted(game_dir.glob("*.mp4")):
        clip_id = infer_clip_id_from_filename(video_file)
        print(f"Processing clip_id={clip_id}: {video_file}")
        row = process_clip(video_file)
        row["clip_id"] = clip_id  # inferred from filename
        results.append(row)

        print(
            f" → teams({row['teams_source']}): {row['detected_teams']} "
            f"| track={row['best_track_id']} vote: {row['jersey_vote']} ({row['jersey_vote_cnt']}/{row['jersey_vote_total']}) "
            f"| resolved_id: {row['resolved_id']}"
        )

df = pd.DataFrame(results)

# drop rows without clip_id (can't eval/merge)
df["clip_id"] = pd.to_numeric(df["clip_id"], errors="coerce").astype("Int64")

# =========================
# ===== ADD GT + EVAL ======
# =========================
if gt_df is not None:
    df = df.merge(
        gt_df[["clip_id", "player_id", "event"]],
        on="clip_id",
        how="left"
    )
    df = df.rename(columns={"player_id": "gt_player_id"})
    df["gt_player_id"] = pd.to_numeric(df["gt_player_id"], errors="coerce").astype("Int64")
    df["resolved_id"] = pd.to_numeric(df["resolved_id"], errors="coerce").astype("Int64")

    df["is_correct"] = (
        (df["resolved_id"] == df["gt_player_id"])
        & df["resolved_id"].notna()
        & df["gt_player_id"].notna()
    )
else:
    df["gt_player_id"] = pd.Series([pd.NA] * len(df), dtype="Int64")
    df["event"] = ""
    df["is_correct"] = False

df.to_csv(OUTPUT_CSV, index=False)

# =========================
# ===== STATS ==============
# =========================
total = len(df)
resolved = int(df["resolved_id"].notna().sum())
failed = total - resolved
success_rate = (resolved / total * 100) if total > 0 else 0.0

ocr_used = int((df["teams_source"].astype(str) == "ocr").sum())
logo_used = int((df["teams_source"].astype(str) == "logo").sum())

correct = int(df["is_correct"].sum()) if "is_correct" in df.columns else 0
accuracy = (correct / total * 100) if total > 0 else 0.0
precision = (correct / resolved * 100) if resolved > 0 else 0.0

print("\n===== PIPELINE SUMMARY =====")
print(f"Total clips: {total}")
print(f"Resolved ID (coverage): {resolved}")
print(f"Failed: {failed}")
print(f"Coverage: {success_rate:.2f}%")
print(f"OCR used:  {ocr_used}")
print(f"Logo used: {logo_used}")
print(f"Saved results to: {OUTPUT_CSV}")
print(f"DB return id column: {RETURN_ID_COL}")

if gt_df is not None:
    print("\n===== EVALUATION vs GT =====")
    print(f"Correct: {correct}")
    print(f"Accuracy (correct/total): {accuracy:.2f}%")
    print(f"Precision (correct/resolved): {precision:.2f}%")

    df_ev = df[df["event"].notna() & (df["event"].astype(str).str.len() > 0)].copy()
    if len(df_ev):
        for ev in sorted(df_ev["event"].astype(str).str.lower().unique()):
            sub = df_ev[df_ev["event"].astype(str).str.lower() == ev]
            t = len(sub)
            r = int(sub["resolved_id"].notna().sum())
            c = int(sub["is_correct"].sum())
            cov = (r / t * 100) if t else 0.0
            acc = (c / t * 100) if t else 0.0
            prec = (c / r * 100) if r else 0.0
            print(f"\n--- EVENT: {ev} ---")
            print(f"Total: {t}")
            print(f"Resolved: {r}  (coverage {cov:.2f}%)")
            print(f"Correct:  {c}  (accuracy {acc:.2f}%, precision {prec:.2f}%)")

print(f"\nDebug videos: {DEBUG_VIDEO_DIR}")
print(f"Torso crops:  {TORSO_DIR}")