"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import SearchPlayers from "@/components/nba_comp/SearchPlayers";

export default function DreamTeam() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [dreamTeam, setDreamTeam] = useState<any[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Error fetching session:", error);
          router.push("/sign-in");
          return;
        }
        if (!data?.session) {
          console.warn("No active session. Redirecting...");
          router.push("/sign-in");
          return;
        }
        setUser(data.session.user);
      } catch (error) {
        console.error("Unexpected error:", error);
        router.push("/sign-in");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // Dohvati korisnikov Dream Team
  useEffect(() => {
    if (!user) return;

    const fetchDreamTeam = async () => {
      try {
        const { data, error } = await supabase
          .from("UserDreamTeams")
          .select("player_id, FullStats_NBA(PLAYER_NAME, PTS, REB, AST, Player_Rating)")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching Dream Team:", error);
        } else {
          setDreamTeam(data || []);
        }
      } catch (error) {
        console.error("Unexpected error fetching Dream Team:", error);
      }
    };

    fetchDreamTeam();
  }, [user]);

  // Dodaj igrača u Dream Team
  const addToDreamTeam = async (playerId: number) => {
    if (!user) return;

    try {
      const { data: playerData, error: fetchError } = await supabase
        .from("FullStats_NBA")
        .select("PLAYER_NAME, PTS, REB, AST, Player_Rating")
        .eq("PERSON_ID", playerId)
        .single();

      if (fetchError || !playerData) {
        console.error("Error fetching player data:", fetchError);
        return;
      }

      const { error } = await supabase
        .from("UserDreamTeams")
        .insert([{ user_id: user.id, player_id: playerId }]);

      if (error) {
        console.error("Error adding player to Dream Team:", error);
      } else {
        setDreamTeam([...dreamTeam, { player_id: playerId, FullStats_NBA: playerData }]);
      }
    } catch (error) {
      console.error("Unexpected error adding player:", error);
    }
  };

  // Ukloni igrača iz Dream Team-a
  const removeFromDreamTeam = async (playerId: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("UserDreamTeams")
        .delete()
        .match({ user_id: user.id, player_id: playerId });

      if (error) {
        console.error("Error removing player:", error);
      } else {
        setDreamTeam(dreamTeam.filter(p => p.player_id !== playerId));
      }
    } catch (error) {
      console.error("Unexpected error removing player:", error);
    }
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Create Your Dream Team</h1>
      <p>Welcome, {user?.email}!</p>

      {/* 🔍 SearchPlayers komponenta */}
      <SearchPlayers onPlayerSelect={(playerId: string) => addToDreamTeam(parseInt(playerId))} />

      {/* 📌 Prikaz korisnikovog Dream Team-a horizontalno sa slikama */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Your Dream Team</h2>
        {dreamTeam.length === 0 ? (
          <p>No players added yet.</p>
        ) : (
          <div className="flex space-x-4 overflow-x-auto">
            {dreamTeam.map(player => (
              <div key={player.player_id} className="bg-white shadow-md rounded-lg p-4 text-center relative">
                {/* 🏀 Slika igrača */}
                <img
                  src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.player_id}.png`}
                  alt={player.FullStats_NBA?.PLAYER_NAME || "Unknown Player"}
                  className="w-32 h-32 object-cover mx-auto rounded-md"
                />
                {/* 📝 Info o igraču */}
                <div className="mt-2">
                  <p className="font-semibold">{player.FullStats_NBA?.PLAYER_NAME || "Unknown Player"}</p>
                  <p className="text-sm text-gray-500">PTS: {player.FullStats_NBA?.PTS || 0}</p>
                  <p className="text-sm text-gray-500">REB: {player.FullStats_NBA?.REB || 0}</p>
                  <p className="text-sm text-gray-500">AST: {player.FullStats_NBA?.AST || 0}</p>
                  <p className="text-sm font-semibold text-blue-600">Rating: {player.FullStats_NBA?.Player_Rating || "N/A"}</p>
                </div>
                {/* ❌ Remove Button */}
                <button
                  className="absolute top-1 right-1 bg-red-500 text-white px-2 py-1 rounded-md text-xs"
                  onClick={() => removeFromDreamTeam(player.player_id)}
                >
                  ✖
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
