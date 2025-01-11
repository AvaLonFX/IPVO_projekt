const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const { createClient } = require("@supabase/supabase-js");

// Supabase credentials
const supabaseUrl = "https://vyhxpbndpwokyybzmugb.supabase.co"; // Replace with your Supabase project URL
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aHhwYm5kcHdva3l5YnptdWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwMjkyMjksImV4cCI6MjA1MTYwNTIyOX0.z00dgXfozx-ya9zFQbSL-zz2VCMS7tXzhPbeUzUZleg"; // Replace with your Supabase anon key

console.log("Setting up Supabase client...");
if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase URL or Key is missing.");
  process.exit(1); // Exit with an error code
}
const supabase = createClient(supabaseUrl, supabaseKey);

// NBA stats endpoint
const nbaEndpoint =
  "https://stats.nba.com/stats/leaguedashplayerstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&ISTRound=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=2024-25&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight=";

console.log("Setting up Axios retry policy...");
axiosRetry(axios, {
  retries: 5,
  retryDelay: (retryCount, error) => {
    if (error.response && error.response.status === 429) {
      const retryAfter = parseInt(error.response.headers["retry-after"], 10);
      if (!isNaN(retryAfter)) {
        console.warn(`Rate limited! Retrying after ${retryAfter} seconds.`);
        return retryAfter * 1000;
      }
    }
    console.warn(`Retrying request (attempt ${retryCount})...`);
    return retryCount * 2000;
  },
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response?.status === 429
    );
  },
});

// Function to fetch NBA data and update Supabase
const updateNBAData = async () => {
  try {
    console.log("Fetching NBA data from endpoint...");
    const response = await axios.get(nbaEndpoint, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0",
        Referer: "https://www.nba.com/",
        Origin: "https://www.nba.com/",
        "Accept-Encoding": "gzip, compress, deflate, br",
        Accept: "application/json, text/plain, */*",
      },

      timeout: 10000, // Set timeout to 10 seconds
    });

    console.log("NBA API response status:", response.status);
    if (response.status !== 200) {
      console.error("Error: Unexpected response status:", response.status);
      process.exit(1); // Exit with an error code
    }

    const nbaData = response.data;

    // Step 2: Extract the rows and headers
    console.log("Extracting data from response...");
    const headers = nbaData?.resultSets?.[0]?.headers;
    const rows = nbaData?.resultSets?.[0]?.rowSet;

    if (!headers || !rows) {
      console.error("Error: Invalid data structure in NBA API response.");
      console.error("Response data:", nbaData);
      process.exit(1); // Exit with an error code
    }

    console.log("Data extracted successfully. Number of players:", rows.length);

    // Step 3: Map rows to objects for Supabase
    console.log("Mapping rows to objects...");
    const players = rows.map((row) => {
      const player = {};
      headers.forEach((header, index) => {
        player[header] = row[index];
      });
      return player;
    });

    console.log("Mapped players. Starting database update...");

    // Step 4: Upsert players into Supabase
    for (const player of players) {
      const { error } = await supabase
        .from("CurrentStats_NBA") // Replace "CurrentStats_NBA" with your Supabase table name
        .upsert(player);

      if (error) {
        console.error("Error upserting player:", player, error);
        continue; // Log the error but continue with the next player
      }
    }

    console.log("NBA data successfully updated in Supabase!");
  } catch (error) {
    if (error.response) {
      console.error(
        "Error response from API:",
        error.response.status,
        error.response.data
      );
    } else if (error.request) {
      console.error("Error request (no response received):", error.request);
    } else {
      console.error("Unexpected error:", error.message);
    }

    // Exit with an error code for failure
    process.exit(1);
  }
};

// Run the script
console.log("Running the NBA data updater...");
updateNBAData()
  .then(() => {
    console.log("Script completed successfully!");
  })
  .catch((err) => {
    console.error("Script failed with error:", err);
    process.exit(1); // Exit with an error code
  });
