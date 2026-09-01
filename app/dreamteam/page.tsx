"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import SearchPlayers from "@/components/nba_comp/SearchPlayers";
import PlayerImage from "@/components/PlayerImage";
import { addDreamTeamPlayer, dreamTeamError, DREAM_TEAM_LIMIT, DREAM_TEAM_SELECT } from "@/lib/dream-team";
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function DreamTeam() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [dreamTeam, setDreamTeam] = useState<any[]>([]);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const MAX_PLAYERS = DREAM_TEAM_LIMIT;
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      if (!data.user) setLoading(false);
    };
    checkAuth();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    const fetchDreamTeam = async () => {
      const { data, error } = await supabase
        .from("UserDreamTeams")
        .select(
          DREAM_TEAM_SELECT
        )
        .eq("user_id", user.id)
        .order("position", { ascending: true });

      if (error) setSaveError("Could not load your team. Please reload the page.");
      else setDreamTeam(data || []);
      setLoading(false);
    };

    fetchDreamTeam();
  }, [user, supabase]);

  const handleDragEnd = async (event: any) => {
    if (savingRef.current || !user) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = dreamTeam.findIndex((p) => p.player_id === active.id);
    const newIndex = dreamTeam.findIndex((p) => p.player_id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const previous = dreamTeam;
    const updated = arrayMove(dreamTeam, oldIndex, newIndex);
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setDreamTeam(updated);
    try {
      const { error } = await supabase.rpc("reorder_dream_team", {
        player_ids: updated.map((p) => p.player_id),
      });
      if (error) throw new Error(dreamTeamError(error));
    } catch (error) {
      setDreamTeam(previous);
      setSaveError(error instanceof Error ? error.message : "Could not save the order.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const addToDreamTeam = async (playerId: number) => {
    if (!user || savingRef.current) return;
    if (dreamTeam.some((p) => p.player_id === playerId)) return;
    if (dreamTeam.length >= MAX_PLAYERS) {
      setSaveError("Your Dream Team can contain up to 12 players.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const data = await addDreamTeamPlayer(supabase, playerId);
      setDreamTeam((prev) => [...prev, data]);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not add player.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const removeFromDreamTeam = async (playerId: number) => {
    if (!user || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const { data, error } = await supabase.from("UserDreamTeams").delete()
        .match({ user_id: user.id, player_id: playerId }).select("player_id");
      if (error) throw new Error(dreamTeamError(error));
      if (!data?.length) throw new Error("Your team changed. Please reload the page.");
      setDreamTeam((prev) => prev.filter((p) => p.player_id !== playerId));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not remove player.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
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
        <Link href="/matchups" className="inline-block mt-3 text-sm font-semibold underline">Compare your starting five →</Link>
      </div>

      <SearchPlayers
        onPlayerSelect={(id: string) => addToDreamTeam(Number(id))}
      />
      {saveError && <p role="alert" className="text-sm text-red-500">{saveError}</p>}
      {saving && <p role="status" className="text-sm text-foreground/70">Saving…</p>}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <SortableContext items={dreamTeam.map((p) => p.player_id)}>
          <Section title="Starting 5">
            <Grid>
              {firstRow.map((p) => (
                <PlayerCard
                  key={p.player_id}
                  player={p}
                  disabled={saving}
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
                    disabled={saving}
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

function PlayerCard({ player, onRemove, disabled }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: player.player_id, disabled });

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
        disabled={disabled}
        aria-label={`Remove ${stats.PLAYER_NAME || "player"}`}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={() => onRemove(player.player_id)}
        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-red-500/90 text-white text-xs font-bold"
      >
        ×
      </button>

      <PlayerImage
        playerId={player.player_id}
        imageSize="small"
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
