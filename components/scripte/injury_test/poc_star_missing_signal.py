import time
import random
import pandas as pd
from collections import defaultdict

from nba_api.stats.endpoints import leaguegamefinder, boxscoretraditionalv2

SEASON = "2023-24"
N_GAMES = 80          # povećaj na 200 ako želiš (sporije je)
SLEEP = 0.6           # nba_api rate-limit friendly

def did_play(row) -> int:
    min_val = row.get("MIN", None)
    if pd.isna(min_val) or min_val in [None, "", "0", "0:00"]:
        return 0
    return 1

def get_unique_games(season=SEASON):
    df = leaguegamefinder.LeagueGameFinder(
        season_nullable=season,
        season_type_nullable="Regular Season"
    ).get_data_frames()[0]

    game_ids = df["GAME_ID"].astype(str).unique().tolist()
    return game_ids

def fetch_box(game_id: str) -> pd.DataFrame:
    bs = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id)
    players = bs.get_data_frames()[0]  # PlayerStats
    return players

def main():
    game_ids = get_unique_games()
    random.shuffle(game_ids)
    game_ids = game_ids[:N_GAMES]
    print("Using games:", len(game_ids))

    # 1) Prvo skupimo (team_id -> player_id -> minutes_total) da definiramo top3 po timu
    minutes_by_team_player = defaultdict(float)

    all_boxes = {}  # cache boxscore df
    for i, gid in enumerate(game_ids, 1):
        players = fetch_box(gid)
        all_boxes[gid] = players

        # parsiraj minute "mm:ss" -> float minutes
        for _, r in players.iterrows():
            team_id = r.get("TEAM_ID")
            pid = r.get("PLAYER_ID")
            min_str = r.get("MIN", None)
            if pd.isna(min_str) or min_str in [None, "", "0", "0:00"]:
                continue
            if isinstance(min_str, str) and ":" in min_str:
                mm, ss = min_str.split(":")
                mins = float(mm) + float(ss)/60.0
            else:
                mins = float(min_str)

            minutes_by_team_player[(int(team_id), int(pid))] += mins

        if i % 10 == 0:
            print(f"Fetched {i}/{len(game_ids)} boxes...")
        time.sleep(SLEEP)

    # top3 po timu
    team_to_players = defaultdict(list)
    for (tid, pid), m in minutes_by_team_player.items():
        team_to_players[tid].append((pid, m))

    team_top3 = {}
    for tid, arr in team_to_players.items():
        arr_sorted = sorted(arr, key=lambda x: x[1], reverse=True)
        team_top3[tid] = [pid for pid, _ in arr_sorted[:3]]

    # 2) Sad za svaki game računamo missing i home_win
    rows = []
    for gid in game_ids:
        players = all_boxes[gid].copy()
        # TEAM_ABBREVIATION je tu, ali home/away bolje iz MATCHUP-a; no u boxscoreu nema matchup
        # zato ćemo inferati home/away iz START_POSITION? ne, bolje:
        # leaguegamefinder ima matchup, ali za POC uzmimo:
        # -> home tim je onaj koji ima više "vs." u MATCHUP-u; preskočit ćemo to i fokusirat se na missing signal općenito
        # pa računamo missing za oba tima i koristimo "home_win" iz leaguegamefinder kasnije u pravom datasetu

        for tid in players["TEAM_ID"].dropna().unique():
            tid = int(tid)
            top3 = team_top3.get(tid, [])
            if not top3:
                continue
            sub = players[players["TEAM_ID"] == tid]
            played_map = {int(r["PLAYER_ID"]): did_play(r) for _, r in sub.iterrows() if pd.notna(r.get("PLAYER_ID"))}

            missing = 0
            for pid in top3:
                if played_map.get(pid, 0) == 0:
                    missing += 1

            rows.append({"game_id": gid, "team_id": tid, "missing_top3": missing})

    out = pd.DataFrame(rows)
    print(out.head(10))
    print("Missing_top3 distribution:\n", out["missing_top3"].value_counts().sort_index())

    print("\n✅ POC OK: možemo pouzdano izračunati 'missing_top3' iz boxscorea.")
    print("Sljedeće: spojimo s tvojim TeamGameLogs / TrainingDataset i dobijemo home/away + home_win target.")

if __name__ == "__main__":
    main()
