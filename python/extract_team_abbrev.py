import cv2
import easyocr
import re
import numpy as np

reader = easyocr.Reader(['en'], gpu=True)

def extract_team_abbrev(frame_path):
    frame = cv2.imread(frame_path)
    h, w = frame.shape[:2]

    # Crop bottom 25% (scoreboard zona)
    crop = frame[int(h*0.75):h, :]

    # Pojačaj kontrast
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    results = reader.readtext(gray, detail=0)

    # Regex: 2-3 uppercase letters
    teams = []
    for text in results:
        matches = re.findall(r'\b[A-Z]{2,3}\b', text)
        teams.extend(matches)

    # ukloni duplikate
    teams = list(set(teams))

    return teams


if __name__ == "__main__":
    teams = extract_team_abbrev(
    r"python\data\clips\2026-02-28-HOUMIA\01_frames\0001.jpg"
    )
    print("Detected team abbrev:", teams)