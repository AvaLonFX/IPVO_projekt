"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SearchPlayers from "../../components/nba_comp/SearchPlayers";
import Recommendations from "@/components/Recommendations";
import NBASchedule from "@/components/NBASchedule";

type SidebarPlayer = {
  player_id: string | number;
  player_name?: string | null;
  FullStats_NBA?: { PLAYER_NAME?: string | null } | null;
  count?: number | null;
};

export default function DashboardPage() {
  const router = useRouter();

  const [mostSearched, setMostSearched] = useState<SidebarPlayer[]>([]);
  const [mostAdded, setMostAdded] = useState<SidebarPlayer[]>([]);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingB, setLoadingB] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoadingA(true);
        const r = await fetch("/api/most-searched");
        const j = await r.json();
        setMostSearched(Array.isArray(j) ? j : []);
      } catch {
        setMostSearched([]);
      } finally {
        setLoadingA(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoadingB(true);
        const r = await fetch("/api/most-added");
        const j = await r.json();
        setMostAdded(Array.isArray(j) ? j : []);
      } catch {
        setMostAdded([]);
      } finally {
        setLoadingB(false);
      }
    })();
  }, []);

  const goPlayer = (playerOrId: any) => {
    const id =
      playerOrId?.PERSON_ID ??
      playerOrId?.PLAYER_ID ??
      playerOrId?.id ??
      playerOrId;
    router.push(`/player/${id}`);
  };

  const kpiTrending = useMemo(() => mostSearched.length, [mostSearched]);
  const kpiAdded = useMemo(() => mostAdded.length, [mostAdded]);

  return (
    <div className="w-full">
      {/* Title + search */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Player Dashboard</h1>
        <p className="text-sm text-foreground/60">
          Search, compare, and analyze players with your data tools.
        </p>

        <div className="mt-4">
          <div className="text-xs text-foreground/60 mb-1"></div>
          <SearchPlayers onPlayerClick={goPlayer} />
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Trending list" value={String(kpiTrending)} sub="players" />
        <Kpi title="Dream Team list" value={String(kpiAdded)} sub="players" />
        <Kpi title="Tools" value="Stats" sub="all-time • current" />
        <Kpi title="Schedule" value="Live" sub="upcoming games" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        {/* LEFT */}
        <div className="space-y-6">
          <CardShell
            title="Top trending players"
            subtitle="Based on your search activity"
            rightLabel="Searches"
          >
            {loadingA ? (
              <Muted>Loading…</Muted>
            ) : mostSearched.length === 0 ? (
              <Muted>No data yet.</Muted>
            ) : (
              <ul className="space-y-1">
                {mostSearched.slice(0, 12).map((p, idx) => (
                  <RankRow
                    key={String(p.player_id)}
                    rank={idx + 1}
                    id={p.player_id}
                    name={p.FullStats_NBA?.PLAYER_NAME || p.player_name || "Unknown"}
                    metric={p.count}
                    metricFallback={idx === 0 ? "HOT" : null}
                    onClick={() => goPlayer(p.player_id)}
                  />
                ))}
              </ul>
            )}
          </CardShell>

          <CardShell
            title="Top Dream Team adds"
            subtitle="Players users add the most"
            rightLabel="Adds"
          >
            {loadingB ? (
              <Muted>Loading…</Muted>
            ) : mostAdded.length === 0 ? (
              <Muted>No data yet.</Muted>
            ) : (
              <ul className="space-y-1">
                {mostAdded.slice(0, 12).map((p, idx) => (
                  <RankRow
                    key={String(p.player_id)}
                    rank={idx + 1}
                    id={p.player_id}
                    name={p.FullStats_NBA?.PLAYER_NAME || p.player_name || "Unknown"}
                    metric={p.count}
                    metricFallback={idx === 0 ? "TOP" : null}
                    onClick={() => goPlayer(p.player_id)}
                  />
                ))}
              </ul>
            )}
          </CardShell>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          <CardShell title="Quick tools" subtitle="Jump into stats views" rightLabel={null}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ToolTile
                title="All-time stats"
                desc="Career leaders, history, legends"
                onClick={() => router.push("/alltimestats")}
              />
              <ToolTile
                title="Current stats"
                desc="This season, current form, trends"
                onClick={() => router.push("/currentstats")}
              />
            </div>
          </CardShell>

          <section className="rounded-2xl border bg-background shadow-sm">
            <div className="p-4">
              <Recommendations />
            </div>
          </section>

          <CardShell title="NBA schedule" subtitle="Upcoming games" rightLabel="Preview">
            <div className="max-h-[420px] overflow-auto rounded-xl border bg-card text-foreground">
                <div className="qnba-schedule-fix">
                <NBASchedule />
                </div>
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
}

/* helpers */

function Kpi({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <section className="rounded-2xl border bg-background shadow-sm p-4">
      <div className="text-xs text-foreground/60">{title}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-foreground/60">{sub}</div>
      <div className="mt-3 h-1 w-full rounded-full bg-gradient-to-r from-orange-500/70 via-orange-400/40 to-transparent" />
    </section>
  );
}

function CardShell({
  title,
  subtitle,
  rightLabel,
  children,
}: {
  title: string;
  subtitle: string;
  rightLabel: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-background shadow-sm overflow-hidden">
      <div className="border-b px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
          <p className="text-xs text-foreground/60">{subtitle}</p>
        </div>
        {rightLabel ? (
          <div className="text-xs text-foreground/60 rounded-full border px-2 py-1">
            {rightLabel}
          </div>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-foreground/60">{children}</p>;
}

function RankRow({
  rank,
  id,
  name,
  metric,
  metricFallback,
  onClick,
}: {
  rank: number;
  id: string | number;
  name: string;
  metric?: number | null;
  metricFallback?: string | null;
  onClick: () => void;
}) {
  const imgUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-foreground/5 transition"
      >
        <div className="w-8 shrink-0 text-xs font-semibold text-foreground/60">
          #{rank}
        </div>

        <img
          src={imgUrl}
          alt={name}
          className="h-10 w-10 rounded-full object-cover bg-foreground/5"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="text-xs text-foreground/60 truncate">ID: {String(id)}</div>
        </div>

        <div className="shrink-0">
          {typeof metric === "number" ? (
            <div className="rounded-full border px-2 py-1 text-xs font-semibold text-foreground/80">
              {metric}
            </div>
          ) : metricFallback ? (
            <div className="rounded-full border px-2 py-1 text-xs font-semibold text-orange-600">
              {metricFallback}
            </div>
          ) : null}
        </div>
      </button>
    </li>
  );
}

function ToolTile({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border p-4 text-left shadow-sm hover:shadow-md hover:bg-foreground hover:text-background transition"
    >
      <div className="text-sm font-bold">{title}</div>
      <div className="mt-1 text-xs opacity-80">{desc}</div>
    </button>
  );
}
