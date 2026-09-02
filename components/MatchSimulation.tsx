"use client";
import { useEffect, useRef, useState } from "react";
import {
  defaultRotation,
  tacticInfo,
  type Simulation,
  type Tactic,
} from "@/lib/match-simulation";
import {
  MatchLineups,
  MatchInsights,
  HalftimeCoachingReport,
  FinalGameSummary,
  playPresentation,
  type PreviewPlayer,
} from "@/components/MatchInsights";
import { assignLineup } from "@/lib/lineup-roles";
import PlayerImage from "@/components/PlayerImage";
const button =
  "rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-foreground/10 disabled:opacity-40";
const labels = Object.fromEntries(
  Object.entries(tacticInfo).map(([key, value]) => [key, value.label]),
) as Record<Tactic, string>;
type Result = Simulation & {
  season: string;
  syncedAt: string;
  simulationToken?: string;
};
type ChallengeSetup = {
  ids: number[];
  minutes: number[];
  tactic: Tactic;
  secondHalfTactic: Tactic;
};
type MatchSeries = {
  bestOf: number;
  needed: number;
  wins: number[];
  winner: number;
  games: Result[];
};
type ChallengeState = {
  code: string;
  status: "open" | "coaching" | "playing_first_half" | "halftime" | "playing_second_half" | "completed";
  role: "creator" | "opponent" | "spectator";
  bestOf: number;
  mode: "classic" | "salary" | "draft";
  creator: ChallengeSetup;
  opponent?: ChallengeSetup;
  ready: boolean[];
  wins: number[];
  games: Result[];
  currentGame?: Result | null;
  gameStartedAt?: string | null;
  halftimeStartedAt?: string | null;
  halftimeReady?: boolean[];
  result?: Result | null;
  series?: MatchSeries | null;
};
function seriesSummary(games: Result[]) {
  const players = new Map<string, { name: string; games: number; pts: number; reb: number; ast: number; stl: number; blk: number; tov: number }>();
  let closest = 0, closestMargin = Infinity, totalMargin = 0;
  let bestGame: { name: string; pts: number; game: number } | null = null;
  games.forEach((game, gameIndex) => {
    const margin = Math.abs(game.score[0] - game.score[1]); totalMargin += margin; if (margin < closestMargin) { closestMargin = margin; closest = gameIndex; }
    game.boxes.flat().forEach(p => { if (!bestGame || p.pts > bestGame.pts) bestGame = { name: p.name, pts: p.pts, game: gameIndex + 1 }; const key = String(p.id); const row = players.get(key) || { name: p.name, games: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 }; row.games++; row.pts += p.pts; row.reb += p.reb; row.ast += p.ast; row.stl += p.stl; row.blk += p.blk; row.tov += p.tov; players.set(key, row); });
  });
  const ranked = Array.from(players.values()).sort((a, b) => (b.pts + b.reb * .7 + b.ast * 1.2 + b.stl * 2 + b.blk * 2 - b.tov) / b.games - (a.pts + a.reb * .7 + a.ast * 1.2 + a.stl * 2 + a.blk * 2 - a.tov) / a.games);
  return { mvp: ranked[0], closest: games.length ? { number: closest + 1, margin: closestMargin } : null, averageMargin: games.length ? totalMargin / games.length : 0, bestGame: bestGame as { name: string; pts: number; game: number } | null };
}
export default function MatchSimulation({
  a,
  b,
  teams,
  challengeCode,
  challengeCreator,
  challengeResult,
  challengeBestOf,
  challengeSeries,
  challengeState,
  onSimulationActiveChange,
  onChallengeUpdate,
}: {
  a: number[];
  b: number[];
  teams: PreviewPlayer[][];
  challengeCode?: string;
  challengeCreator?: ChallengeSetup;
  challengeResult?: Result | null;
  challengeBestOf?: number;
  challengeSeries?: MatchSeries | null;
  challengeState?: ChallengeState | null;
  onSimulationActiveChange?: (active: boolean) => void;
  onChallengeUpdate?: (state: ChallengeState) => void;
}) {
  const [plans, setPlans] = useState<Tactic[]>([
    challengeCreator?.tactic || "balanced",
    challengeState?.opponent?.tactic || "balanced",
  ]);
  const [rotations, setRotations] = useState<number[][]>(() =>
    teams.map((team, side) =>
      side === 0 && challengeCreator
        ? challengeCreator.minutes
        : defaultRotation(team),
    ),
  );
  const [secondPlans, setSecondPlans] = useState<Tactic[]>([
    challengeCreator?.secondHalfTactic || "balanced",
    challengeState?.opponent?.secondHalfTactic || "balanced",
  ]);
  const [result, setResult] = useState<Result | null>(challengeResult || null),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [running, setRunning] = useState(false),
    [cursor, setCursor] = useState(challengeResult?.plays.length || 0),
    [speed, setSpeed] = useState(100),
    [halftimePending, setHalftimePending] = useState(false),
    [halftimeApplied, setHalftimeApplied] = useState(!!challengeResult),
    [savedId, setSavedId] = useState<string | null>(null),
    [shareUrl, setShareUrl] = useState(""),
    [shareCopied, setShareCopied] = useState(false),
    [showFullLineups, setShowFullLineups] = useState(false),
    [bestOf, setBestOf] = useState(challengeBestOf || 1),
    [challengeMode, setChallengeMode] = useState<"classic" | "salary" | "draft">("classic"),
    [lobby, setLobby] = useState<ChallengeState | null>(challengeState || null),
    [participantRole, setParticipantRole] = useState<"creator" | "opponent" | "spectator">(challengeState?.role || "spectator"),
    [series, setSeries] = useState<MatchSeries | null>(challengeSeries || null),
    [seriesGame, setSeriesGame] = useState(
      challengeSeries?.games.length ? challengeSeries.games.length - 1 : 0,
    );
  const lock = useRef(false);
  const finishLock = useRef(false);
  const editableSide = !challengeCode
    ? -1
    : participantRole === "creator"
      ? 0
      : participantRole === "opponent"
        ? 1
        : -2;
  const coaching = !!challengeCode && lobby?.status === "coaching";
  const legalSides = teams.map(
    (team) =>
      team.length >= 5 && team.length <= 8 && !!assignLineup(team.slice(0, 5)),
  );
  const legal = legalSides.every(Boolean);
  const validMinuteSides = rotations.map(
    (minutes, side) =>
      minutes.length === teams[side].length &&
      minutes.every((value) => value >= 0 && value <= 48) &&
      Math.abs(minutes.reduce((sum, value) => sum + value, 0) - 240) < 0.05,
  );
  const validMinutes = validMinuteSides.every(Boolean);
  const halftimeIndex = result
    ? result.plays.findIndex((play) => play.period >= 3)
    : -1;
  useEffect(() => {
    if (challengeCode || !running || !result) return;
    const timer = setInterval(
      () =>
        setCursor((n) =>
          Math.min(
            n + 1,
            !halftimeApplied && halftimeIndex > 0
              ? halftimeIndex
              : result.plays.length,
          ),
        ),
      speed,
    );
    return () => clearInterval(timer);
  }, [challengeCode, running, result, speed, halftimeApplied, halftimeIndex]);
  useEffect(() => {
    if (result && cursor >= result.plays.length) setRunning(false);
  }, [cursor, result]);
  useEffect(() => {
    onSimulationActiveChange?.(!!result);
  }, [result, onSimulationActiveChange]);
  useEffect(() => {
    if (
      result &&
      !halftimeApplied &&
      halftimeIndex > 0 &&
      cursor >= halftimeIndex
    ) {
      setCursor(halftimeIndex);
      setRunning(false);
      setHalftimePending(true);
    }
  }, [cursor, result, halftimeApplied, halftimeIndex]);
  useEffect(() => {
    if (!challengeCode || lobby?.status === "completed") return;
    const refresh = async () => {
      const response = await fetch(`/api/match-challenges?code=${encodeURIComponent(challengeCode)}`, { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as ChallengeState;
      setLobby(next);
      onChallengeUpdate?.(next);
      if (participantRole === "spectator" && next.role !== "spectator") setParticipantRole(next.role);
      if (next.currentGame) {
        setResult(next.currentGame);
        setHalftimeApplied(true);
      } else if (next.games?.length && next.games.length !== (lobby?.games?.length || 0)) {
        const game = next.games[next.games.length - 1];
        setResult(game);
        setCursor(game.plays.length);
        setSeriesGame(next.games.length - 1);
      }
      if (next.series) setSeries(next.series);
    };
    const timer = setInterval(() => void refresh(), 4000);
    return () => clearInterval(timer);
  }, [challengeCode, lobby?.status, lobby?.games?.length, onChallengeUpdate, participantRole]);
  useEffect(() => {
    if (!challengeCode || !result || !lobby) return;
    const half = result.plays.findIndex((play) => play.period >= 3);
    const tick = () => {
      if (lobby.status === "playing_first_half" && lobby.gameStartedAt) {
        setCursor(Math.min(half, Math.max(0, Math.floor((Date.now() - new Date(lobby.gameStartedAt).getTime()) / 100))));
      } else if (lobby.status === "halftime") setCursor(half);
      else if (lobby.status === "playing_second_half" && lobby.halftimeStartedAt) {
        const next = Math.min(result.plays.length, half + Math.max(0, Math.floor((Date.now() - new Date(lobby.halftimeStartedAt).getTime()) / 100)));
        setCursor(next);
        if (next >= result.plays.length && !finishLock.current) {
          finishLock.current = true;
          fetch(`/api/match-challenges/${challengeCode}/finish`, { method: "POST" }).then(async response => {
            const data = await response.json(); if (!response.ok) throw Error(data.error);
            if (data.status === "syncing") return;
            const refreshed = { ...lobby, ...data, currentGame: null } as ChallengeState; setLobby(refreshed); onChallengeUpdate?.(refreshed);
            if (data.series) setSeries(data.series);
          }).catch(event => setError(event.message)).finally(() => { finishLock.current = false; });
        }
      }
    };
    tick(); const timer = setInterval(tick, 100); return () => clearInterval(timer);
  }, [challengeCode, result, lobby, onChallengeUpdate]);
  async function start(resumeAtHalftime = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setRunning(false);
    try {
      if (challengeCode && lobby?.status === "open") {
        const res = await fetch(
          `/api/match-challenges/${challengeCode}/complete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ opponent: sideSetup(1) }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw Error(data.error || "Challenge failed.");
        const next = { ...lobby, status: "coaching", opponent: sideSetup(1), role: "opponent", ready: [false, false] } as ChallengeState;
        setLobby(next);
        setParticipantRole("opponent");
        onChallengeUpdate?.(next);
        return;
      }
      const res = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          a,
          b,
          plans,
          rotations,
          ...(resumeAtHalftime && result
            ? {
                secondHalfPlans: secondPlans,
                simulationToken: result.simulationToken,
              }
            : {}),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw Error(d.error || "Simulation failed.");
      setResult(d);
      if (resumeAtHalftime) {
        const nextHalf = d.plays.findIndex(
          (play: Simulation["plays"][number]) => play.period >= 3,
        );
        setCursor(nextHalf);
        setHalftimeApplied(true);
        setHalftimePending(false);
      } else {
        setSecondPlans([...plans]);
        setCursor(0);
        setHalftimeApplied(false);
        setHalftimePending(false);
      }
      setRunning(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function markReady() {
    if (!challengeCode || editableSide < 0 || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/match-challenges/${challengeCode}/ready`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup: sideSetup(editableSide), role: participantRole }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Unable to update readiness.");
      if (data.game) {
        setResult(data.game); setCursor(0); setRunning(false);
        setSeriesGame((data.games || []).length);
      }
      if (data.series) setSeries(data.series);
      const next = { ...lobby!, ...data, currentGame: data.game || lobby?.currentGame, ready: data.ready || [false, false], games: data.games || data.series?.games || lobby?.games || [], wins: data.wins || data.series?.wins || lobby?.wins || [0, 0] };
      setLobby(next); onChallengeUpdate?.(next);
    } catch (event) { setError((event as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function markHalftimeReady() {
    if (!challengeCode || editableSide < 0 || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/match-challenges/${challengeCode}/halftime`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: participantRole }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || "Unable to continue the game.");
      const next = { ...lobby!, ...data } as ChallengeState; setLobby(next); onChallengeUpdate?.(next);
    } catch (event) { setError((event as Error).message); } finally { lock.current = false; setBusy(false); }
  }
  function sideSetup(side: number): ChallengeSetup {
    return {
      ids: side === 0 ? a : b,
      minutes: rotations[side],
      tactic: plans[side],
      secondHalfTactic:
        side === 0 && challengeCreator
          ? challengeCreator.secondHalfTactic
          : result
            ? secondPlans[side]
            : plans[side],
    };
  }
  async function createChallenge() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/match-challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator: sideSetup(0), bestOf, mode: challengeMode }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || "Unable to create challenge.");
      const url = `${window.location.origin}/matchups?challenge=${data.code}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      // The creator must enter the shared lobby too. Staying on the plain
      // simulator leaves this tab without a participant role or Ready button.
      window.location.assign(url);
    } catch (event) {
      setError((event as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function saveMatch() {
    if (!result?.simulationToken || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sides: [sideSetup(0), sideSetup(1)],
          simulationToken: result.simulationToken,
          title: `${result.profiles[0][0].name} vs ${result.profiles[1][0].name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || "Unable to save match.");
      setSavedId(data.id);
    } catch (event) {
      setError((event as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const current = result?.plays[cursor - 1],
    finished = !!result && cursor >= result.plays.length,
    score = finished && result ? result.score : current?.score || [0, 0];
  const activeGames = series?.games || lobby?.games || [];
  const seriesStats = seriesSummary(activeGames);
  const showSetup = !result || coaching;
  async function copyShareCard() {
    if (!activeGames.length) return;
    const wins = series?.wins || lobby?.wins || [0, 0], mvp = seriesStats.mvp;
    const link = challengeCode ? `${window.location.origin}/matchups?challenge=${challengeCode}` : window.location.href;
    const text = [`🏀 QNBA Arena · BO${challengeBestOf || bestOf}`, `Lineup A ${wins[0]}–${wins[1]} Lineup B`, activeGames.map((g, i) => `G${i + 1}: ${g.score[0]}–${g.score[1]}`).join(" · "), mvp ? `⭐ Series MVP: ${mvp.name} — ${(mvp.pts / mvp.games).toFixed(1)} PPG, ${(mvp.reb / mvp.games).toFixed(1)} RPG, ${(mvp.ast / mvp.games).toFixed(1)} APG` : "", link].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(text); setShareCopied(true); window.setTimeout(() => setShareCopied(false), 2500);
  }
  async function copyGameResult() {
    if (!result) return;
    if (activeGames.length) return copyShareCard();
    const winner = result.score[0] === result.score[1] ? "Draw" : `Lineup ${result.score[0] > result.score[1] ? "A" : "B"} wins`;
    const top = result.boxes.flat().sort((x, y) => y.pts - x.pts)[0];
    const text = [
      "🏀 QNBA Arena",
      `FINAL · Lineup A ${result.score[0]}–${result.score[1]} Lineup B`,
      winner,
      top ? `⭐ Top scorer: ${top.name} · ${top.pts} PTS` : "",
      window.location.href,
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(text);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 2500);
  }
  return (
    <section className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-card to-card p-6 space-y-5">
      {showSetup && <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-orange-500 font-bold">
            QNBA Arena · Experimental
          </p>
          <h2 className="text-2xl font-bold mt-1">
            Your rotation. Their rotation. Tip-off.
          </h2>
          <p className="text-sm text-foreground/60 mt-2">
            {challengeCode
              ? `A shared BO${challengeBestOf || bestOf} challenge. Build Lineup B and play a series both sides can reopen.`
              : "A statistical basketball sandbox, not a real-world prediction."}
          </p>
        </div>
        {challengeCode && !result && (
          <a
            href="/matchups"
            className={`${button} shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10`}
          >
            Leave challenge
          </a>
        )}
      </div>}
      {showSetup && <MatchLineups teams={result ? result.profiles : teams} />}
      {(!result || coaching) && (
        <section className="rounded-xl border bg-background/40 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">Rotation minutes</h3>
              <p className="text-xs text-foreground/60">
                Set each player's role. Every side must total exactly 240
                minutes.
              </p>
            </div>
            <button
              className={button}
              onClick={() =>
                setRotations(
                  teams.map((team, side) =>
                    side === 0 && challengeCreator
                      ? challengeCreator.minutes
                      : defaultRotation(team),
                  ),
                )
              }
            >
              Auto-allocate minutes
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {teams.map((team, side) => {
              const total =
                rotations[side]?.reduce((sum, value) => sum + value, 0) || 0;
              return (
                <div key={side} className="rounded-xl border p-3">
                  <div className="flex justify-between mb-2">
                    <strong>Lineup {side === 0 ? "A" : "B"}</strong>
                    <span
                      className={
                        Math.abs(total - 240) < 0.05
                          ? "text-emerald-500"
                          : "text-amber-500"
                      }
                    >
                      {total.toFixed(1)} / 240 MIN
                    </span>
                  </div>
                  {team.map((player, index) => {
                    const value = rotations[side]?.[index] || 0;
                    const unusual =
                      index < 5 ? value < 20 || value > 42 : value > 30;
                    return (
                      <label
                        key={player.id}
                        className="grid grid-cols-[1fr_5rem] items-center gap-3 border-t py-2 text-sm"
                      >
                        <span>
                          {player.name}
                          <span className="block text-xs text-foreground/50">
                            {index < 5 ? "Starter" : "Bench"}
                            {unusual ? " · unusual workload" : ""}
                          </span>
                        </span>
                        <input
                          aria-label={`${player.name} minutes`}
                          type="number"
                          min={0}
                          max={48}
                          step={0.5}
                          value={value}
                          disabled={!!challengeCode && side !== editableSide}
                          onChange={(event) => {
                            const next = rotations.map((row) => [...row]);
                            next[side][index] = Math.max(
                              0,
                              Math.min(48, Number(event.target.value)),
                            );
                            setRotations(next);
                          }}
                          className="rounded-lg border bg-background p-2 text-right"
                        />
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {showSetup && <div className="grid grid-cols-2 gap-4">
        {[0, 1].map((side) => (
          <label key={side} className="text-sm font-semibold">
            Lineup {side === 0 ? "A" : "B"} tactic
            <select
              aria-label={`Lineup ${side === 0 ? "A" : "B"} tactic`}
              value={plans[side]}
              disabled={
                busy ||
                running ||
                halftimePending ||
                (!!challengeCode && side !== editableSide)
              }
              onChange={(e) =>
                setPlans(
                  plans.map((p, i) =>
                    i === side ? (e.target.value as Tactic) : p,
                  ),
                )
              }
              className="block w-full rounded-xl border bg-background p-3 mt-2"
            >
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <span className="block text-xs font-normal text-foreground/60 mt-2">
              {tacticInfo[plans[side]].description}
            </span>
          </label>
        ))}
      </div>}
      {showSetup && <p className="text-xs text-foreground/60">
        The first five must cover G / G / F / F / C. Add up to three bench
        players; their season minutes determine an abstract 240-minute rotation.
      </p>}
      <div className="flex flex-wrap gap-3 items-center">
        {(!challengeCode || !result || coaching) && <button
          className={`${button} bg-orange-500 text-black hover:bg-orange-400`}
          disabled={
            busy ||
            running ||
            !legal ||
            !validMinutes ||
            (!!challengeCode && lobby?.status !== "open")
          }
          onClick={() => void start()}
        >
          {busy
            ? "Simulating…"
            : challengeCode
              ? lobby?.status === "open"
                ? "Join challenge lobby"
                : lobby?.status === "completed" ? "Challenge completed" : "Series in progress"
              : result
                ? "Simulate a new match"
                : "Simulate match"}
        </button>}
        {!challengeCode && !result && legalSides[0] && validMinuteSides[0] && (
          <>
            <label className="text-sm font-semibold">
              Challenge format{" "}
              <select
                aria-label="Challenge format"
                className="rounded-lg border bg-background p-2"
                value={bestOf}
                onChange={(event) => setBestOf(Number(event.target.value))}
              >
                {[1, 3, 5, 7].map((value) => (
                  <option key={value} value={value}>
                    BO{value}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Mode{" "}
              <select aria-label="Challenge mode" className="rounded-lg border bg-background p-2" value={challengeMode} onChange={(event) => setChallengeMode(event.target.value as typeof challengeMode)}>
                <option value="classic">Classic</option>
                <option value="salary">Salary cap · 160</option>
                <option value="draft">Draft · unique players</option>
              </select>
            </label>
            <button
              className={button}
              disabled={busy}
              onClick={() => void createChallenge()}
            >
              Create BO{bestOf} challenge from Lineup A
            </button>
          </>
        )}
        {result && !challengeCode && (
          <>
            <button
              className={button}
              disabled={busy || halftimePending}
              onClick={() => {
                if (finished) setCursor(0);
                setRunning(!running);
              }}
            >
              {finished
                ? "Watch this match again"
                : running
                  ? "Pause"
                  : "Resume"}
            </button>
            <button
              className={button}
              disabled={finished || busy}
              onClick={() => {
                if (!halftimeApplied && halftimeIndex > 0) {
                  setCursor(halftimeIndex);
                  setHalftimePending(true);
                } else {
                  setCursor(result.plays.length);
                  setRunning(false);
                }
              }}
            >
              {!halftimeApplied ? "Skip to halftime" : "Skip to final"}
            </button>
            <label className="text-sm">
              Playback{" "}
              <select
                aria-label="Playback speed"
                className="rounded border bg-background p-2"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={500}>Slow</option>
                <option value={100}>Fast</option>
                <option value={25}>Instant pace</option>
              </select>
            </label>
          </>
        )}
      </div>
      {challengeCode && lobby?.status === "coaching" && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-3">
            <div><p className="text-xs uppercase tracking-widest text-emerald-500 font-bold">Between-game coaching</p><h3 className="font-bold">Game {(lobby.games?.length || 0) + 1} · Lineup A {lobby.wins?.[0] || 0}–{lobby.wins?.[1] || 0} Lineup B</h3><p className="text-sm text-foreground/60">Players stay locked. Change minutes and tactics, then both coaches must be ready.</p></div>
            <div className="text-sm">A {lobby.ready?.[0] ? "✓ Ready" : "Waiting"} · B {lobby.ready?.[1] ? "✓ Ready" : "Waiting"}</div>
          </div>
          {editableSide >= 0 ? <button className={`${button} bg-emerald-500 text-black`} disabled={busy || !legalSides[editableSide] || !validMinuteSides[editableSide] || !!lobby.ready?.[editableSide]} onClick={() => void markReady()}>{lobby.ready?.[editableSide] ? "Waiting for the other coach…" : `Ready Lineup ${editableSide === 0 ? "A" : "B"}`}</button> : <p className="text-sm">Spectator view · this lobby updates automatically.</p>}
        </section>
      )}
      {challengeCode && result && (lobby?.status === "playing_first_half" || lobby?.status === "halftime") && cursor >= halftimeIndex && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-amber-500 font-bold">Synchronized halftime</p><h3 className="text-xl font-bold">Both coaches must confirm the second half</h3><p className="text-sm text-foreground/60">The shared game is paused for everyone. The same second-half timeline starts for both screens only after A and B are ready.</p>
          <HalftimeCoachingReport result={result} />
          <p className="text-sm">A {lobby.halftimeReady?.[0] ? "✓ Ready" : "Waiting"} · B {lobby.halftimeReady?.[1] ? "✓ Ready" : "Waiting"}</p>
          {editableSide >= 0 && <button className={`${button} bg-amber-500 text-black`} disabled={busy || !!lobby.halftimeReady?.[editableSide]} onClick={() => void markHalftimeReady()}>{lobby.halftimeReady?.[editableSide] ? "Waiting for the other coach…" : `Ready Lineup ${editableSide === 0 ? "A" : "B"} for second half`}</button>}
        </section>
      )}
      {(lobby?.mode === "salary" || challengeMode === "salary") && (
        <div className="grid grid-cols-2 gap-3 text-sm">{teams.map((team, side) => { const cost = team.reduce((sum, player) => sum + (player.cost || 0), 0); return <p key={side} className={`rounded-xl border p-3 ${cost > 160 ? "text-red-500" : "text-emerald-500"}`}>Lineup {side === 0 ? "A" : "B"}: {cost}/160 salary</p>; })}</div>
      )}
      {shareUrl && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm break-all">
          Challenge link copied:{" "}
          <a className="underline" href={shareUrl}>
            {shareUrl}
          </a>
        </p>
      )}
      {result && halftimePending && !halftimeApplied && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-500 font-bold">
              Halftime adjustment
            </p>
            <h3 className="text-xl font-bold">Change the second-half plan</h3>
            <p className="text-sm text-foreground/60 mt-1">
              The first half is locked. Applying changes reruns only the same
              signed match timeline with your new second-half tactics.
            </p>
          </div>
          <HalftimeCoachingReport result={result} />
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((side) => (
              <label key={side} className="text-sm font-semibold">
                Lineup {side === 0 ? "A" : "B"}
                <select
                  aria-label={`Lineup ${side === 0 ? "A" : "B"} second-half tactic`}
                  value={secondPlans[side]}
                  disabled={busy}
                  onChange={(e) =>
                    setSecondPlans(
                      secondPlans.map((plan, i) =>
                        i === side ? (e.target.value as Tactic) : plan,
                      ),
                    )
                  }
                  className="block w-full rounded-xl border bg-background p-3 mt-2"
                >
                  {Object.entries(labels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            className={`${button} bg-amber-500 text-black hover:bg-amber-400`}
            disabled={busy}
            onClick={() => void start(true)}
          >
            {busy ? "Applying…" : "Start second half"}
          </button>
        </section>
      )}
      {result && !challengeCode && (
        <p className="text-xs text-foreground/60">
          Simulate a new match calculates a fresh outcome with your selected
          tactics. Watch this match again only replays the existing result.
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      {result && (
        <>
          {challengeCode && (
            <div className="flex justify-end">
              <a
                href="/matchups"
                className={`${button} border-red-500/30 text-red-400 hover:bg-red-500/10`}
              >
                Leave challenge
              </a>
            </div>
          )}
          {series && (
            <section className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-violet-500 font-bold">
                    BO{series.bestOf} series
                  </p>
                  <h3 className="text-xl font-bold">
                    Lineup A {series.wins[0]}–{series.wins[1]} Lineup B
                  </h3>
                  <p className="text-sm text-foreground/60">
                    Lineup {series.winner === 0 ? "A" : "B"} won the series ·
                    first to {series.needed}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {series.games.map((game, index) => (
                    <button
                      key={index}
                      className={`${button} ${seriesGame === index ? "border-violet-500 bg-violet-500/15" : ""}`}
                      onClick={() => {
                        setSeriesGame(index);
                        setResult(game);
                        setCursor(game.plays.length);
                        setRunning(false);
                      }}
                    >
                      Game {index + 1} · {game.score[0]}–{game.score[1]}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
          {activeGames.length > 0 && (series || coaching) && (
            <section className="rounded-2xl border p-5 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/15 via-violet-500/5 to-sky-500/10 p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.25em] text-orange-500 font-black">QNBA Arena · BO{challengeBestOf || bestOf}</p><h3 className="mt-2 text-3xl font-black">Lineup A <span className="text-orange-500">{(series?.wins || lobby?.wins || [0, 0])[0]}</span><span className="mx-3 text-foreground/30">:</span><span className="text-sky-500">{(series?.wins || lobby?.wins || [0, 0])[1]}</span> Lineup B</h3><p className="mt-2 text-sm text-foreground/60">{series ? `Series won by Lineup ${series.winner === 0 ? "A" : "B"}` : `Game ${activeGames.length + 1} is next`}</p></div><button className={`${button} border-orange-500/40 bg-orange-500 text-black hover:bg-orange-400`} onClick={() => void copyShareCard()}>{shareCopied ? "Copied ✓" : "Copy result & link"}</button></div>
                <div className="mt-6 flex flex-wrap gap-2">{activeGames.map((game, index) => <span key={index} className="rounded-full border bg-background/60 px-3 py-1 text-sm font-bold">G{index + 1} · {game.score[0]}–{game.score[1]}</span>)}</div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border bg-background/50 p-3"><p className="text-xs uppercase text-violet-400">Series MVP</p><p className="mt-1 font-black">{seriesStats.mvp?.name || "Pending"}</p>{seriesStats.mvp && <p className="text-xs text-foreground/60">{(seriesStats.mvp.pts / seriesStats.mvp.games).toFixed(1)} PPG · {(seriesStats.mvp.reb / seriesStats.mvp.games).toFixed(1)} RPG · {(seriesStats.mvp.ast / seriesStats.mvp.games).toFixed(1)} APG</p>}</div><div className="rounded-xl border bg-background/50 p-3"><p className="text-xs uppercase text-emerald-400">Top performance</p><p className="mt-1 font-black">{seriesStats.bestGame?.name || "Pending"}</p><p className="text-xs text-foreground/60">{seriesStats.bestGame ? `${seriesStats.bestGame.pts} PTS · Game ${seriesStats.bestGame.game}` : ""}</p></div><div className="rounded-xl border bg-background/50 p-3"><p className="text-xs uppercase text-sky-400">Closest game</p><p className="mt-1 font-black">{seriesStats.closest ? `Game ${seriesStats.closest.number}` : "Pending"}</p><p className="text-xs text-foreground/60">{seriesStats.closest?.margin} point margin</p></div><div className="rounded-xl border bg-background/50 p-3"><p className="text-xs uppercase text-orange-400">Average margin</p><p className="mt-1 font-black">{seriesStats.averageMargin.toFixed(1)} points</p><p className="text-xs text-foreground/60">Across {activeGames.length} game{activeGames.length === 1 ? "" : "s"}</p></div></div>
              </div>
            </section>
          )}
          <div className="rounded-2xl bg-background/80 border p-6 text-center">
            <p className="text-xs uppercase tracking-widest text-foreground/60">
              {finished
                ? "Final"
                : current
                  ? `${current.period <= 4 ? `Q${current.period}` : `OT${current.period - 4}`} · ${current.clock}`
                  : "Tip-off"}
            </p>
            <div className="grid grid-cols-3 items-center gap-4 my-5">
              <div>
                <p className="font-bold text-orange-500">LINEUP A</p>
                <p className="text-xs text-foreground/60">
                  {labels[result.tactics[0]]}
                </p>
              </div>
              <p className="text-4xl sm:text-6xl font-black tabular-nums whitespace-nowrap">
                {score[0]} <span className="text-foreground/30">:</span>{" "}
                {score[1]}
              </p>
              <div>
                <p className="font-bold text-sky-500">LINEUP B</p>
                <p className="text-xs text-foreground/60">
                  {labels[result.tactics[1]]}
                </p>
              </div>
            </div>
            <p className="font-semibold min-h-6">
              {finished
                ? score[0] === score[1]
                  ? "Draw after six overtimes"
                  : `Lineup ${score[0] > score[1] ? "A" : "B"} wins by ${Math.abs(score[0] - score[1])}!`
                : running
                  ? "Match in progress"
                  : "Playback paused"}
            </p>
            <div className="h-1 bg-foreground/10 rounded mt-4 overflow-hidden">
              <div
                className="h-full bg-orange-500"
                style={{ width: `${(100 * cursor) / result.plays.length}%` }}
              />
            </div>
          </div>
          <section className="rounded-xl border bg-background/40 p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
              {result.profiles.map((team, side) => (
                <div key={side} className="min-w-0">
                  <p className={`text-xs font-bold uppercase ${side === 0 ? "text-orange-500" : "text-sky-500"}`}>
                    Lineup {side === 0 ? "A" : "B"} starters
                  </p>
                  <p className="mt-1 truncate text-sm text-foreground/70">
                    {team.slice(0, 5).map((player) => player.name).join(" · ")}
                  </p>
                </div>
              ))}
              <button
                className={button}
                onClick={() => {
                  setShowFullLineups(true);
                  window.setTimeout(
                    () =>
                      document
                        .getElementById("full-match-lineups")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    0,
                  );
                }}
              >
                View full lineups
              </button>
            </div>
          </section>
          <MatchInsights result={result} cursor={cursor} />
          <div className="rounded-xl border bg-background/40 p-4">
            <h3 className="font-bold mb-3">Play-by-play</h3>
            <div className="h-52 overflow-y-auto space-y-2">
              {result.plays
                .slice(Math.max(0, cursor - 12), cursor)
                .reverse()
                .map((p, i) => {
                  const index = cursor - i - 1;
                  const presentation = playPresentation(p, result.plays[index - 1]);
                  return (
                  <p key={index} className={`rounded-r-lg border-l-2 py-1 pl-3 pr-2 text-sm ${p.side === 0 ? "border-orange-500" : "border-sky-500"} ${presentation.important ? "bg-amber-500/10" : ""}`}>
                    <span className="text-foreground/50 tabular-nums">
                      {p.period <= 4 ? `Q${p.period}` : `OT${p.period - 4}`}{" "}
                      {p.clock} ·{" "}
                    </span>
                    {presentation.label && <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black text-amber-400">{presentation.label}</span>}
                    {p.text}
                  </p>
                )})}
              {cursor === 0 && (
                <p className="text-sm text-foreground/60">Ready for tip-off.</p>
              )}
            </div>
          </div>
          {showFullLineups && (
            <section id="full-match-lineups" className="scroll-mt-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold">Full lineups</h3>
                <button
                  className={button}
                  onClick={() => setShowFullLineups(false)}
                >
                  Hide full lineups
                </button>
              </div>
              <MatchLineups teams={result.profiles} />
            </section>
          )}
          {finished && (
            <>
              <FinalGameSummary
                result={result}
                shared={!!challengeCode}
                onRematch={!challengeCode ? () => void start() : undefined}
                onShare={() => void copyGameResult()}
              />
              {shareCopied && <p role="status" className="text-sm font-semibold text-emerald-500">Result and link copied ✓</p>}
              <div className="flex flex-wrap gap-3">
                {!challengeCode && (
                  <button
                    className={button}
                    disabled={busy || !!savedId}
                    onClick={() => void saveMatch()}
                  >
                    {savedId ? "Saved to match history" : "Save match"}
                  </button>
                )}
                <a className={button} href="/matches">
                  Open match history
                </a>
                {!challengeCode && (
                  <button
                    className={button}
                    onClick={() => {
                      setResult(null);
                      setCursor(0);
                      setSavedId(null);
                    }}
                  >
                    Edit rotations
                  </button>
                )}
              </div>
              <section className="rounded-xl border p-4">
                <h3 className="font-bold">NBA scoring reference</h3>
                <p className="text-sm text-foreground/70 mt-2">
                  This game totaled{" "}
                  <strong>{result.score[0] + result.score[1]}</strong> points
                  with a{" "}
                  <strong>{Math.abs(result.score[0] - result.score[1])}</strong>
                  -point margin. In {result.calibration.season},{" "}
                  {result.calibration.games.toLocaleString("en-US")} NBA
                  regular-season games averaged{" "}
                  {result.calibration.averageTotal.toFixed(1)} total points and
                  a {result.calibration.averageMargin.toFixed(1)}-point margin;
                  90% of totals were between {result.calibration.central90[0]}{" "}
                  and {result.calibration.central90[1]}.
                </p>
                <p className="text-xs text-foreground/50 mt-2">
                  This is a league-level calibration reference. Historical
                  player lineups are not available in the current dataset, so it
                  does not validate this particular matchup.
                </p>
              </section>
              <section className="rounded-xl border p-4">
                <h3 className="font-bold mb-2">What separated the teams</h3>
                <ul className="space-y-2 text-sm text-foreground/70">
                  {result.summary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center">
                  <caption className="text-left font-bold mb-2">
                    Score by period
                  </caption>
                  <thead>
                    <tr>
                      <th>Team</th>
                      {result.quarters.map((_, i) => (
                        <th key={i}>{i < 4 ? `Q${i + 1}` : `OT${i - 3}`}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1].map((side) => (
                      <tr key={side} className="border-t">
                        <th className="py-3">
                          Lineup {side === 0 ? "A" : "B"}
                        </th>
                        {result.quarters.map((q, i) => (
                          <td key={i}>{q[side]}</td>
                        ))}
                        <td className="font-bold">{result.score[side]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.boxes.map((team, side) => (
                <div key={side} className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <caption className="text-left font-bold mb-3">
                      Lineup {side === 0 ? "A" : "B"} · Box score
                    </caption>
                    <thead>
                      <tr>
                        {[
                          "Player",
                          "MIN",
                          "PTS",
                          "REB",
                          "OREB",
                          "STL",
                          "BLK",
                          "PF",
                          "AST",
                          "TO",
                          "FG",
                          "3PT",
                          "FT",
                        ].map((h) => (
                          <th key={h} className="p-2 first:text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((p) => (
                        <tr key={p.id} className="border-t">
                          <th className="p-2 text-left font-medium">
                            <span className="flex items-center gap-2">
                              <PlayerImage
                                playerId={p.id}
                                alt=""
                                className="w-9 h-9 object-contain"
                              />
                              {p.name}
                            </span>
                          </th>
                          <td>{p.min.toFixed(1)}</td>
                          <td>{p.pts}</td>
                          <td>{p.reb}</td>
                          <td>{p.oreb}</td>
                          <td>{p.stl}</td>
                          <td>{p.blk}</td>
                          <td>{p.pf}</td>
                          <td>{p.ast}</td>
                          <td>{p.tov}</td>
                          <td>
                            {p.fgm}/{p.fga}
                          </td>
                          <td>
                            {p.threeM}/{p.threeA}
                          </td>
                          <td>
                            {p.ftm}/{p.fta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
          <p className="text-xs text-foreground/60">
            Source: NBA Stats · {result.season} regular season · synced{" "}
            {new Date(result.syncedAt).toLocaleString("en-US")}. {result.model}.
            Results stay on this page only; replay does not generate a new
            outcome.
          </p>
        </>
      )}
      <details className="text-sm text-foreground/60">
        <summary className="cursor-pointer">How this prototype works</summary>
        <p className="mt-3">
          Four 12-minute quarters, with pace affected by tactics. Ties trigger
          5-minute overtime, up to six periods. Each team has two guards, two
          forwards and a center among its first five, plus up to three bench
          players. Rates use minutes and sample size; limited samples are pulled
          toward explicit model priors. Offensive rebounds retain possession.
          Steals and blocks are recorded events. Established shooters improve
          spacing for two-point shots. Inside play targets the center; pressure
          defense risks fouls; faster play risks turnovers. Season playing time
          allocates an abstract 240-minute rotation; this is possession-share
          weighting rather than literal substitutions. Heavy workloads now add
          a late-game fatigue penalty; foul trouble, timeouts, late-game pace
          and intentional fouling also affect the possession model.
          The model still does not include injuries or home advantage. Halftime tactics preserve the signed
          first-half seed and affect only later periods. Positions come from
          stored biographies, not season-specific defensive tracking. League
          scoring is compared with a 1,230-game 2024-25 baseline, but
          matchup-level calibration is not possible with the current data. This
          remains an entertainment model, not a forecast. Both sides may select
          the same player. Editing either lineup resets the match.
        </p>
      </details>
    </section>
  );
}
