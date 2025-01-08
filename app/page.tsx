"use client";

import { useState } from "react";
import SearchPlayers from "../components/nba_comp/SearchPlayers";
import AllTimeStats from "../components/nba_comp/AllTimeStats";
import '../styles/globals.css';
import { FileX } from "lucide-react";

export default function HomePage() {
  const [showStats, setShowStats] = useState(false);

  const handlePlayerClick = (player: any) => {
    console.log("Selected player:", player);
  };

  return (
    <div style={{ padding: "20px" }}>
      {!showStats ? (
        <>
          <h1 className="text-center text-4xl mb-4">Welcome to the NBA App</h1>
          <p className="text-center px-2">
            Search for your favorite players and learn more about them.
          </p>
          <SearchPlayers onPlayerClick={handlePlayerClick} />
                      {/* Gumb za All Time Stats */}

          <div style={{marginTop: "20px", display: "flex", justifyContent: "center", gap: "20px" }}>
            <button
              onClick={() => setShowStats(true)}
              className="custom-button all-time-stats"
            >
              <div className="button-overlay"></div>
              <span className="button-text">All Time Stats</span>
            </button>    
            <button
              onClick={() => setShowStats(true)}
              className="custom-button current-stats"
            >
              <div className="button-overlay"></div>
              <span className="button-text">Current Stats</span>
            </button>
          
          </div>
                      {/* Gumb za Current Stats */}

        
        </>
      ) : (
        <AllTimeStats />
      )}
    </div>
  );
}
