import pandas as pd
from nba_api.stats.endpoints import leaguegamefinder, boxscoretraditionalv2
from nba_api.stats.library.parameters import SeasonAll

SEASON = "2023-24"

def pick_one_game_id(season=SEASON):
    lgf = leaguegamefinder.LeagueGameFinder(
        season_nullable=season,
        season_type_nullable="Regular Season"
    )
    df = lgf.get_data_frames()[0]
    # df ima 2 reda po utakmici (svaki tim), pa uzmi unique GAME_ID
    game_id = df["GAME_ID"].astype(str).unique()[0]
    return game_id

def fetch_boxscore_players(game_id: str):
    bs = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id)
    players = bs.get_data_frames()[0]  # PlayerStats
    # najbitnije kolone:
    # PLAYER_ID, PLAYER_NAME, TEAM_ID, TEAM_ABBREVIATION, START_POSITION, MIN, PTS, COMMENT
    return players

def did_player_play(players_df: pd.DataFrame, player_id: int):
    row = players_df[players_df["PLAYER_ID"] == player_id]
    if row.empty:
        return False, "NOT_IN_BOXSCORE"

    min_val = row.iloc[0].get("MIN", None)
    comment = row.iloc[0].get("COMMENT", None)

    # MIN zna biti "34:12" ili None
    if pd.isna(min_val) or min_val in [None, "", "0", "0:00"]:
        return False, f"DNP_or_0min comment={comment}"

    # ako je "mm:ss" -> igrao
    return True, f"MIN={min_val}"

if __name__ == "__main__":
    game_id = pick_one_game_id()
    print("Picked GAME_ID:", game_id)

    players = fetch_boxscore_players(game_id)
    print("Players rows:", len(players))
    print(players[["TEAM_ABBREVIATION","PLAYER_NAME","MIN","START_POSITION","COMMENT"]].head(10))

    # primjer: stavi neki player_id (npr. LeBron 2544)
    test_player_id = 1628969
    played, info = did_player_play(players, test_player_id)
    print(f"Player {test_player_id} played? {played} | {info}")
