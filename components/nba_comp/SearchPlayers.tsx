"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { updateSearchCount } from "../../app/api/updateSearch";
import { trackInteraction } from "@/lib/trackInteraction";

interface SearchPlayersProps {
  onPlayerClick?: (player: any) => void;      // dobije cijeli player objekt
  onPlayerSelect?: (playerId: string) => void;
  inputTextColor?: string;                    // npr. "black" samo za guess igru
}

export default function SearchPlayers({
  onPlayerClick,
  onPlayerSelect,
  inputTextColor,
}: SearchPlayersProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [players, setPlayers] = useState<any[]>([]);
  const [hoveredPlayer, setHoveredPlayer] = useState<any | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
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

      setPlayers(data || []);
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  const handlePlayerClick = async (player: any) => {
    console.log("Player clicked:", player);
    console.log(`Sending player ID ${player.PERSON_ID} to updateSearchCount`);

    await updateSearchCount(player.PERSON_ID);
    await trackInteraction({
      itemType: "player",
      itemId: player.PERSON_ID,
      eventType: "search_click",
      weight: 2,
    });

    // 1) Pošalji cijeli objekt (za guess history itd.)
    if (onPlayerClick) {
      onPlayerClick(player);
    }

    // 2) Pošalji ID (za logiku pogođeno / nije pogođeno)
    if (onPlayerSelect) {
      onPlayerSelect(player.PERSON_ID);
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
          color: inputTextColor ?? "inherit", // 👈 ovdje mijenjamo boju teksta
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
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "background-color 0.3s ease, border-color 0.3s ease",
              }}
              onClick={() => {
                handlePlayerClick(player);
              }}
              onMouseEnter={() => handleMouseEnter(player)}
              onMouseLeave={handleMouseLeave}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#333")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "#1a1a1a")
              }
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
                      width: "30px",
                      height: "30px",
                      objectFit: "contain",
                      marginLeft: "10px",
                    }}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
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
            top: `${cursorPosition.y + 10}px`,
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
            src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${hoveredPlayer.PERSON_ID}.png`}
            alt={`${hoveredPlayer.PLAYER_FIRST_NAME} ${hoveredPlayer.PLAYER_LAST_NAME}`}
            style={{
              width: "200px",
              height: "200px",
              objectFit: "cover",
              marginBottom: "10px",
            }}
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
