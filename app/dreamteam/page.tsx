"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import SearchPlayers from "@/components/nba_comp/SearchPlayers";
import { DndContext, closestCorners } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function DreamTeam() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [dreamTeam, setDreamTeam] = useState<any[]>([]);
  const router = useRouter();
  const supabase = createClient();
  const MAX_PLAYERS = 12;

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data?.session) {
          router.push("/sign-in");
          return;
        }
        setUser(data.session.user);
      } catch {
        router.push("/sign-in");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const fetchDreamTeam = async () => {
      try {
        const { data, error } = await supabase
          .from("UserDreamTeams")
          .select("player_id, FullStats_NBA(PLAYER_NAME, PTS, REB, AST, Player_Rating)")
          .eq("user_id", user.id);
          console.log("USPJESNO")

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

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = dreamTeam.findIndex((p) => p.player_id === active.id);
    const newIndex = dreamTeam.findIndex((p) => p.player_id === over.id);

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const updatedTeam = arrayMove(dreamTeam, oldIndex, newIndex);
      setDreamTeam(updatedTeam);

      try {
        for (let i = 0; i < updatedTeam.length; i++) {
          await supabase
            .from("UserDreamTeams")
            .update({ position: i + 1 }) // Ažuriraj pozicije u bazi
            .match({ user_id: user.id, player_id: updatedTeam[i].player_id });
        }
      } catch (error) {
        console.error("Error updating player positions:", error);
      }
    }
  };

  const addToDreamTeam = async (playerId: number) => {
    if (!user) return;
    if (dreamTeam.length >= MAX_PLAYERS) {
      alert("You have reached the maximum number of players (12) in your Dream Team!");
      return;
    }

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
        .insert([{ user_id: user.id, player_id: playerId, position: dreamTeam.length + 1 }]);

      if (error) {
        console.error("Error adding player to Dream Team:", error);
      } else {
        setDreamTeam([...dreamTeam, { player_id: playerId, FullStats_NBA: playerData }]);
      }
    } catch (error) {
      console.error("Unexpected error adding player:", error);
    }
  };

  const removeFromDreamTeam = async (playerId: number) => {
    if (!user) return;
  
    try {
      const { error } = await supabase
        .from("UserDreamTeams")
        .delete()
        .match({ user_id: user.id, player_id: playerId });
  
      if (error) {
        console.error("Error removing player:", error);
        return; // Ako ne uspije, ne brišemo iz stanja
      }
  
      // Ažuriramo stanje tek nakon uspješnog brisanja u bazi
      setDreamTeam((prev) => prev.filter((p) => p.player_id !== playerId));
    } catch (error) {
      console.error("Unexpected error removing player:", error);
    }
  };
  

  if (loading) {
    return <p>Loading...</p>;
  }

  const firstRow = dreamTeam.slice(0, 5);
  const secondRow = dreamTeam.slice(5, 12);

  return (
    <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <h1 className="text-2xl font-semibold">
        Create Your Dream Team ({dreamTeam.length}/{MAX_PLAYERS})
      </h1>
      <p>Welcome, {user.user_metadata.username || user.email}!</p>

      <SearchPlayers onPlayerSelect={(playerId: string) => addToDreamTeam(parseInt(playerId))} />

            <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Starting 5</h2>
        <SortableContext items={dreamTeam.map((p) => p.player_id)}>
          {dreamTeam.length === 0 ? (
            <p>No players added yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-4">
                {firstRow.map((player) => (
                  <DraggablePlayer key={player.player_id} player={player} removeFromDreamTeam={removeFromDreamTeam} />
                ))}
              </div>

              {/* Added Bench Section */}
              <h2 className="text-xl font-semibold mt-6 mb-4">Bench</h2>
              <div className="grid grid-cols-7 gap-4 mt-4">
                {secondRow.map((player) => (
                  <DraggablePlayer key={player.player_id} player={player} removeFromDreamTeam={removeFromDreamTeam} />
                ))}
              </div>
            </>
          )}
        </SortableContext>
      </div>

    </DndContext>
  );
}

function DraggablePlayer({ player, removeFromDreamTeam }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: player.player_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="bg-white shadow-md rounded-lg p-4 text-center relative cursor-grab">
      <img
        src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.player_id}.png`}
        alt={player.FullStats_NBA?.PLAYER_NAME || "Unknown Player"}
        className="w-32 h-32 object-cover mx-auto rounded-md"
      />
      <div className="mt-2">
        <p className="font-semibold">{player.FullStats_NBA?.PLAYER_NAME || "Unknown Player"}</p>
        <p className="text-sm text-gray-500">PTS: {player.FullStats_NBA?.PTS || 0}</p>
        <p className="text-sm text-gray-500">REB: {player.FullStats_NBA?.REB || 0}</p>
        <p className="text-sm text-gray-500">AST: {player.FullStats_NBA?.AST || 0}</p>
        <p className="text-sm font-semibold text-blue-600">Rating: {player.FullStats_NBA?.Player_Rating || "N/A"}</p>
        <button className="absolute top-1 right-1 bg-red-500 text-white px-2 py-1 rounded-md text-xs" onClick={() => removeFromDreamTeam(player.player_id)}>
          ✖
        </button>
      </div>
    </div>
  );
}
