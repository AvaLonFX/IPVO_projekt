const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");


const supabase = createClient(
  "https://fdlcdiqvbldqwjbbdjhv.supabase.co/",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkbGNkaXF2YmxkcXdqYmJkamh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNzQwNTcsImV4cCI6MjA3ODY1MDA1N30._ZYUsn03GY-Co6gKNCJCovjvrMkxewilL9tzYGP8jWM" // IMPORTANT: use service_role, not anon
);

const SCHEDULE_URL =
  "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json";

async function fetchNBA() {
  try {
    const res = await axios.get(SCHEDULE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Accept": "application/json",
      },
      timeout: 20000,
    });

    const gameDates = res.data?.leagueSchedule?.gameDates;
    if (!Array.isArray(gameDates)) {
      console.error("❌ No gameDates found in response.");
      return;
    }

    const flatGames = [];

    for (const dateEntry of gameDates) {
      const date = dateEntry.gameDate; // "YYYY-MM-DD"

      for (const game of dateEntry.games || []) {
        // NBA stable game id (key!)
        const nbaGameId = game.gameId || null;

        flatGames.push({
          nba_game_id: nbaGameId,
          date: date,
          homeTeam: game.homeTeam?.teamTricode || "TBD",
          awayTeam: game.awayTeam?.teamTricode || "TBD",
          home_team_id: String(game.homeTeam?.teamId || ""),
          away_team_id: String(game.awayTeam?.teamId || ""),
          startTime: game.gameDateTimeUTC || null,
          status: game.gameStatusText || "TBD",
        });
      }
    }

    // očisti team_id prazne stringove -> null
    const cleaned = flatGames.map((g) => ({
      ...g,
      home_team_id: g.home_team_id ? g.home_team_id : null,
      away_team_id: g.away_team_id ? g.away_team_id : null,
    }));

    // makni one bez nba_game_id (za svaki slučaj)
    const valid = cleaned.filter((g) => g.nba_game_id);

    console.log(
      `📋 Fetched ${cleaned.length} games (${valid.length} with nba_game_id). Upserting...`
    );

    const { error } = await supabase
      .from("GameSchedule")
      .upsert(valid, { onConflict: "nba_game_id" });

    if (error) {
      console.error("❌ Upsert failed:", error.message);
      return;
    }

    console.log("✅ NBA schedule successfully upserted into GameSchedule.");
  } catch (err) {
    console.error("❌ Fetch failed:", err?.message || err);
  }
}

fetchNBA();
