"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import Button from "@/components/backtosearchbutton";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type PlayerRow = {
  PERSON_ID: string;
  PLAYER_FIRST_NAME: string;
  PLAYER_LAST_NAME: string;
  TEAM_NAME?: string | null;
  POSITION?: string | null;
  HEIGHT?: string | null;
  WEIGHT?: string | null;
  COLLEGE?: string | null;
  COUNTRY?: string | null;
  DRAFT_YEAR?: string | null;
  DRAFT_ROUND?: string | null;
  DRAFT_NUMBER?: string | null;

  // per-game (iz Osnovno_NBA u tvom kodu)
  PTS?: number | null;
  REB?: number | null;
  AST?: number | null;
};

type StatsRow = {
  PERSON_ID: string;
  PTS?: number | null;
  REB?: number | null;
  AST?: number | null;
  STL?: number | null;
  BLK?: number | null;
  FG_PCT?: number | null;
  FT_PCT?: number | null;
};

export default function ComparePage() {
  const router = useRouter();

  const [player1Id, setPlayer1Id] = useState<string | null>(null);
  const [player2Id, setPlayer2Id] = useState<string | null>(null);

  const [player1, setPlayer1] = useState<PlayerRow | null>(null);
  const [player2, setPlayer2] = useState<PlayerRow | null>(null);
  const [stats1, setStats1] = useState<StatsRow | null>(null);
  const [stats2, setStats2] = useState<StatsRow | null>(null);

  const [activeChart, setActiveChart] = useState<"total" | "perGame">("total");

  // Read IDs from URL
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p1Id = sp.get("player1");
    const p2Id = sp.get("player2");

    if (!p1Id || !p2Id) {
      router.push("/");
      return;
    }
    setPlayer1Id(p1Id);
    setPlayer2Id(p2Id);
  }, [router]);

  // Fetch both players + stats
  useEffect(() => {
    if (!player1Id || !player2Id) return;

    const fetchPlayer = async (
      playerId: string,
      setPlayer: (p: PlayerRow | null) => void,
      setStats: (s: StatsRow | null) => void
    ) => {
      const [{ data: playerData, error: playerError }, { data: playerStats, error: statsError }] =
        await Promise.all([
          supabase.from("Osnovno_NBA").select("*").eq("PERSON_ID", playerId).single(),
          supabase.from("FullStats_NBA").select("*").eq("PERSON_ID", playerId).single(),
        ]);

      if (playerError || statsError) {
        console.error("Error fetching compare data:", playerError || statsError);
        setPlayer(null);
        setStats(null);
        return;
      }

      setPlayer(playerData as PlayerRow);
      setStats(playerStats as StatsRow);
    };

    fetchPlayer(player1Id, setPlayer1, setStats1);
    fetchPlayer(player2Id, setPlayer2, setStats2);
  }, [player1Id, player2Id]);

  const isReady = player1 && player2 && stats1 && stats2;

  const totalStatsData = useMemo(
    () => [
      { stat: "Points", player1: stats1?.PTS ?? 0, player2: stats2?.PTS ?? 0 },
      { stat: "Rebounds", player1: stats1?.REB ?? 0, player2: stats2?.REB ?? 0 },
      { stat: "Assists", player1: stats1?.AST ?? 0, player2: stats2?.AST ?? 0 },
      { stat: "Steals", player1: stats1?.STL ?? 0, player2: stats2?.STL ?? 0 },
      { stat: "Blocks", player1: stats1?.BLK ?? 0, player2: stats2?.BLK ?? 0 },
    ],
    [stats1, stats2]
  );

  const perGameStatsData = useMemo(
    () => [
      { stat: "PPG", player1: player1?.PTS ?? 0, player2: player2?.PTS ?? 0 },
      { stat: "RPG", player1: player1?.REB ?? 0, player2: player2?.REB ?? 0 },
      { stat: "APG", player1: player1?.AST ?? 0, player2: player2?.AST ?? 0 },
      { stat: "FG%", player1: (stats1?.FG_PCT ?? 0) * 100, player2: (stats2?.FG_PCT ?? 0) * 100 },
      { stat: "FT%", player1: (stats1?.FT_PCT ?? 0) * 100, player2: (stats2?.FT_PCT ?? 0) * 100 },
    ],
    [player1, player2, stats1, stats2]
  );

  if (!isReady) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">Player comparison</h1>
          <Button />
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/40 backdrop-blur p-6 text-center">
          <div className="text-lg font-semibold">Loading...</div>
          <div className="text-sm text-foreground/60 mt-1">
            Fetching players & stats
          </div>
        </div>
      </div>
    );
  }

  const p1Name = `${player1.PLAYER_FIRST_NAME} ${player1.PLAYER_LAST_NAME}`;
  const p2Name = `${player2.PLAYER_FIRST_NAME} ${player2.PLAYER_LAST_NAME}`;

  return (
    <div className="w-full space-y-6">
      {/* Top row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Compare</h1>
          <p className="text-sm text-foreground/60">
            {p1Name} vs {p2Name}
          </p>
        </div>
        <div className="shrink-0">
          <Button />
        </div>
      </div>

      {/* Player cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlayerCard player={player1} />
        <PlayerCard player={player2} />
      </div>

      {/* Chart section */}
      <Card className="border-border/60 bg-background/40 backdrop-blur">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Stats</CardTitle>
            <div className="text-sm text-foreground/60">
              Switch between totals and per-game
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveChart("total")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                activeChart === "total"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-foreground/80 border-border/60 hover:bg-foreground/5"
              }`}
            >
              Total
            </button>
            <button
              onClick={() => setActiveChart("perGame")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                activeChart === "perGame"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-foreground/80 border-border/60 hover:bg-foreground/5"
              }`}
            >
              Per game
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Responsive chart container */}
          <div className="w-full h-[320px] sm:h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeChart === "total" ? totalStatsData : perGameStatsData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="stat" tick={{ fill: "currentColor" }} />
                <YAxis tick={{ fill: "currentColor" }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(0,0,0,0.75)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    color: "white",
                  }}
                />
                <Legend />
                <Bar dataKey="player1" fill="#8884d8" name={player1.PLAYER_FIRST_NAME} radius={[8, 8, 0, 0]} />
                <Bar dataKey="player2" fill="#82ca9d" name={player2.PLAYER_FIRST_NAME} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 text-xs text-foreground/60">
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlayerCard({ player }: { player: PlayerRow }) {
  const fullName = `${player.PLAYER_FIRST_NAME} ${player.PLAYER_LAST_NAME}`;

  return (
    <Card className="border-border/60 bg-background/40 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg">{fullName}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col sm:flex-row gap-5 sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img
            src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PERSON_ID}.png`}
            alt={fullName}
            className="w-28 sm:w-36 md:w-44 h-auto rounded-2xl border border-border/60 bg-black/10 object-contain"
          />
          <div className="text-sm text-foreground/80 space-y-1">
            <div className="font-semibold text-base text-foreground">{player.TEAM_NAME || "No Team"}</div>
            <div className="text-foreground/70">
              {player.POSITION ? `Position: ${player.POSITION}` : "Position: N/A"}
            </div>
            <div className="text-foreground/70">
              {player.HEIGHT ? `Height: ${player.HEIGHT}` : "Height: N/A"}{" "}
              {player.WEIGHT ? `• Weight: ${player.WEIGHT}` : ""}
            </div>
            <div className="text-foreground/70">
              {player.COUNTRY ? `Country: ${player.COUNTRY}` : "Country: N/A"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
          <MiniStat label="PTS" value={player.PTS ?? 0} />
          <MiniStat label="REB" value={player.REB ?? 0} />
          <MiniStat label="AST" value={player.AST ?? 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/30 px-3 py-2 text-center">
      <div className="text-[11px] uppercase tracking-wide text-foreground/60">{label}</div>
      <div className="text-lg font-bold">{Number.isFinite(value) ? value : 0}</div>
    </div>
  );
}
