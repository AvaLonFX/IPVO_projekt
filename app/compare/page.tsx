"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Button from "@/components/backtosearchbutton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


export const dynamic = "force-dynamic"; // Prevent prerendering

export default function ComparePage() {
  const router = useRouter();
  const [player1Id, setPlayer1Id] = useState<string | null>(null);
  const [player2Id, setPlayer2Id] = useState<string | null>(null);

  const [player1, setPlayer1] = useState<any>(null);
  const [player2, setPlayer2] = useState<any>(null);
  const [stats1, setStats1] = useState<any>(null);
  const [stats2, setStats2] = useState<any>(null);
  const [activeChart, setActiveChart] = useState<"total" | "perGame">("total");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const p1Id = searchParams.get("player1");
    const p2Id = searchParams.get("player2");

    if (!p1Id || !p2Id) {
      console.error("Player IDs not found in the URL!");
      router.push("/"); // Redirect to home if IDs are missing
      return;
    }

    setPlayer1Id(p1Id);
    setPlayer2Id(p2Id);
  }, [router]);

  useEffect(() => {
    if (!player1Id || !player2Id) return;

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

    fetchPlayerData(player1Id, setPlayer1, setStats1);
    fetchPlayerData(player2Id, setPlayer2, setStats2);
  }, [player1Id, player2Id]);

  if (!player1 || !player2) {
    return <p className="text-center text-xl font-bold">Loading...</p>;
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
    <div className="p-5">
      <h1 className="text-2xl font-bold mb-5 text-center">Player Comparison</h1>
      <Button/>
      <br/>
      <div className="flex justify-around p-5">
  {[{ player: player1, stats: stats1 }, { player: player2, stats: stats2 }].map(
    ({ player, stats }, index) => (
      <Card key={player.PERSON_ID} className="mb-8 m-2">
        <CardHeader>
          <CardTitle>
            {player.PLAYER_FIRST_NAME} {player.PLAYER_LAST_NAME}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row items-center gap-6 justify-between">
          <img
            src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PERSON_ID}.png`}
            alt={`${player.PLAYER_FIRST_NAME} ${player.PLAYER_LAST_NAME}`}
            className="w-60 h-auto rounded-lg"
          />
          <div className="space-y-2 text-sm text-right">
            <p>
              <strong>Team:</strong> {player.TEAM_NAME || "No Team"}
            </p>
            <p>
              <strong>Position:</strong> {player.POSITION}
            </p>
            <p>
              <strong>Height:</strong> {player.HEIGHT}
            </p>
            <p>
              <strong>Weight:</strong> {player.WEIGHT}
            </p>
            <p>
              <strong>College:</strong> {player.COLLEGE || "N/A"}
            </p>
            <p>
              <strong>Country:</strong> {player.COUNTRY}
            </p>
            <p>
              <strong>Draft Year:</strong> {player.DRAFT_YEAR || "N/A"}
            </p>
            <p>
              <strong>Draft Round:</strong> {player.DRAFT_ROUND || "N/A"}
            </p>
            <p>
              <strong>Draft Number:</strong> {player.DRAFT_NUMBER || "N/A"}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  )}
</div>

      <div className="text-center mb-5">
        <button
          onClick={() => setActiveChart("total")}
          className={`px-4 py-2 rounded-lg mr-2 ${
            activeChart === "total" ? "bg-green-500 text-white" : "bg-gray-200 text-black"
          }`}
        >
          Total
        </button>
        <button
          onClick={() => setActiveChart("perGame")}
          className={`px-4 py-2 rounded-lg ${
            activeChart === "perGame" ? "bg-purple-500 text-white" : "bg-gray-200 text-black"
          }`}
        >
          Per Game
        </button>
      </div>
      <div className="flex justify-center">
        <BarChart
          width={800}
          height={400}
          data={activeChart === "total" ? totalStatsData : perGameStatsData}
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
    </div>
  );
}
