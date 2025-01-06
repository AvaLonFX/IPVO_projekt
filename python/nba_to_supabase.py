from nba_api.stats.static import players
from nba_api.stats.endpoints import playercareerstats
from nba_api.stats.endpoints import commonplayerinfo  # Podaci o igračima
import psycopg2
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Postavljanje globalnog session s timeout-om
class TimeoutHTTPAdapter(HTTPAdapter):
    def __init__(self, *args, **kwargs):
        self.timeout = kwargs.pop("timeout", None)
        super().__init__(*args, **kwargs)

    def send(self, request, **kwargs):
        kwargs["timeout"] = self.timeout
        return super().send(request, **kwargs)

def create_session_with_timeout(timeout):
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    adapter = TimeoutHTTPAdapter(timeout=timeout, max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

# Zamjena requests session s timeout session-om
requests_session = create_session_with_timeout(timeout=30)

# Supabase PostgreSQL Connection String
connection_string = "postgresql://postgres:z4OsBNj434@localhost:5432/postgres"

# Povezivanje s bazom
conn = psycopg2.connect(connection_string)
cursor = conn.cursor()

# Kreirajte novu tablicu ako već ne postoji
create_table_query = """
CREATE TABLE IF NOT EXISTS NBAPlayerDetails (
    id SERIAL PRIMARY KEY,
    player_id INT UNIQUE, -- Dodano UNIQUE kako bi se osigurala jedinstvenost
    full_name TEXT,
    team_id INT,
    start_year INT,
    end_year INT,
    height TEXT,
    weight TEXT,
    birthdate DATE,
    country TEXT,
    draft_year INT,
    draft_round INT,
    draft_number INT
);
"""
cursor.execute(create_table_query)
conn.commit()

# Dohvaćanje svih igrača preko NBA API-a
all_players = players.get_players()

# Iteriranje kroz igrače i umetanje u novu tablicu
for player in all_players[:200]:  # Ovdje možete ukloniti [:20] za sve igrače
    player_id = player["id"]

    # Provjerite je li player_id već u tablici
    cursor.execute("SELECT EXISTS(SELECT 1 FROM NBAPlayerDetails WHERE player_id = %s);", (player_id,))
    if cursor.fetchone()[0]:  # Ako player_id postoji, preskoči igrača
        print(f"Igrač s ID-jem {player_id} već postoji u bazi. Preskačem...")
        continue

    full_name = player["full_name"]
    team_id = player.get("team_id", None)

    # Dohvaćanje osnovnih podataka o igraču
    player_info = commonplayerinfo.CommonPlayerInfo(player_id=player_id).get_data_frames()
    if player_info:
        player_bio = player_info[0]  # Tablica s osnovnim podacima
        height = player_bio["HEIGHT"].values[0]
        weight = player_bio["WEIGHT"].values[0]
        birthdate = player_bio["BIRTHDATE"].values[0]
        country = player_bio["COUNTRY"].values[0]
        
        # Provjera draft podataka
        draft_year = player_bio["DRAFT_YEAR"].values[0]
        draft_round = player_bio["DRAFT_ROUND"].values[0]
        draft_number = player_bio["DRAFT_NUMBER"].values[0]
        
        # Ako je igrač "Undrafted", postavi vrijednosti na None
        if draft_year == "Undrafted":
            draft_year = None
            draft_round = None
            draft_number = None
    else:
        height = weight = birthdate = country = draft_year = draft_round = draft_number = None

    # Dohvaćanje karijernih podataka
    career_stats = playercareerstats.PlayerCareerStats(player_id=player_id).get_data_frames()[0]
    if not career_stats.empty:
        # Ekstrahiranje početne i završne godine iz formata "1990-91"
        start_year = int(career_stats["SEASON_ID"].min().split('-')[0])
        end_year = int(career_stats["SEASON_ID"].max().split('-')[0]) + 1
    else:
        start_year = None
        end_year = None

    # Umetanje podataka u novu tablicu
    insert_query = """
    INSERT INTO NBAPlayerDetails (player_id, full_name, team_id, start_year, end_year, height, weight, birthdate, country, draft_year, draft_round, draft_number)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """
    cursor.execute(insert_query, (player_id, full_name, team_id, start_year, end_year, height, weight, birthdate, country, draft_year, draft_round, draft_number))
    conn.commit()

print("Podaci su uspješno uneseni u novu tablicu NBAPlayerDetails bez duplikata!")

# Zatvaranje kursora i veze
cursor.close()
conn.close()
