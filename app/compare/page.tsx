"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";


export default function ComparePage() {
  const searchParams = useSearchParams();
  const player1Id = searchParams?.get("player1");
  const player2Id = searchParams?.get("player2");
  const router = useRouter();

  const [player1, setPlayer1] = useState<any>(null);
  const [player2, setPlayer2] = useState<any>(null);
  const [stats1, setStats1] = useState<any>(null);
  const [stats2, setStats2] = useState<any>(null);
  const [activeChart, setActiveChart] = useState<"total" | "perGame">("total");

  useEffect(() => {
    const fetchPlayerData = async (playerId: string, setPlayer: any, setStats: any) => {
      try {
        const { data: playerData, error: playerError } = await supabase
          .from("Osnovno_NBA")
          .select("*")
          .eq("PERSON_ID", playerId)
          .single();

        const { data: playerStats, error: statsError } = await supabase
          .from("FullStats_NBA")
          .select("*")
          .eq("PERSON_ID", playerId)
          .single();

        if (playerError || statsError) {
          console.error("Error fetching data:", playerError || statsError);
        } else {
          setPlayer(playerData);
          setStats(playerStats);
        }
      } catch (err) {
        console.error("Error fetching player data:", err);
      }
    };

    if (player1Id) fetchPlayerData(player1Id, setPlayer1, setStats1);
    if (player2Id) fetchPlayerData(player2Id, setPlayer2, setStats2);
  }, [player1Id, player2Id]);

  if (!player1 || !player2) {
    return <p>Loading...</p>;
  }

  const totalStatsData = [
    { stat: "Points", player1: stats1?.PTS || 0, player2: stats2?.PTS || 0 },
    { stat: "Rebounds", player1: stats1?.REB || 0, player2: stats2?.REB || 0 },
    { stat: "Assists", player1: stats1?.AST || 0, player2: stats2?.AST || 0 },
    { stat: "Steals", player1: stats1?.STL || 0, player2: stats2?.STL || 0 },
    { stat: "Blocks", player1: stats1?.BLK || 0, player2: stats2?.BLK || 0 },
  ];

  const perGameStatsData = [
    { stat: "PPG", player1: player1?.PTS || 0, player2: player2?.PTS || 0 },
    { stat: "RPG", player1: player1?.REB || 0, player2: player2?.REB || 0 },
    { stat: "APG", player1: player1?.AST || 0, player2: player2?.AST || 0 },
    { stat: "FG%", player1: (stats1?.FG_PCT || 0) * 100, player2: (stats2?.FG_PCT || 0) * 100 },
    { stat: "FT%", player1: (stats1?.FT_PCT || 0) * 100, player2: (stats2?.FT_PCT || 0) * 100 },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <h1>Player Comparison</h1>
      <button
        onClick={() => router.push("/")}
        style={{
          marginBottom: "20px",
          padding: "10px 20px",
          backgroundColor: "#FFFF",
          color: "black",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        Back to Search
      </button>
      <div style={{ display: "flex", justifyContent: "space-around", padding: "20px" }}>
        {[{ player: player1, stats: stats1 }, { player: player2, stats: stats2 }].map(
          ({ player, stats }, index) => (
            <div key={index} style={{ width: "45%", textAlign: "center" }}>
              <img
                src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PERSON_ID}.png`}
                alt={`${player.PLAYER_FIRST_NAME} ${player.PLAYER_LAST_NAME}`}
                style={{ width: "200px", height: "auto", marginBottom: "20px" }}
              />
              <h2>
                {player.PLAYER_FIRST_NAME} {player.PLAYER_LAST_NAME}
              </h2>
              <p>Team: {player.TEAM_NAME || "No Team"}</p>
              <p>Position: {player.POSITION}</p>
              <p>Height: {player.HEIGHT}</p>
              <p>Weight: {player.WEIGHT}</p>
              <p>College: {player.COLLEGE || "N/A"}</p>
              <p>Country: {player.COUNTRY}</p>
              <p>Draft Year: {player.DRAFT_YEAR || "N/A"}</p>
              <p>Draft Round: {player.DRAFT_ROUND || "N/A"}</p>
              <p>Draft Number: {player.DRAFT_NUMBER || "N/A"}</p>
              <br />
            </div>
          )
        )}
      </div>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveChart("total")}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            backgroundColor: activeChart === "total" ? "#82ca9d" : "#f0f0f0",
            color: activeChart === "total" ? "#fff" : "#000",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Total
        </button>
        <button
          onClick={() => setActiveChart("perGame")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeChart === "perGame" ? "#8884d8" : "#f0f0f0",
            color: activeChart === "perGame" ? "#fff" : "#000",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Per Game
        </button>
      </div>
      <BarChart
        width={800}
        height={400}
        data={activeChart === "total" ? totalStatsData : perGameStatsData}
        style={{ margin: "auto" }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="stat" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="player1" fill="#8884d8" name={player1.PLAYER_FIRST_NAME} />
        <Bar dataKey="player2" fill="#82ca9d" name={player2.PLAYER_FIRST_NAME} />
      </BarChart>
    </div>
  );
}
