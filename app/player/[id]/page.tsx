"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import PlayerImage from "@/components/PlayerImage";
import PlayerOverview from "@/components/PlayerOverview";
import { addDreamTeamPlayer } from "@/lib/dream-team";
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
  const supabase = useMemo(() => createClient(), []);

  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null,
  );
  const [player, setPlayer] = useState<any>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [loadError, setLoadError] = useState("");

  const [activeChart, setActiveChart] = useState<"total" | "perGame">("total");

  const [user, setUser] = useState<any>(null);
  const [isPlayerInDreamTeam, setIsPlayerInDreamTeam] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const [hofChance, setHofChance] = useState<number | null>(null);
  const [animatedChance, setAnimatedChance] = useState<number>(0);

  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({});
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [savingReaction, setSavingReaction] = useState(false);
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

    let cancelled = false;
    setPlayer(null);
    setStats(null);
    setLoadError("");
    setHofChance(null);
    if (!/^\d+$/.test(resolvedParams.id)) {
      setLoadError(
        "Invalid player link. Return to search and choose a player.",
      );
      return;
    }

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
          .maybeSingle();

        const { data: playerStats, error: statsError } = await supabase
          .from("FullStats_NBA")
          .select("*")
          .eq("PERSON_ID", resolvedParams.id)
          .maybeSingle();

        if (cancelled) return;
        if (playerError || statsError || !playerData) {
          setLoadError(
            !playerData && !playerError
              ? "Player not found. Return to search to choose another player."
              : "Unable to load player data. Please retry.",
          );
          console.error("Error fetching data:", playerError || statsError);
          return;
        }

        setPlayer(playerData);
        setStats(playerStats);
      } catch (err) {
        if (!cancelled)
          setLoadError("Unable to load player data. Please retry.");
        console.error("Error fetching player data:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    setIsPlayerInDreamTeam(false);
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
      try {
        const res = await fetch(
          `/api/reactions?player_id=${resolvedParams.id}`,
        );
        const data = await res.json();
        if (!res.ok || !Array.isArray(data))
          throw new Error("Reactions temporarily unavailable.");

        const counts: ReactionCounts = {};
        data.forEach((item: { _id: string; count: number }) => {
          counts[item._id] = item.count;
        });
        setReactionCounts(counts);
      } catch {
        setReactionError("Reactions temporarily unavailable.");
      }
    })();
  }, [resolvedParams]);

  const handlePlayerSelect = (secondPlayerId: string) => {
    router.push(
      `/compare?player1=${resolvedParams?.id}&player2=${secondPlayerId}`,
    );
  };

  const generalStatsData = useMemo(
    () => [
      { name: "Points", value: stats?.PTS || 0 },
      { name: "Rebounds", value: stats?.REB || 0 },
      { name: "Assists", value: stats?.AST || 0 },
      { name: "Steals", value: stats?.STL || 0 },
      { name: "Blocks", value: stats?.BLK || 0 },
    ],
    [stats],
  );

  const perGameData = useMemo(
    () => [
      { name: "PPG", value: stats?.GP > 0 ? stats.PTS / stats.GP : 0 },
      { name: "APG", value: stats?.GP > 0 ? stats.AST / stats.GP : 0 },
      { name: "RPG", value: stats?.GP > 0 ? stats.REB / stats.GP : 0 },
      { name: "FG %", value: stats?.FG_PCT ? stats.FG_PCT * 100 : 0 },
      { name: "FT %", value: stats?.FT_PCT ? stats.FT_PCT * 100 : 0 },
    ],
    [player, stats],
  );

  const pieColors = useMemo(
    () => ["hsl(var(--chart-4))", "hsl(var(--chart-2))", "hsl(var(--chart-5))"],
    [],
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
    if (loadError)
      return (
        <div role="alert" className="rounded-xl border p-6 space-y-3">
          <p>{loadError}</p>
          <button
            onClick={() => setResolvedParams((p) => (p ? { ...p } : null))}
            className="underline"
          >
            Retry
          </button>
          <BackToSearchButton />
        </div>
      );
    return (
      <div className="py-10 text-center text-sm text-foreground/70">
        Loading...
      </div>
    );
  }

  const chartFill =
    activeChart === "total" ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))";

  return (
    <div className="w-full">
      <PlayerOverview
        id={Number(player.PERSON_ID)}
        signedIn={!!user}
        inTeam={isPlayerInDreamTeam}
        saving={savingTeam}
        onCompare={() => {
          setShowCompareSearch(true);
          setTimeout(
            () =>
              document
                .getElementById("profile-compare")
                ?.scrollIntoView({ behavior: "smooth" }),
            0,
          );
        }}
        onAdd={async () => {
          if (!user) {
            router.push(`/sign-in?redirect=/player/${player.PERSON_ID}`);
            return;
          }
          if (savingTeam || isPlayerInDreamTeam) return;
          setSavingTeam(true);
          setTeamError(null);
          try {
            await addDreamTeamPlayer(supabase, Number(player.PERSON_ID));
            setIsPlayerInDreamTeam(true);
          } catch (e) {
            setTeamError((e as Error).message);
          } finally {
            setSavingTeam(false);
          }
        }}
      />
      {teamError && (
        <p role="alert" className="text-amber-500 mb-3">
          {teamError}
        </p>
      )}

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
              <PlayerImage
                playerId={player.PERSON_ID}
                loading="eager"
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
            <InfoRow
              label="Draft Number"
              value={player.DRAFT_NUMBER || "N/A"}
            />
            <InfoRow
              label="Latest stored roster team"
              value={player.TEAM_NAME || "No Team"}
            />
          </div>
        </CardContent>
      </Card>

      {/* HOF */}
      {hofChance !== null && (
        <Card className="mt-6 bg-background/35 backdrop-blur border-foreground/10">
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">
                Experimental Hall of Fame model · not an official NBA prediction
              </div>
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
          <div className="text-sm text-foreground/70">
            Your reactions are saved & counted.
          </div>
          {reactionError && (
            <p role="status" className="text-sm text-foreground/60">
              {reactionError}
            </p>
          )}
        </div>

        <div className="flex items-center gap-6">
          {["🔥", "🐐", "🗑️"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              disabled={savingReaction}
              onClick={async () => {
                if (!user) {
                  router.push("/sign-in");
                  return;
                }
                setSavingReaction(true);
                setReactionError(null);
                try {
                  await axios.post("/api/reactions", {
                    player_id: player.PERSON_ID,
                    reaction: emoji,
                  });
                  const res = await fetch(
                    `/api/reactions?player_id=${player.PERSON_ID}`,
                  );
                  if (!res.ok) throw new Error("Unavailable");
                  const data = await res.json();
                  setReactionCounts(
                    Object.fromEntries(
                      data.map((r: { _id: string; count: number }) => [
                        r._id,
                        r.count,
                      ]),
                    ),
                  );
                } catch {
                  setReactionError(
                    "Could not save your reaction. Please try again later.",
                  );
                } finally {
                  setSavingReaction(false);
                }
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
      <p className="mt-6 text-sm text-foreground/60">
        Historical archive imported with the original project.
        Coverage and last update are unverified; these are not current career
        totals. Per-game values below are calculated from the same archived
        totals and games played.
      </p>
      {!stats && (
        <p className="rounded-xl border p-4">
          No historical totals available for this player. The profile and any
          verified season statistics remain available above.
        </p>
      )}
      {stats && (
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
                  <BarChart
                    data={
                      activeChart === "total" ? generalStatsData : perGameData
                    }
                  >
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "hsl(var(--foreground))" }}
                    />
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
                    <Legend
                      wrapperStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar
                      dataKey="value"
                      fill={chartFill}
                      radius={[10, 10, 4, 4]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </CardContent>
          </Card>

          <Card className="bg-background/35 backdrop-blur border-foreground/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Point distribution</CardTitle>
              <div className="text-sm text-foreground/70">
                Share of points by scoring type
              </div>
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
      )}

      {/* Compare search */}
      {showCompareSearch && (
        <Card
          id="profile-compare"
          className="mt-6 bg-background/35 backdrop-blur border-foreground/10"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Choose player to compare
            </CardTitle>
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

      <div className="mt-8">
        <BackToSearchButton />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background/20 px-3 py-2">
      <div className="text-xs text-foreground/60">{label}</div>
      <div className="font-semibold">
        {String(value ?? "—").replace(/\.0+$/, "")}
      </div>
    </div>
  );
}
