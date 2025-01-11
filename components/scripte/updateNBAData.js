const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const { createClient } = require("@supabase/supabase-js");

// Supabase credentials
const supabaseUrl = "https://vyhxpbndpwokyybzmugb.supabase.co"; // Replace with your Supabase project URL
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aHhwYm5kcHdva3l5YnptdWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwMjkyMjksImV4cCI6MjA1MTYwNTIyOX0.z00dgXfozx-ya9zFQbSL-zz2VCMS7tXzhPbeUzUZleg"; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

// NBA stats endpoint
const nbaEndpoint =
  "https://stats.nba.com/stats/leaguedashplayerstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&ISTRound=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=2024-25&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight=";

// Configure Axios retries to handle rate limiting
axiosRetry(axios, {
  retries: 5,
  retryDelay: (retryCount, error) => {
    if (error.response && error.response.status === 429) {
      const retryAfter = parseInt(error.response.headers["retry-after"], 10);
      if (!isNaN(retryAfter)) {
        return retryAfter * 1000;
      }
    }
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
    console.log("Fetching NBA data...");

    // Step 1: Fetch data from the NBA endpoint
    const response = await axios.get(nbaEndpoint, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0",
        Referer: "https://www.nba.com/",
        Origin: "https://www.nba.com/",
      },
      timeout: 10000, // Set timeout to 10 seconds
    });

    const nbaData = response.data;

    // Step 2: Extract the rows and headers
    const headers = nbaData.resultSets[0].headers; // Column names
    const rows = nbaData.resultSets[0].rowSet; // Data rows

    // Step 3: Map rows to objects for Supabase
    const players = rows.map((row) => {
      const player = {};
      headers.forEach((header, index) => {
        player[header] = row[index];
      });
      return player;
    });

    console.log("Fetched NBA data successfully, updating Supabase...");

    // Step 4: Upsert players into Supabase
    for (const player of players) {
      const { error } = await supabase
        .from("CurrentStats_NBA") // Replace "CurrentStats_NBA" with your Supabase table name
        .upsert(player);

      if (error) {
        console.error("Error upserting player:", player, error);
      }
    }

    console.log("NBA data successfully updated in Supabase!");
  } catch (error) {
    if (error.response) {
      console.error(
        "Error response:",
        error.response.status,
        error.response.data
      );
    } else if (error.request) {
      console.error("Error request (no response):", error.request);
    } else {
      console.error("Error:", error.message);
    }

    // Exit the process with an error code if it fails
    process.exit(1);
  }
};

// Run the script
updateNBAData();
