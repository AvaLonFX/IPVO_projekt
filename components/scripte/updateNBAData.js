const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const { createClient } = require("@supabase/supabase-js");

// Supabase credentials
const supabaseUrl = "https://vyhxpbndpwokyybzmugb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aHhwYm5kcHdva3l5YnptdWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwMjkyMjksImV4cCI6MjA1MTYwNTIyOX0.z00dgXfozx-ya9zFQbSL-zz2VCMS7tXzhPbeUzUZleg"; // Replace with your actual anon key

const supabase = createClient(supabaseUrl, supabaseKey);

// Retry logic
axiosRetry(axios, {
  retries: 5,
  retryDelay: (retryCount, error) => {
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers["retry-after"], 10);
      if (!isNaN(retryAfter)) return retryAfter * 1000;
    }
    return retryCount * 2000;
  },
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429,
});

// 🔁 Update CurrentStats_NBA
const updateNBAData = async () => {
  const endpoint = "https://stats.nba.com/stats/leaguedashplayerstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&ISTRound=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=2024-25&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight=";

  try {
    const response = await axios.get(endpoint, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.nba.com/",
        Origin: "https://www.nba.com/",
      },
      timeout: 10000,
    });

    const headers = response.data?.resultSets?.[0]?.headers;
    const rows = response.data?.resultSets?.[0]?.rowSet;

    if (!headers || !rows) throw new Error("Invalid stats response structure");

    const players = rows.map((row) => {
      const player = {};
      headers.forEach((header, i) => (player[header] = row[i]));
      return player;
    });

    for (const player of players) {
      const { error } = await supabase
        .from("CurrentStats_NBA")
        .upsert(player, { onConflict: ["PLAYER_ID"] });

      if (error) {
        console.error("Upsert error (CurrentStats):", player.PLAYER_ID, error.message);
      }
    }

    console.log("✅ CurrentStats_NBA updated successfully");
  } catch (err) {
    console.error("❌ Error updating CurrentStats_NBA:", err.message);
  }
};

// 🔄 Update Osnovno_NBA (filtering fields)
const updatePlayerInfo = async () => {
  const endpoint = "https://stats.nba.com/stats/playerindex?College=&Country=&DraftPick=&DraftRound=&DraftYear=&Height=&Historical=1&LeagueID=00&Season=2024-25&SeasonType=Playoffs&TeamID=0&Weight=";

  const allowedFields = [
    "PERSON_ID", "PLAYER_FIRST_NAME", "PLAYER_LAST_NAME",
    "TEAM_ID", "TEAM_CITY", "TEAM_NAME", "TEAM_ABBREVIATION",
    "JERSEY_NUMBER", "POSITION", "HEIGHT", "WEIGHT", "COLLEGE",
    "COUNTRY", "DRAFT_YEAR", "DRAFT_ROUND", "DRAFT_NUMBER",
    "ROSTER_STATUS", "PTS", "REB", "AST", "STATS_TIMEFRAME",
    "FROM_YEAR", "TO_YEAR"
  ];

  try {
    const response = await axios.get(endpoint, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.nba.com/",
        Origin: "https://www.nba.com/",
      },
      timeout: 10000,
    });

    const headers = response.data?.resultSets?.[0]?.headers;
    const rows = response.data?.resultSets?.[0]?.rowSet;

    if (!headers || !rows) throw new Error("Invalid player index response");

    const players = rows.map((row) => {
      const data = {};
      headers.forEach((header, i) => (data[header] = row[i]));

      const filtered = {};
      for (const field of allowedFields) {
        filtered[field] = data[field];
      }

      // Keep existing column
      filtered.player_full_name = `${data["PLAYER_FIRST_NAME"]} ${data["PLAYER_LAST_NAME"]}`;

      return filtered;
    });

    for (const player of players) {
      const { error } = await supabase
        .from("Osnovno_NBA")
        .upsert(player, { onConflict: ["PERSON_ID"] });

      if (error) {
        console.error("Upsert error (Osnovno):", player.PERSON_ID, error.message);
      }
    }

    console.log("✅ Osnovno_NBA updated successfully");
  } catch (err) {
    console.error("❌ Error updating Osnovno_NBA:", err.message);
  }
};

// 🏁 Run both
(async () => {
  console.log("🔄 Running daily NBA data updates...");
  await updateNBAData();
  await updatePlayerInfo();
  console.log("✅ All updates completed.");
})();
