"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Rec = {
  id: string | number;
  name: string;
  team?: string | number | null;
  similarity?: number;
};

type ApiResp = { recommendations: Rec[] };

export default function Recommendations() {
  const supabase = useMemo(() => createClient(), []);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  const [data, setData] = useState<ApiResp | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dreamTeamIds, setDreamTeamIds] = useState<Set<string>>(new Set());
  const [loadingDreamTeam, setLoadingDreamTeam] = useState(false);

  const [addingId, setAddingId] = useState<string | null>(null);

  // 1) session (user)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data?.session?.user?.id ?? null);
    })();
  }, [supabase]);

  // 2) fetch recs ONLY when opened
  useEffect(() => {
    if (!open) return;
    if (data || loadingRecs) return;

    (async () => {
      setLoadingRecs(true);
      setError(null);

      try {
        const r = await fetch("/api/recommendations/players", {
          credentials: "include",
        });

        if (!r.ok) {
          const text = await r.text();
          setError(`${r.status} ${r.statusText}: ${text}`);
          setData({ recommendations: [] });
          return;
        }

        const json = (await r.json()) as ApiResp;
        setData(json);
      } catch (e: any) {
        setError(e?.message ?? "Fetch failed");
        setData({ recommendations: [] });
      } finally {
        setLoadingRecs(false);
      }
    })();
  }, [open, data, loadingRecs]);

  // 3) fetch dreamteam ids when opened + logged in
  useEffect(() => {
    if (!open) return;
    if (!userId) return;

    (async () => {
      setLoadingDreamTeam(true);
      try {
        const { data, error } = await supabase
          .from("UserDreamTeams")
          .select("player_id")
          .eq("user_id", userId);

        if (error) {
          console.error("Error fetching dream team:", error);
          return;
        }

        const setIds = new Set<string>((data ?? []).map((r: any) => String(r.player_id)));
        setDreamTeamIds(setIds);
      } finally {
        setLoadingDreamTeam(false);
      }
    })();
  }, [open, userId, supabase]);

  const items = data?.recommendations ?? [];

  const canShow = open && !error && items.length > 0;

  const scrollByCard = (dir: "prev" | "next") => {
    const el = scrollerRef.current;
    if (!el) return;

    const card = el.querySelector<HTMLElement>("[data-rec-card]");
    const step = (card?.offsetWidth ?? 320) + 16;

    el.scrollBy({
      left: dir === "next" ? step : -step,
      behavior: "smooth",
    });
  };

  const addToDreamTeam = async (playerId: string | number) => {
    if (!userId) return;

    const pid = String(playerId);

    // max 12
    if (dreamTeamIds.size >= 12) {
      alert("You have reached the maximum number of players (12) in your Dream Team!");
      return;
    }

    // already added
    if (dreamTeamIds.has(pid)) return;

    setAddingId(pid);
    try {
      // position = current size + 1 (isto kao tvoj DreamTeam page)
      const { error } = await supabase.from("UserDreamTeams").insert([
        {
          user_id: userId,
          player_id: Number(pid),
          position: dreamTeamIds.size + 1,
        },
      ]);

      if (error) {
        console.error("Error adding player to Dream Team:", error);
        alert("Failed to add player to Dream Team.");
        return;
      }

      setDreamTeamIds((prev) => {
        const next = new Set(prev);
        next.add(pid);
        return next;
      });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section className="w-full max-w-4xl mx-auto">
      {/* Header / Toggle */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-xl font-semibold">Recommended players</h2>
          <p className="text-xs text-gray-500">Personalized suggestions based on your activity</p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 transition text-sm"
        >
          {open ? "Hide recommendations" : "Show recommendations"}
        </button>
      </div>

      {/* Collapsible content */}
      {!open ? null : (
        <div className="rounded-2xl border bg-white p-4">
          {/* states */}
          {!userId ? (
            <p className="text-sm text-gray-500">Please sign in to see recommendations.</p>
          ) : loadingRecs ? (
            <p className="text-sm text-gray-500">Loading recommendations...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">No recommendations yet (interact with players first).</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">Swipe or use arrows</p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => scrollByCard("prev")}
                    className="h-9 w-9 rounded-full border bg-white hover:bg-gray-50 flex items-center justify-center"
                    aria-label="Previous"
                    type="button"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => scrollByCard("next")}
                    className="h-9 w-9 rounded-full border bg-white hover:bg-gray-50 flex items-center justify-center"
                    aria-label="Next"
                    type="button"
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="relative">
                <div
                  ref={scrollerRef}
                  className="
                    no-scrollbar
                    flex gap-4 overflow-x-auto pb-4
                    snap-x snap-mandatory scroll-smooth
                    [scrollbar-width:none] [-ms-overflow-style:none]
                  "
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <div className="shrink-0 w-6 sm:w-16" />
                  {items.map((r, idx) => (
                    <RecCard
                      key={String(r.id)}
                      rec={r}
                      index={idx}
                      isInDreamTeam={dreamTeamIds.has(String(r.id))}
                      isAdding={addingId === String(r.id)}
                      dreamTeamLoading={loadingDreamTeam}
                      onAdd={() => addToDreamTeam(r.id)}
                    />
                  ))}
                  <div className="shrink-0 w-6 sm:w-16" />
                </div>

                <div className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-16 bg-gradient-to-r from-white to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-16 bg-gradient-to-l from-white to-transparent" />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function RecCard({
  rec,
  isInDreamTeam,
  isAdding,
  dreamTeamLoading,
  onAdd,
}: {
  rec: Rec;
  index: number;
  isInDreamTeam: boolean;
  isAdding: boolean;
  dreamTeamLoading: boolean;
  onAdd: () => void;
}) {
  const teamLabel = rec.team ? `Team: ${rec.team}` : null;

  const playerImageUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${rec.id}.png`;

  return (
    <article
      data-rec-card
      className="
        snap-center shrink-0
        w-[280px] sm:w-[340px] md:w-[380px]
        rounded-2xl border bg-white shadow-sm
        hover:shadow-md transition
        overflow-hidden
      "
    >
      {/* Image area */}
      <div className="relative h-[180px] bg-white flex items-center justify-center">
        <img
          src={playerImageUrl}
          alt={rec.name}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = "none";
          }}
        />

        {typeof rec.similarity === "number" && (
          <div className="absolute top-3 right-3 text-xs text-gray-700 bg-white/90 border rounded-full px-2 py-1 shadow-sm">
            sim: <span className="font-medium">{rec.similarity.toFixed(3)}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        <Link href={`/player/${rec.id}`} className="block text-lg font-semibold truncate hover:underline">
          {rec.name}
        </Link>

        <div className="mt-1 text-xs text-gray-500">
          <div className="truncate">ID: {rec.id}</div>
          {teamLabel && <div className="truncate">{teamLabel}</div>}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <Link
            href={`/player/${rec.id}`}
            className="inline-flex items-center justify-center w-full rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 transition"
          >
            View player →
          </Link>

          <button
            type="button"
            onClick={onAdd}
            disabled={dreamTeamLoading || isAdding || isInDreamTeam}
            className={[
              "inline-flex items-center justify-center w-full rounded-xl px-3 py-2 text-sm transition border",
              isInDreamTeam
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 cursor-not-allowed"
                : "bg-white hover:bg-gray-50",
              (dreamTeamLoading || isAdding) ? "opacity-60 cursor-wait" : "",
            ].join(" ")}
          >
            {isInDreamTeam ? "Added to Dream Team ✓" : isAdding ? "Adding..." : "Add to Dream Team"}
          </button>
        </div>
      </div>
    </article>
  );
}
