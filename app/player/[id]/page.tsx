"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";
import SearchPlayers from "../../../components/nba_comp/SearchPlayers"
export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const [player, setPlayer] = useState<any>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [activeChart, setActiveChart] = useState<"total" | "perGame">("total");
  const [showCompareSearch, setShowCompareSearch] = useState(false);
  const handlePlayerSelect = (secondPlayerId: string) => {
    console.log("Odabrani drugi igrač s ID-jem:", secondPlayerId);
    router.push(`/compare?player1=${resolvedParams?.id}&player2=${secondPlayerId}`);
  };
  /*komentar*/

  const router = useRouter();

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      setResolvedParams(resolved);
    };

    resolveParams();
  }, [params]);

  useEffect(() => {
    const fetchPlayer = async () => {
      if (!resolvedParams) return;

      try {
        const { data: playerData, error: playerError } = await supabase
          .from("Osnovno_NBA")
          .select("*")
          .eq("PERSON_ID", resolvedParams.id)
          .single();

        const { data: playerStats, error: statsError } = await supabase
          .from("FullStats_NBA")
          .select("*")
          .eq("PERSON_ID", resolvedParams.id)
          .single();

        if (playerError || statsError) {
          console.error("Error fetching data:", playerError || statsError);
        } else {
          console.log("Player data:", playerData);
          console.log("Stats data:", playerStats);
        }

        setPlayer(playerData);
        setStats(playerStats);
      } catch (err) {
        console.error("Error fetching player data:", err);
      }
    };

    fetchPlayer();
  }, [resolvedParams]);

  if (!player) {
    return <p>Loading...</p>;
  }

  const playerImageUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PERSON_ID}.png`;

  const totalPoints = stats?.PTS || 0;

  // Podaci za pie chart s postocima
  const pieData = [
    { name: "Two-Point Field Goals", value: (stats?.FGM || 0) - (stats?.FG3M || 0) }, // FGM - FG3M = FG2M
    { name: "Three-Point Field Goals", value: stats?.FG3M || 0 },
    { name: "Free Throws", value: stats?.FTM || 0 },
  ].map((item) => ({
    ...item,
    percentage: ((item.value / totalPoints) * 100).toFixed(1) + "%",
  }));

  const pieColors = ["#8884d8", "#82ca9d", "#ffc658"];

  // Podaci za grafove
  const generalStatsData = [
    { name: "Points", value: stats?.PTS || 0 },
    { name: "Rebounds", value: stats?.REB || 0 },
    { name: "Assists", value: stats?.AST || 0 },
    { name: "Steals", value: stats?.STL || 0 },
    { name: "Blocks", value: stats?.BLK || 0 },
  ];

  const advancedStatsData = [
    { name: "PPG", value: player?.PTS || 0 },
    { name: "APG", value: player?.AST || 0 },
    { name: "RPG", value: player?.REB || 0 },
    { name: "FG %", value: stats?.FG_PCT ? stats.FG_PCT * 100 : 0 },
    { name: "FT %", value: stats?.FT_PCT ? stats.FT_PCT * 100 : 0 },
  ];

  return (
    <div style={{ padding: "20px" }}>
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
      <h1>
        {player.PLAYER_FIRST_NAME} {player.PLAYER_LAST_NAME}
      </h1>
      <img
        src={playerImageUrl}
        alt={`${player.PLAYER_FIRST_NAME} ${player.PLAYER_LAST_NAME}`}
        style={{ width: "300px", height: "auto", marginBottom: "20px" }}
      />
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
      <br />

      {/* Buttons za grafove */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
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

      {/* Animirani graf */}
      <div style={{ position: "relative", height: "300px" }}>
        {activeChart === "total" && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <BarChart width={600} height={300} data={generalStatsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#82ca9d" />
            </BarChart>
          </motion.div>
        )}
        {activeChart === "perGame" && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <BarChart width={600} height={300} data={advancedStatsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </motion.div>
        )}
      </div>

    {/* Pie Chart za raspodjelu poena u postocima */}
    <h2>Point Distribution</h2>
    <PieChart width={500} height={400}>
      <Pie
        data={[
          { name: "Two-Point Field Goals", value: ((stats?.FGM || 0) - (stats?.FG3M || 0)) / (stats?.PTS || 1) * 100*2 },
          { name: "Three-Point Field Goals", value: (stats?.FG3M || 0) / (stats?.PTS || 1) * 100*3 },
          { name: "Free Throws", value: (stats?.FTM || 0) / (stats?.PTS || 1) * 100 },
        ]}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        outerRadius={150}
        fill="#8884d8"
        label={({ cx, cy, midAngle, outerRadius, percent, index }) => {
          const RADIAN = Math.PI / 180;
          const radius = outerRadius + 20; // Pomičemo labelu van kruga
          const x = cx + radius * Math.cos(-midAngle * RADIAN);
          const y = cy + radius * Math.sin(-midAngle * RADIAN);
          const value = [
            ((stats?.FGM || 0) - (stats?.FG3M || 0)) / (stats?.PTS || 1) * 100*2,
            (stats?.FG3M || 0) / (stats?.PTS || 1) * 100*3,
            (stats?.FTM || 0) / (stats?.PTS || 1) * 100,
          ][index];

          return (
            <text
              x={x}
              y={y}
              fill="black"
              textAnchor={x > cx ? "start" : "end"}
              dominantBaseline="central"
              fontSize={12}
            >
              {`${value.toFixed(1)}%`}
            </text>
          );
        }}
      >
        {pieColors.map((color, index) => (
          <Cell key={`cell-${index}`} fill={pieColors[index]} />
        ))}
      </Pie>
      <Tooltip formatter={(value: any) => `${value.toFixed(1)}%`} />
    </PieChart>



        <button
      onClick={() => setShowCompareSearch(true)} // Otvori SearchPlayers komponentu
      style={{
        marginTop: "20px",
        padding: "10px 20px",
        backgroundColor: "#007BFF",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
      }}
    >
      Compare
    </button>

    {showCompareSearch && (
      <div style={{ marginTop: "20px" }}>
        <SearchPlayers
          onPlayerSelect={(secondPlayerId: string) => {
            handlePlayerSelect(secondPlayerId); // Ovdje pozovi logiku za odabir igrača
            setShowCompareSearch(false); // Zatvori SearchPlayers komponentu nakon odabira
          }}
        />
      </div>
    )}

    </div>
  );
}
