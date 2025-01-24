"use client";

import { useRouter } from "next/navigation";
import SearchPlayers from "../components/nba_comp/SearchPlayers";
import "../styles/globals.css";

export default function HomePage() {
  const router = useRouter();

  const handlePlayerClick = (player: any) => {
    console.log("Player clicked:", player);
    router.push(`/player/${player.PERSON_ID}`);
  };
  

  return (
    <div style={{ padding: "20px" }}>
      <h1 className="text-center text-4xl mb-4">Welcome to the QNBA</h1>
      <p className="text-center px-2">
        Search for your favorite players and learn more about them.
      </p>

      {/* Search Players */}
      <SearchPlayers onPlayerClick={handlePlayerClick} />

      {/* Buttons for All Time Stats and Current Stats */}
      <div
        style={{
          marginTop: "20px",
          display: "flex",
          justifyContent: "center",
          gap: "20px",
        }}
      >
        <button
          onClick={() => router.push("/alltimestats")} // Navigate to All Time Stats page
          className="custom-button all-time-stats"
        >
          <div className="button-overlay"></div>
          <span className="button-text">All Time Stats</span>
        </button>

        <button
          onClick={() => router.push("/currentstats")} // Navigate to Current Stats page
          className="custom-button current-stats"
        >
          <div className="button-overlay"></div>
          <span className="button-text">Current Stats</span>
        </button>
      </div>
    </div>
  );
  
}
