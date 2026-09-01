"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";
import PlayerImage from "@/components/PlayerImage";

interface Player {
  PERSON_ID: number;
  PLAYER_FIRST_NAME: string;
  PLAYER_LAST_NAME: string;
  POSITION: string;
  HEIGHT: string;
  TEAM_NAME: string;
}

export default function TeamPlayersPage() {
  const params = useParams();
  const TEAM_ID = params?.TEAM_ID;
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchPlayers = async () => {
      if (!TEAM_ID) return;
      setLoading(true);
      setLoadError("");
      if (!/^\d+$/.test(String(TEAM_ID))) {
        setLoadError("Invalid team link.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("Osnovno_NBA")
        .select("*")
        .eq("TEAM_ID", TEAM_ID)
        .eq("ROSTER_STATUS", "1");

      if (error) {
        if (!cancelled) {
          setLoadError("Could not load the stored roster. Please retry.");
          setLoading(false);
        }
        console.error("Error fetching players:", error);
        return;
      }

      if (cancelled) return;
      setPlayers(data || []);
      setLoading(false);
    };

    fetchPlayers();
    return () => {
      cancelled = true;
    };
  }, [TEAM_ID]);

  if (loading) return <p>Loading team players...</p>;
  if (loadError)
    return (
      <p role="alert">
        {loadError}{" "}
        <button className="underline" onClick={() => window.location.reload()}>
          Retry
        </button>{" "}
        <Link href="/teams">All teams</Link>
      </p>
    );

  return (
    <div className="p-6">
      <img
        src={`https://cdn.nba.com/logos/nba/${TEAM_ID}/global/L/logo.svg`}
        className="w-20 h-20 object-contain mb-2 mx-auto"
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          target.style.display = "none";
        }}
      />
      <h1 className="text-2xl font-bold mb-4">Active Players</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {players.map((player) => (
          <Link
            key={player.PERSON_ID}
            href={`/player/${player.PERSON_ID}`}
            className="block border p-4 rounded hover:shadow transition"
          >
            <div className="flex items-center gap-4">
              <PlayerImage
                playerId={player.PERSON_ID}
                imageSize="small"
                alt={`${player.PLAYER_FIRST_NAME} ${player.PLAYER_LAST_NAME}`}
                className="w-20 h-20 object-cover rounded"
              />
              <div>
                <p className="font-semibold">
                  {player.PLAYER_FIRST_NAME} {player.PLAYER_LAST_NAME}
                </p>
                <p className="text-sm text-gray-600">{player.POSITION}</p>
                <p className="text-sm text-gray-600">{player.HEIGHT}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
