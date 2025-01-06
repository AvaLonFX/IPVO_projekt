"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase"; // Provjeri putanju do `supabase.js`

export default function SearchPlayersPage() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [players, setPlayers] = useState<any[]>([]);
  const router = useRouter(); // Koristi za preusmjeravanje

  const handleSearch = async (term: string) => {
    setSearchTerm(term);

    // Ako nema teksta u tražilici, očisti rezultate
    if (term === "") {
      setPlayers([]);
      return;
    }

    // Dohvaćanje podataka iz baze s ograničenjem na 5 rezultata
    const { data, error } = await supabase
      .from("Osnovno_NBA") // Naziv tablice
      .select("*")
      .or(
        `PLAYER_FIRST_NAME.ilike.%${term}%,PLAYER_LAST_NAME.ilike.%${term}%`
      )
      .limit(5); // Ograničenje na 5 rezultata

    if (error) {
      console.error("Error fetching players:", error);
      return;
    }

    // Ažuriraj rezultate
    setPlayers(data || []);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>NBA Player Search</h1>
      <input
        type="text"
        placeholder="Search by name..."
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ width: "100%", padding: "10px", fontSize: "16px", marginBottom: "20px" }}
      />

      {players.length > 0 ? (
        <ul style={{ listStyleType: "none", padding: "0" }}>
          {players.map((player) => (
            <li
              key={player.PERSON_ID}
              style={{
                marginBottom: "10px",
                cursor: "pointer",
                textDecoration: "underline",
                color: "blue",
              }}
              onClick={() => router.push(`/player/${player.PERSON_ID}`)} // Klik vodi na stranicu igrača
            >
              {player.PLAYER_FIRST_NAME} {player.PLAYER_LAST_NAME} - {player.TEAM_NAME || "No Team"}
            </li>
          ))}
        </ul>
      ) : (
        <p>No players found.</p>
      )}
    </div>
  );
}
