"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // Za navigaciju
import { supabase } from "../../../lib/supabase"; // Prilagodite putanju prema vašoj konfiguraciji

export default function PlayerPage({ params }: { params: { id: string } }) {
  const [player, setPlayer] = useState<any>(null);
  const router = useRouter(); // Inicijalizacija routera

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const resolvedParams = await params; // Otpakivanje params
        const { data, error } = await supabase
          .from("Osnovno_NBA") // Naziv vaše tablice
          .select("*")
          .eq("PERSON_ID", resolvedParams.id) // Filtriraj po ID-u igrača
          .single(); // Dohvati samo jednog igrača

        if (error) {
          console.error("Error fetching player:", error);
          return;
        }

        setPlayer(data);
      } catch (err) {
        console.error("Error resolving params:", err);
      }
    };

    fetchPlayer();
  }, [params]);

  if (!player) {
    return <p>Loading...</p>;
  }

  // URL za sliku igrača
  const playerImageUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PERSON_ID}.png`;

  return (
    <div style={{ padding: "20px" }}>
      <button
        onClick={() => router.push("/search")} // Navigacija na stranicu za pretragu
        style={{
          marginBottom: "20px",
          padding: "10px 20px",
          backgroundColor: "#0070f3",
          color: "white",
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
      {/* Dinamički prikaz slike igrača */}
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
      <p>Points per game: {player.PTS}</p>
      <p>Rebounds per game: {player.REB}</p>
      <p>Assists per game: {player.AST}</p>
    </div>
  );
}
