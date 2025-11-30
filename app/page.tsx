"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchPlayers from "../components/nba_comp/SearchPlayers";
import NBASchedule from "@/components/NBASchedule";

import Image from "next/image";
import "../styles/globals.css";

export default function HomePage() {
  const router = useRouter();
  const [mostSearchedPlayers, setMostSearchedPlayers] = useState([]);
  const [mostAddedPlayers, setMostAddedPlayers] = useState([]);
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    const fetchMostSearchedPlayers = async () => {
      const response = await fetch("/api/most-searched");
      const data = await response.json();
      setMostSearchedPlayers(data);
    };
    fetchMostSearchedPlayers();
  }, []);

  useEffect(() => {
    const fetchMostAddedPlayers = async () => {
      const response = await fetch("/api/most-added");
      const data = await response.json();
      setMostAddedPlayers(data);
    };
    fetchMostAddedPlayers();
  }, []);

  useEffect(() => {
    const fetchSchedule = async () => {
      const response = await fetch("/api/wnba-schedule");
      const data = await response.json();
      setSchedule(data || []);
    };
    fetchSchedule();
  }, []);

  const handlePlayerClick = (playerId: string) => {
    router.push(`/player/${playerId}`);
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "0px",
      }}
    >
      {/* Left Sidebar */}
      <div style={{ width: "20%", textAlign: "left", marginLeft: "-30%" }}>
        <h2 className="text-xl font-semibold mb-2 text-center">
          Most Searched Players
        </h2>
        <ul>
          {mostSearchedPlayers.map((player: any) => (
            <li
              key={player.player_id}
              style={{
                cursor: "pointer",
                marginBottom: "10px",
                fontWeight: "bold",
              }}
              onClick={() => handlePlayerClick(player.player_id)}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <img
                  src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.player_id}.png`}
                  alt={player.FullStats_NBA?.PLAYER_NAME}
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50px",
                    objectFit: "cover",
                  }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                {player.FullStats_NBA?.PLAYER_NAME || "Unknown Player"}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Center Content */}
      <div style={{ width: "70%", textAlign: "center" }}>
        <div className="flex justify-center mb-6">
          <Image
            src="/slike_test/qnba_logo.png"
            alt="QNBA Logo"
            width={400}
            height={400}
            priority
          />
        </div>

        <h1 className="text-center text-4xl mb-4">Welcome to the QNBA</h1>
        <p className="text-center px-2">
          Search for your favorite players and learn more about them.
        </p>

        <SearchPlayers onPlayerClick={handlePlayerClick} />

        {/* Buttons */}
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "center",
            gap: "20px",
          }}
        >
          <button
            onClick={() => router.push("/alltimestats")}
            className="custom-button all-time-stats"
          >
            <div className="button-overlay"></div>
            <span className="button-text">All Time Stats</span>
          </button>
          <button
            onClick={() => router.push("/currentstats")}
            className="custom-button current-stats"
          >
            <div className="button-overlay"></div>
            <span className="button-text">Current Stats</span>
          </button>
        </div>

        {/* WNBA Schedule Section */}
        <div style={{ marginTop: "50px" }}>
          <NBASchedule />
        </div>
      </div>

      {/* Right Sidebar */}
      <div style={{ width: "20%", textAlign: "left", marginRight: "-30%" }}>
        <h2 className="text-xl font-semibold mb-2 text-center">
          Most Added to Dream Team
        </h2>
        <ul>
          {mostAddedPlayers.map((player: any) => (
            <li
              key={player.player_id}
              style={{
                cursor: "pointer",
                marginBottom: "10px",
                fontWeight: "bold",
              }}
              onClick={() => handlePlayerClick(player.player_id)}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <img
                  src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.player_id}.png`}
                  alt={player.FullStats_NBA?.PLAYER_NAME}
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50px",
                    objectFit: "cover",
                  }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <span>{player.player_name || "Unknown Player"}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
