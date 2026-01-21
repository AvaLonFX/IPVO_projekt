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
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user ?? null);
      setLoading(false);
    };
    checkAuth();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    const fetchDreamTeam = async () => {
      const { data } = await supabase
        .from("UserDreamTeams")
        .select(
          "player_id, FullStats_NBA(PLAYER_NAME, PTS, REB, AST, Player_Rating)"
        )
        .eq("user_id", user.id)
        .order("position", { ascending: true });

      setDreamTeam(data || []);
    };

    fetchDreamTeam();
  }, [user, supabase]);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = dreamTeam.findIndex((p) => p.player_id === active.id);
    const newIndex = dreamTeam.findIndex((p) => p.player_id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const updated = arrayMove(dreamTeam, oldIndex, newIndex);
    setDreamTeam(updated);

    for (let i = 0; i < updated.length; i++) {
      await supabase
        .from("UserDreamTeams")
        .update({ position: i + 1 })
        .match({ user_id: user.id, player_id: updated[i].player_id });
    }
  };

  const addToDreamTeam = async (playerId: number) => {
    if (!user) return;
    if (dreamTeam.some((p) => p.player_id === playerId)) return;
    if (dreamTeam.length >= MAX_PLAYERS) return;

    const { data } = await supabase
      .from("FullStats_NBA")
      .select("PLAYER_NAME, PTS, REB, AST, Player_Rating")
      .eq("PERSON_ID", playerId)
      .single();

    if (!data) return;

    await supabase.from("UserDreamTeams").insert([
      {
        user_id: user.id,
        player_id: playerId,
        position: dreamTeam.length + 1,
      },
    ]);

    setDreamTeam((prev) => [
      ...prev,
      { player_id: playerId, FullStats_NBA: data },
    ]);
  };

  const removeFromDreamTeam = async (playerId: number) => {
    await supabase
      .from("UserDreamTeams")
      .delete()
      .match({ user_id: user.id, player_id: playerId });

    setDreamTeam((prev) => prev.filter((p) => p.player_id !== playerId));
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-foreground/70">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="rounded-2xl border border-foreground/10 bg-background/30 backdrop-blur p-6 max-w-md w-full">
          <h1 className="text-xl font-semibold mb-2">Sign in required</h1>
          <p className="text-sm text-foreground/70 mb-4">
            You need to be signed in to use the Dream Team feature.
          </p>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 rounded-xl border border-foreground/15 hover:bg-foreground/5 transition"
            >
              Back
            </button>
            <button
              onClick={() => router.push("/sign-in?redirect=/dreamteam")}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  const firstRow = dreamTeam.slice(0, 5);
  const secondRow = dreamTeam.slice(5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          Your Dream Team
        </h1>
        <p className="text-sm text-foreground/70">
          {dreamTeam.length}/{MAX_PLAYERS} players selected
        </p>
      </div>

      <SearchPlayers
        onPlayerSelect={(id: string) => addToDreamTeam(Number(id))}
      />

      <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <SortableContext items={dreamTeam.map((p) => p.player_id)}>
          <Section title="Starting 5">
            <Grid>
              {firstRow.map((p) => (
                <PlayerCard
                  key={p.player_id}
                  player={p}
                  onRemove={removeFromDreamTeam}
                />
              ))}
            </Grid>
          </Section>

          {secondRow.length > 0 && (
            <Section title="Bench">
              <Grid cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {secondRow.map((p) => (
                  <PlayerCard
                    key={p.player_id}
                    player={p}
                    onRemove={removeFromDreamTeam}
                  />
                ))}
              </Grid>
            </Section>
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
}

/* ---------- helpers ---------- */

function Section({ title, children }: any) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Grid({ children, cols = "grid-cols-1 sm:grid-cols-2 md:grid-cols-5" }: any) {
  return <div className={`grid ${cols} gap-4`}>{children}</div>;
}

function PlayerCard({ player, onRemove }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: player.player_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const stats = player.FullStats_NBA || {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="
        relative cursor-grab
        rounded-2xl border border-foreground/10
        bg-background/30 backdrop-blur
        p-4 text-center
        hover:border-orange-500/30 transition
      "
    >
      <button
        onClick={() => onRemove(player.player_id)}
        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-red-500/90 text-white text-xs font-bold"
      >
        ×
      </button>

      <img
        src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.player_id}.png`}
        alt={stats.PLAYER_NAME}
        className="mx-auto h-28 w-28 object-cover rounded-xl"
      />

      <div className="mt-2 font-semibold text-sm truncate">
        {stats.PLAYER_NAME}
      </div>

      <div className="mt-2 space-y-1 text-xs text-foreground/70">
        <div>PTS {stats.PTS ?? 0}</div>
        <div>REB {stats.REB ?? 0}</div>
        <div>AST {stats.AST ?? 0}</div>
      </div>

      <div className="mt-2 text-sm font-semibold text-orange-400">
        Rating {stats.Player_Rating ?? 0}
      </div>
    </div>
  );
}
