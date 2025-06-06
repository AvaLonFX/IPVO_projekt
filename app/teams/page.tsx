"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

interface Team {
  TEAM_ID: number;
  TEAM_NAME: string;
  TEAM_ABBREVIATION: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase
        .from("Teams")
        .select("TEAM_ID, TEAM_NAME, TEAM_ABBREVIATION");

      if (error) {
        console.error("Error fetching teams:", error);
        return;
      }

      setTeams(data || []);
      setLoading(false);
    };

    fetchTeams();
  }, []);

  const handleTeamClick = (teamId: number) => {
    router.push(`/teams/${teamId}`);
  };

  if (loading) {
    return <div className="p-6">Loading teams...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">NBA Teams</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {teams.map((team) => (
          <div
            key={team.TEAM_ID}
            className="cursor-pointer border rounded-lg p-4 flex flex-col items-center hover:shadow-lg transition"
            onClick={() => handleTeamClick(team.TEAM_ID)}
          >
            <img
              src={`https://cdn.nba.com/logos/nba/${team.TEAM_ID}/global/L/logo.svg`}
              alt={`${team.TEAM_NAME} logo`}
              className="w-20 h-20 object-contain mb-2"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = "none";
              }}
            />
            <p className="text-center text-sm font-medium">{team.TEAM_NAME}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
