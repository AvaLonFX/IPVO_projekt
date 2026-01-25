import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # project root (prilagodi ako treba)

def run(cmd: str):
    print(f"\n▶ {cmd}")
    r = subprocess.run(cmd, shell=True, cwd=str(ROOT))
    if r.returncode != 0:
        print(f"❌ Failed: {cmd}")
        sys.exit(r.returncode)

def main():
    # 1) schedule
    run("node components/scripte/fetchNBASchedule.js")

    # 2) player stats/bio
    run("node components/scripte/updateNBAData.js")

    # 3) availability (ESPN)
    run("python components/scripte/injury_test/upsert_team_availability_espn.py --limit 300")

    # 4) predictions (LR + XGB upsert u GameOdds)
    run("python components/scripte/predict_game_odds_final.py --limit 300")

    print("\n✅ Daily pipeline finished.")

if __name__ == "__main__":
    main()
