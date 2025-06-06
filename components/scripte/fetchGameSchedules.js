const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");

// Supabase setup
const supabase = createClient(
  "https://vyhxpbndpwokyybzmugb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aHhwYm5kcHdva3l5YnptdWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwMjkyMjksImV4cCI6MjA1MTYwNTIyOX0.z00dgXfozx-ya9zFQbSL-zz2VCMS7tXzhPbeUzUZleg"
);

// Fetch and upsert WNBA schedule
const fetchWNBA = async () => {
  try {
    const res = await axios.get("https://www.wnba.com/api/schedule?season=2025&regionId=1");
    const gameDates = res.data?.leagueSchedule?.gameDates;

    if (!gameDates || !Array.isArray(gameDates)) {
      console.error("❌ No gameDates found.");
      return;
    }

    const flatGames = [];

    for (const dateEntry of gameDates) {
      const date = dateEntry.gameDate;
      for (const game of dateEntry.games) {
        flatGames.push({
          gameID: uuidv4(),
          date: new Date(game.gameDateEst).toISOString().split("T")[0],
          homeTeam: game.homeTeam?.teamTricode || "TBD",
          awayTeam: game.awayTeam?.teamTricode || "TBD",
          startTime: game.gameDateTimeUTC || null,
          status: game.gameStatusText || "TBD"
        });
      }
    }

    console.log(`📋 Fetched ${flatGames.length} games. Uploading...`);

    for (const game of flatGames) {
      const { error } = await supabase
        .from("GameSchedule")
        .upsert(game, { onConflict: ["gameID"] });

      if (error) {
        console.error(`❌ Failed to upsert ${game.gameID}:`, error.message);
      }
    }

    console.log("✅ WNBA schedule successfully upserted.");
  } catch (err) {
    console.error("❌ Fetch failed:", err.message);
  }
};

fetchWNBA();
