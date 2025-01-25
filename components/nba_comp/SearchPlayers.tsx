"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { updateSearchCount } from "../../app/api/updateSearch"; // Import funkcije

interface SearchPlayersProps {
  onPlayerClick?: (player: any) => void;
  onPlayerSelect?: (playerId: string) => void;

}

export default function SearchPlayers({ onPlayerClick, onPlayerSelect }: SearchPlayersProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [players, setPlayers] = useState<any[]>([]);
  const [hoveredPlayer, setHoveredPlayer] = useState<any | null>(null); // Player being hovered
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // Cursor position
  const router = useRouter();
  

  const handleSearch = async (term: string) => {
    setSearchTerm(term);

    if (term.trim() === "") {
      setPlayers([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("Osnovno_NBA")
        .select("*")
        .or(
            `PLAYER_FIRST_NAME.ilike.%${term}%,PLAYER_LAST_NAME.ilike.%${term}%,player_full_name.ilike.%${term}%`
        )
        .limit(5);

      if (error) {
        console.error("Error fetching players:", error);
        return;
      }

      console.log("Fetched players:", data); // Debug data
      setPlayers(data || []);
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  const handlePlayerClick = async (player: any) => {
    console.log("Player clicked:", player); // Debug za provjeru odabira igrača
    console.log(`Sending player ID ${player.PERSON_ID} to updateSearchCount`);

    await updateSearchCount(player.PERSON_ID); // Poziv RPC funkcije
    console.log("TEST");

    if (onPlayerSelect) {
      onPlayerSelect(player.PERSON_ID); // Ovdje prosljeđuje ID igrača u onPlayerSelect
    } else if (onPlayerClick) {
      onPlayerClick(player); // Alternativna logika za redirekciju
    }
  };

  

  const handleMouseMove = (e: React.MouseEvent) => {
    setCursorPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseEnter = (player: any) => {
    setHoveredPlayer(player);
  };

  const handleMouseLeave = () => {
    setHoveredPlayer(null);
  };

  return (
    <div style={{ padding: "20px" }} onMouseMove={handleMouseMove}>
      <input
        type="text"
        placeholder="Search for players..."
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          fontSize: "16px",
          marginBottom: "20px",
          border: "1px solid #ccc",
          borderRadius: "5px",
        }}
      />
      {players.length > 0 ? (
        <ul style={{ listStyleType: "none", padding: "0" }}>
          {players.map((player) => (
            <li
              key={player.PERSON_ID}
              style={{
                marginBottom: "10px",
                cursor: "pointer",
                textDecoration: "bold",
                color: "white",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "5px",
                backgroundColor: "#1a1a1a",
                display: "flex", // Use flexbox to position player info and logo
                justifyContent: "space-between", // Space out content (player name and logo)
                alignItems: "center", // Align items vertically
                transition: "background-color 0.3s ease, border-color 0.3s ease",
              }}
              onClick={() => {
                handlePlayerClick(player);
                
              }}
              onMouseEnter={() => handleMouseEnter(player)} 
              onMouseLeave={handleMouseLeave} 
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#333")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#1a1a1a")}
            >
              <div>
              {player.PLAYER_FIRST_NAME} {player.PLAYER_LAST_NAME} -{" "}
              {player.TEAM_NAME || "No Team"}
            
              </div>
              <div>
              {player.TEAM_ID && (
                <img
                    src={`https://cdn.nba.com/logos/nba/${player.TEAM_ID}/global/L/logo.svg`}
                    alt={`${player.TEAM_NAME} logo`}
                    style={{
                width: "30px", // Adjust size as needed
                height: "30px",
                objectFit: "contain",
                marginLeft: "10px", // Space between player info and logo
                }}
                onError={(e) => e.currentTarget.style.display = 'none'}
                 />)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        searchTerm && <p>No players found.</p>
      )}
      {hoveredPlayer && (
        <div
          style={{
            position: "fixed",
            top: `${cursorPosition.y + 10}px`, // Slightly offset from the cursor
            left: `${cursorPosition.x + 10}px`,
            background: "#fff",
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            boxShadow: "0px 4px 8px rgba(0,0,0,0.2)",
            zIndex: 1000,
          }}
        >
          <img
            src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${hoveredPlayer.PERSON_ID}.png`} // Replace with actual player image field
            alt={`${hoveredPlayer.PLAYER_FIRST_NAME} ${hoveredPlayer.PLAYER_LAST_NAME}`}
            style={{ width: "200px", height: "200px", objectFit: "cover", marginBottom: "10px" }}
            loading="lazy"
          />
          <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>
            {hoveredPlayer.PLAYER_FIRST_NAME} {hoveredPlayer.PLAYER_LAST_NAME}
          </p>
        </div>
      )}
    </div>
  );
}
