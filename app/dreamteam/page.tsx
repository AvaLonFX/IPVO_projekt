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

  // ✅ provjera auth-a, ali BEZ redirecta – samo postavi user / null
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
          setUser(null);
        } else {
          setUser(data?.session?.user ?? null);
        }
      } catch (err) {
        console.error("Unexpected error getting session:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ dohvat DreamTeama samo ako user postoji
  useEffect(() => {
    if (!user) return;

    const fetchDreamTeam = async () => {
      try {
        const { data, error } = await supabase
          .from("UserDreamTeams")
          .select(
            "player_id, FullStats_NBA(PLAYER_NAME, PTS, REB, AST, Player_Rating)"
          )
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
  }, [user, supabase]);

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
            .update({ position: i + 1 })
            .match({ user_id: user.id, player_id: updatedTeam[i].player_id });
        }
      } catch (error) {
        console.error("Error updating player positions:", error);
      }
    }
  };

  const addToDreamTeam = async (playerId: number) => {
    if (!user) return;

    const isAlreadyAdded = dreamTeam.some(
      (player) => player.player_id === playerId
    );
    if (isAlreadyAdded) {
      alert("This player is already in your Dream Team!");
      return;
    }

    if (dreamTeam.length >= MAX_PLAYERS) {
      alert(
        "You have reached the maximum number of players (12) in your Dream Team!"
      );
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
        .insert([
          {
            user_id: user.id,
            player_id: playerId,
            position: dreamTeam.length + 1,
          },
        ]);

      if (error) {
        console.error("Error adding player to Dream Team:", error);
      } else {
        setDreamTeam((prev) => [
          ...prev,
          { player_id: playerId, FullStats_NBA: playerData },
        ]);
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
        return;
      }

      setDreamTeam((prev) => prev.filter((p) => p.player_id !== playerId));
    } catch (error) {
      console.error("Unexpected error removing player:", error);
    }
  };

  // ⏳ loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  // ❌ user nije logiran → prikaži modal
  if (!user) {
    return (
      <main className="min-h-screen text-slate-50 justify-center px-60">
        {/* backdrop */}
        <div className="fixed inset-0 bg-black/60" />

        {/* modal */}
        <div className="relative z-10 max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h1 className="text-xl font-semibold mb-2">Sign in required</h1>
          <p className="text-sm text-slate-300 mb-4">
            You need to be signed in to use the Dream Team feature. Please sign
            in or create an account to continue.
          </p>

          <div className="flex justify-end gap-3 mt-2">
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-100 text-sm hover:bg-slate-800 transition"
            >
              Back to Home
            </button>
            <button
              onClick={() => router.push("/sign-in?redirect=/dreamteam")}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition"
            >
              Sign in
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ✅ user logiran → pravi Dream Team UI
  const firstRow = dreamTeam.slice(0, 5);
  const secondRow = dreamTeam.slice(5, 12);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <h1 className="text-2xl font-semibold">
          Create Your Dream Team ({dreamTeam.length}/{MAX_PLAYERS})
        </h1>
        <p className="mb-4">
          Welcome, {user.user_metadata?.username || user.email}!
        </p>

        <SearchPlayers
          onPlayerSelect={(playerId: string) =>
            addToDreamTeam(parseInt(playerId, 10))
          }
        />

        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Starting 5</h2>
          <SortableContext items={dreamTeam.map((p) => p.player_id)}>
            {dreamTeam.length === 0 ? (
              <p>No players added yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {firstRow.map((player) => (
                    <DraggablePlayer
                      key={player.player_id}
                      player={player}
                      removeFromDreamTeam={removeFromDreamTeam}
                    />
                  ))}
                </div>

                <h2 className="text-xl font-semibold mt-6 mb-4">Bench</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 mt-4">
                  {secondRow.map((player) => (
                    <DraggablePlayer
                      key={player.player_id}
                      player={player}
                      removeFromDreamTeam={removeFromDreamTeam}
                    />
                  ))}
                </div>
              </>
            )}
          </SortableContext>
        </div>
      </DndContext>
    </main>
  );
}

function DraggablePlayer({ player, removeFromDreamTeam }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: player.player_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white shadow-md rounded-lg p-4 text-center relative cursor-grab"
    >
      <img
        src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.player_id}.png`}
        alt={player.FullStats_NBA?.PLAYER_NAME || "Unknown Player"}
        className="w-32 h-32 object-cover mx-auto rounded-md"
      />
      <div className="mt-2">
        <p className="font-semibold">
          {player.FullStats_NBA?.PLAYER_NAME || "Unknown Player"}
        </p>
        <p className="text-sm text-gray-500">
          PTS: {player.FullStats_NBA?.PTS ?? 0}
        </p>
        <p className="text-sm text-gray-500">
          REB: {player.FullStats_NBA?.REB ?? 0}
        </p>
        <p className="text-sm text-gray-500">
          AST: {player.FullStats_NBA?.AST ?? 0}
        </p>
        <p className="text-sm font-semibold text-blue-600">
          Rating: {player.FullStats_NBA?.Player_Rating ?? "N/A"}
        </p>
        <button
          className="absolute top-1 right-1 bg-red-500 text-white px-2 py-1 rounded-md text-xs"
          onClick={() => removeFromDreamTeam(player.player_id)}
        >
          ✖
        </button>
      </div>
    </div>
  );
}
