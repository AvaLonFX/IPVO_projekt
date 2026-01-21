"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button as UiButton } from "@/components/ui/button";
import BackToSearchButton from "@/components/backtosearchbutton";
import SearchPlayers from "../../../components/nba_comp/SearchPlayers";
import { createClient } from "@/utils/supabase/client";
import { trackInteraction } from "@/lib/trackInteraction";

type ReactionCounts = Record<string, number>;

export default function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null
  );
  const [player, setPlayer] = useState<any>(null);
  const [stats, setStats] = useState<any | null>(null);

  const [activeChart, setActiveChart] = useState<"total" | "perGame">("total");

  const [user, setUser] = useState<any>(null);
  const [isPlayerInDreamTeam, setIsPlayerInDreamTeam] = useState(false);

  const [hofChance, setHofChance] = useState<number | null>(null);
  const [animatedChance, setAnimatedChance] = useState<number>(0);

  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({});
  const [showCompareSearch, setShowCompareSearch] = useState(false);

  useEffect(() => {
    (async () => {
      const resolved = await params;
      setResolvedParams(resolved);
    })();
  }, [params]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) return;
      if (!data?.session) return;
      setUser(data.session.user);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!resolvedParams) return;

    trackInteraction({
      itemType: "player",
      itemId: resolvedParams.id,
      eventType: "view_player",
      weight: 3,
    });

    (async () => {
      try {
        const { data: playerData, error: playerError } = await supabase
          .from("Osnovno_NBA")
          .select("*")
          .eq("PERSON_ID", resolvedParams.id)
          .single();

        const { data: playerStats, error: statsError } = await supabase
          .from("FullStats_NBA")
          .select("*")
          .eq("PERSON_ID", resolvedParams.id)
          .single();

        if (playerError || statsError) {
          console.error("Error fetching data:", playerError || statsError);
          return;
        }

        setPlayer(playerData);
        setStats(playerStats);
      } catch (err) {
        console.error("Error fetching player data:", err);
      }
    })();
  }, [resolvedParams, supabase]);

  useEffect(() => {
    if (!resolvedParams) return;

    (async () => {
      const { data, error } = await supabase
        .from("Active_Players_HOF_Predictions")
        .select("HOF_Probability")
        .eq("PLAYER_ID", resolvedParams.id)
        .single();

      if (error || !data || data.HOF_Probability === undefined) return;
      setHofChance(data.HOF_Probability);
    })();
  }, [resolvedParams, supabase]);

  useEffect(() => {
    if (hofChance === null) return;

    let current = 0;
    const target = hofChance;
    const interval = setInterval(() => {
      current += 1;
      setAnimatedChance(Math.min(current, target));
      if (current >= target) clearInterval(interval);
    }, 16);

    return () => clearInterval(interval);
  }, [hofChance]);

  useEffect(() => {
    if (!user || !player) return;

    (async () => {
      const { data } = await supabase
        .from("UserDreamTeams")
        .select("player_id")
        .eq("user_id", user.id)
        .eq("player_id", player.PERSON_ID)
        .single();

      if (data) setIsPlayerInDreamTeam(true);
    })();
  }, [user, player, supabase]);

  useEffect(() => {
    if (!resolvedParams) return;

    (async () => {
      const res = await fetch(`/api/reactions?player_id=${resolvedParams.id}`);
      const data = await res.json();

      const counts: ReactionCounts = {};
      data.forEach((item: { _id: string; count: number }) => {
        counts[item._id] = item.count;
      });
      setReactionCounts(counts);
    })();
  }, [resolvedParams]);

  const handlePlayerSelect = (secondPlayerId: string) => {
    router.push(`/compare?player1=${resolvedParams?.id}&player2=${secondPlayerId}`);
  };

  const playerImageUrl = player?.PERSON_ID
    ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PERSON_ID}.png`
    : "";

  const generalStatsData = useMemo(
    () => [
      { name: "Points", value: stats?.PTS || 0 },
      { name: "Rebounds", value: stats?.REB || 0 },
      { name: "Assists", value: stats?.AST || 0 },
      { name: "Steals", value: stats?.STL || 0 },
      { name: "Blocks", value: stats?.BLK || 0 },
    ],
    [stats]
  );

  const perGameData = useMemo(
    () => [
      { name: "PPG", value: player?.PTS || 0 },
      { name: "APG", value: player?.AST || 0 },
      { name: "RPG", value: player?.REB || 0 },
      { name: "FG %", value: stats?.FG_PCT ? stats.FG_PCT * 100 : 0 },
      { name: "FT %", value: stats?.FT_PCT ? stats.FT_PCT * 100 : 0 },
    ],
    [player, stats]
  );

  const pieColors = useMemo(
    () => ["hsl(var(--chart-4))", "hsl(var(--chart-2))", "hsl(var(--chart-5))"],
    []
  );

  const pieData = useMemo(() => {
    const pts = stats?.PTS || 1;
    const fg2m = (stats?.FGM || 0) - (stats?.FG3M || 0);
    const fg3m = stats?.FG3M || 0;
    const ftm = stats?.FTM || 0;

    const a = (fg2m * 2) / pts;
    const b = (fg3m * 3) / pts;
    const c = ftm / pts;

    return [
      { name: "2PT", value: a * 100 },
      { name: "3PT", value: b * 100 },
      { name: "FT", value: c * 100 },
    ];
  }, [stats]);

  if (!player) {
    return <div className="py-10 text-center text-sm text-foreground/70">Loading...</div>;
  }

  const chartFill =
    activeChart === "total" ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))";

  return (
    <div className="w-full">
    

      {/* Profile */}
      <Card className="bg-background/40 backdrop-blur border-foreground/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl sm:text-2xl">
            {player.PLAYER_FIRST_NAME} {player.PLAYER_LAST_NAME}
          </CardTitle>
          <div className="text-sm text-foreground/70">
            {player.TEAM_NAME || "No Team"} • {player.POSITION}
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
          <div className="flex items-center justify-center">
            <div className="rounded-2xl border border-foreground/10 bg-background/30 p-3 w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={playerImageUrl}
                alt={`${player.PLAYER_FIRST_NAME} ${player.PLAYER_LAST_NAME}`}
                className="w-full h-auto rounded-xl object-contain"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoRow label="Height" value={player.HEIGHT} />
            <InfoRow label="Weight" value={player.WEIGHT} />
            <InfoRow label="College" value={player.COLLEGE || "N/A"} />
            <InfoRow label="Country" value={player.COUNTRY} />
            <InfoRow label="Draft Year" value={player.DRAFT_YEAR || "N/A"} />
            <InfoRow label="Draft Round" value={player.DRAFT_ROUND || "N/A"} />
            <InfoRow label="Draft Number" value={player.DRAFT_NUMBER || "N/A"} />
            <InfoRow label="Team" value={player.TEAM_NAME || "No Team"} />
          </div>
        </CardContent>
      </Card>

      {/* HOF */}
      {hofChance !== null && (
        <Card className="mt-6 bg-background/35 backdrop-blur border-foreground/10">
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Hall of Fame probability</div>
              <div className="text-sm text-foreground/80 font-semibold">
                {animatedChance.toFixed(1)}%
              </div>
            </div>

            <div className="h-3 w-full rounded-full bg-foreground/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${animatedChance}%`,
                  background:
                    "linear-gradient(90deg, hsl(var(--chart-2)), hsl(var(--chart-5)))",
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reactions (NO big square/card around this; bigger icons like before) */}
      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-[220px]">
          <div className="font-semibold">React to player</div>
          <div className="text-sm text-foreground/70">Your reactions are saved & counted.</div>
        </div>

        <div className="flex items-center gap-6">
          {["🔥", "🐐", "🗑️"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={async () => {
                await axios.post("/api/reactions", {
                  user_id: user?.id,
                  player_id: player.PERSON_ID,
                  reaction: emoji,
                });

                setReactionCounts((prev) => ({
                  ...prev,
                  [emoji]: (prev[emoji] || 0) + 1,
                }));
              }}
              className="
                group inline-flex items-center gap-3
                rounded-2xl px-4 py-2
                border border-foreground/10 bg-background/10
                hover:bg-background/15 hover:border-foreground/20
                transition
              "
            >
              <span className="text-2xl sm:text-3xl leading-none">{emoji}</span>
              <span className="text-lg sm:text-xl font-semibold tabular-nums text-foreground/90">
                {reactionCounts[emoji] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-background/35 backdrop-blur border-foreground/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Stats</CardTitle>

            <div className="flex items-center gap-2">
              <UiButton
                size="sm"
                variant={activeChart === "total" ? "default" : "outline"}
                onClick={() => setActiveChart("total")}
              >
                Total
              </UiButton>
              <UiButton
                size="sm"
                variant={activeChart === "perGame" ? "default" : "outline"}
                onClick={() => setActiveChart("perGame")}
              >
                Per Game
              </UiButton>
            </div>
          </CardHeader>

          <CardContent className="h-[320px] sm:h-[360px]">
            <motion.div
              key={activeChart}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeChart === "total" ? generalStatsData : perGameData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--foreground))" }} />
                  <YAxis tick={{ fill: "hsl(var(--foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      color: "hsl(var(--popover-foreground))",
                      borderRadius: 12,
                    }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Legend wrapperStyle={{ color: "hsl(var(--foreground))" }} />
                  <Bar dataKey="value" fill={chartFill} radius={[10, 10, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </CardContent>
        </Card>

        <Card className="bg-background/35 backdrop-blur border-foreground/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Point distribution</CardTitle>
            <div className="text-sm text-foreground/70">Share of points by scoring type</div>
          </CardHeader>

          <CardContent className="h-[320px] sm:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  label={({ value }) => `${Number(value).toFixed(1)}%`}
                  labelLine
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => `${Number(v).toFixed(1)}%`}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--popover-foreground))",
                    borderRadius: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Compare search */}
      {showCompareSearch && (
        <Card className="mt-6 bg-background/35 backdrop-blur border-foreground/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Choose player to compare</CardTitle>
          </CardHeader>
          <CardContent>
            <SearchPlayers
              onPlayerSelect={(secondPlayerId: string) => {
                handlePlayerSelect(secondPlayerId);
                setShowCompareSearch(false);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Bottom actions (back to old place) */}
      <div className="mt-10 pb-2 flex items-center justify-center">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <UiButton
            className="w-full sm:w-auto"
            variant="outline"
            onClick={() => {
              trackInteraction({
                itemType: "player",
                itemId: player?.PERSON_ID ?? resolvedParams?.id,
                eventType: "compare_click",
                weight: 4,
              });
              setShowCompareSearch(true);
              // scroll to compare search on mobile
              setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50);
            }}
          >
            Compare
          </UiButton>

          <UiButton
            className="w-full sm:w-auto"
            onClick={async () => {
              if (!player || isPlayerInDreamTeam) return;
              const { error } = await supabase
                .from("UserDreamTeams")
                .insert([{ user_id: user?.id, player_id: player.PERSON_ID }]);

              if (error) {
                console.error("Error adding player to Dream Team:", error);
                return;
              }
              setIsPlayerInDreamTeam(true);
            }}
            disabled={isPlayerInDreamTeam}
          >
            {isPlayerInDreamTeam ? "Already in Dream Team" : "Add to Dream Team"}
          </UiButton>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background/20 px-3 py-2">
      <div className="text-xs text-foreground/60">{label}</div>
      <div className="font-semibold">{String(value ?? "—")}</div>
    </div>
  );
}
