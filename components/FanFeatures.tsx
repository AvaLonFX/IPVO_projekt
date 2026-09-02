"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { pickLegalFive, roles } from "@/lib/lineup-roles";
import MatchSimulation from "@/components/MatchSimulation";
import PlayerImage from "@/components/PlayerImage";
import SearchPlayers from "@/components/nba_comp/SearchPlayers";
import { FanPlayer, total } from "@/lib/fan-rules";
const links = [
  ["matchups", "Match simulator"],
  ["daily-five", "Daily Five"],
  ["watchlist", "Watchlist"],
  ["history", "Challenge history"],
  ["matches", "Match history"],
  ["profile", "Arena profile"],
];
const panel = "rounded-2xl border bg-card p-5";
const button =
  "rounded-lg border px-3 py-2 hover:bg-foreground/10 disabled:opacity-40";
export default function FanFeatures({ kind }: { kind: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  const [a, setA] = useState<number[]>([]),
    [b, setB] = useState<number[]>([]),
    [side, setSide] = useState<"a" | "b">("a"),
    [query, setQuery] = useState(""),
    [matchEra, setMatchEra] = useState<"current" | "alltime">("current");
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const lock = useRef(false);
  const [sharedLink, setSharedLink] = useState("");
  const [matchChallenge, setMatchChallenge] = useState<any>(null);
  const [matchActive, setMatchActive] = useState(false);
  const [positionFilter, setPositionFilter] = useState("all");
  const endpoint = "/api/fan/" + (kind === "matchups" ? `roster?era=${matchEra}` : kind);
  async function load(payload?: any) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: payload ? "POST" : "GET",
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
        cache: "no-store",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Unable to load.");
      setData(d);
      if (d.result) setA(d.result.player_ids);
      return d;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    void load().then(async (d) => {
      if (kind === "matchups" && d) {
        const params = new URLSearchParams(window.location.search);
        const challengeCode = params.get("challenge");
        if (challengeCode) {
          const response = await fetch(
            `/api/match-challenges?code=${encodeURIComponent(challengeCode)}`,
            { cache: "no-store" },
          );
          const challenge = await response.json();
          if (!response.ok) {
            setError(challenge.error || "Unable to load challenge.");
            return;
          }
          setMatchChallenge(challenge);
          setMatchEra(challenge.era === "alltime" ? "alltime" : "current");
          setSide("b");
          if (challenge.result) {
            setA(challenge.result.profiles[0].map((p: any) => p.id));
            setB(challenge.result.profiles[1].map((p: any) => p.id));
          } else {
            setA(challenge.creator.ids);
            setB(challenge.opponent?.ids || []);
          }
          return;
        }
        const read = (key: string) =>
          Array.from(new Set((params.get(key) || "").split(",").map(Number)))
            .filter((id) => d.players.some((p: FanPlayer) => p.id === id))
            .slice(0, kind === "matchups" ? 8 : 5);
        setA(read("a"));
        setB(read("b"));
      }
    });
  }, [kind, matchEra]);
  const pool: FanPlayer[] = data?.pool || data?.players || [];
  const showMatchupBuilder =
    kind !== "matchups" ||
    (!matchActive && (!matchChallenge || matchChallenge.status === "open"));
  const selected = (ids: number[]) =>
    ids
      .map((id) => pool.find((p) => p.id === id))
      .filter(Boolean) as FanPlayer[];
  function toggle(id: number) {
    setNote("");
    const ids = side === "a" || kind === "daily-five" ? a : b;
    const setter = side === "a" || kind === "daily-five" ? setA : setB;
    const otherIds = side === "a" ? b : a;
    if (matchChallenge?.mode === "draft" && otherIds.includes(id)) {
      setNote("That player has already been drafted by the other lineup.");
      return;
    }
    if (ids.includes(id)) setter(ids.filter((x) => x !== id));
    else if (ids.length < (kind === "matchups" ? 8 : 5)) setter([...ids, id]);
    else
      setNote(
        `${kind === "matchups" ? "Eight" : "Five"} players selected. Remove one before adding another.`,
      );
  }
  async function share() {
    const url = new URL("/matchups", window.location.origin);
    url.searchParams.set("a", a.join(","));
    url.searchParams.set("b", b.join(","));
    setSharedLink(url.toString());
    try {
      await navigator.clipboard.writeText(url.toString());
      setNote(
        "Lineup link copied. It contains only the selected player IDs, not your account.",
      );
    } catch {
      setNote(url.toString());
    }
  }
  const lineup = (ids: number[], label: string) => (
    <div className={panel}>
      <h2 className="text-lg font-semibold">
        {label} · {ids.length}/{kind === "matchups" ? 8 : 5}
      </h2>
      {selected(ids).map((p, index) => (
        <div
          key={p.id}
          className="flex justify-between items-center border-b py-2"
        >
          <div className="flex items-center gap-2">
            <PlayerImage
              playerId={p.id}
              alt={p.name}
              className="w-12 h-12 object-contain"
            />
            <span>
              {p.name}
              {kind === "matchups" && (
                <span className="ml-2 text-xs text-foreground/50">
                  {p.position}
                  {index >= 5 ? " · Bench" : " · Starter"}
                </span>
              )}
            </span>
          </div>
          <button
            aria-label={`Remove ${p.name} from ${label}`}
            disabled={
              busy ||
              !!data?.result ||
              (!!matchChallenge &&
                (label === "Lineup A" || matchChallenge.status !== "open"))
            }
            onClick={() =>
              label === "Lineup B"
                ? setB(b.filter((id) => id !== p.id))
                : setA(a.filter((id) => id !== p.id))
            }
            className={button}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
  const header = links.find((l) => l[0] === kind)?.[1] || "";
  return (
    <main className="mx-auto max-w-6xl py-8 space-y-6">
      <nav className="flex flex-wrap gap-3">
        {links.map(([path, label]) => (
          <Link
            key={path}
            href={"/" + path}
            className={`${button} ${path === kind ? "bg-foreground/10 font-semibold" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <h1 className="text-3xl font-bold">{header}</h1>
      {error && (
        <div role="alert" className={panel}>
          <p>{error}</p>
          <div className="flex gap-3 mt-3">
            <button onClick={() => void load()} className={button}>
              Retry
            </button>
            {kind === "watchlist" && (
              <Link href="/sign-in" className={button}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
      {busy && !data && <p role="status">Loading…</p>}
      {kind === "matchups" && data && (
        <>
          {!matchChallenge && <div className="inline-flex rounded-xl border bg-background/50 p-1" role="tablist" aria-label="Player era"><button role="tab" aria-selected={matchEra === "current"} className={`${button} ${matchEra === "current" ? "bg-orange-500 text-black" : "border-transparent"}`} onClick={() => { setMatchEra("current"); setA([]); setB([]); setQuery(""); setMatchActive(false); }}>Current players</button><button role="tab" aria-selected={matchEra === "alltime"} className={`${button} ${matchEra === "alltime" ? "bg-orange-500 text-black" : "border-transparent"}`} onClick={() => { setMatchEra("alltime"); setA([]); setB([]); setQuery(""); setMatchActive(false); }}>All-time players</button></div>}
          <p className="text-foreground/60">
            {matchEra === "current" ? "Build two lineups from the latest verified season." : "Build lineups from stored career profiles across NBA history. Career averages are used, not peak seasons."}
          </p>
          <MatchSimulation
            key={matchEra + "|" + a.join(",") + "|" + b.join(",")}
            a={a}
            b={b}
            teams={[selected(a), selected(b)]}
            era={matchEra}
            challengeCode={matchChallenge?.code}
            challengeCreator={matchChallenge?.creator}
            challengeResult={matchChallenge?.result}
            challengeBestOf={matchChallenge?.bestOf}
            challengeSeries={matchChallenge?.series}
            challengeState={matchChallenge}
            onSimulationActiveChange={setMatchActive}
            onChallengeUpdate={(next) => {
              setMatchChallenge(next);
              if (next.opponent?.ids) setB(next.opponent.ids);
            }}
          />
          {showMatchupBuilder && <div className="flex flex-wrap gap-3">
            <button
              className={button}
              disabled={!!matchChallenge}
              onClick={() => {
                const ranked = [...pool]
                  .filter((p) => p.fga > 3)
                  .sort((x, y) => y.score - x.score);
                const first = pickLegalFive(ranked);
                const second = pickLegalFive(
                  ranked.filter((p) => !first.some((x) => x.id === p.id)),
                );
                const firstBench = ranked
                  .filter(
                    (p) =>
                      !first.some((x) => x.id === p.id) &&
                      !second.some((x) => x.id === p.id),
                  )
                  .slice(0, 3);
                const secondBench = ranked
                  .filter(
                    (p) =>
                      !first.some((x) => x.id === p.id) &&
                      !second.some((x) => x.id === p.id) &&
                      !firstBench.some((x) => x.id === p.id),
                  )
                  .slice(0, 3);
                setA([...first, ...firstBench].map((p) => p.id));
                setB([...second, ...secondBench].map((p) => p.id));
                setNote(
                  "Demo loaded: each side has five legal starters and three bench players. The first five entries are the starters.",
                );
              }}
            >
              Load demo matchup
            </button>
            <button
              className={button}
              disabled={!!matchChallenge}
              onClick={() => setSide("a")}
            >
              Editing {side === "a" ? "✓ " : ""}Lineup A
            </button>
            <button className={button} onClick={() => setSide("b")}>
              Editing {side === "b" ? "✓ " : ""}Lineup B
            </button>
            <button
              className={button}
              disabled={!data.signedIn || !!matchChallenge}
              onClick={() => {
                const eligible = data.dreamIds.filter((id: number) =>
                  pool.some((p) => p.id === id),
                );
                setA(eligible.slice(0, 8));
                setNote(
                  `Imported ${Math.min(8, eligible.length)} players into A, in your saved Dream Team order. The first five must form a legal starting lineup.`,
                );
              }}
            >
              Import Dream Team into A
            </button>
            <button disabled={!a.length} className={button} onClick={share}>
              Copy lineup link
            </button>
          </div>}
          {showMatchupBuilder && <div className="grid md:grid-cols-2 gap-4">
            {lineup(a, "Lineup A")}
            {lineup(b, "Lineup B")}
          </div>}
          {showMatchupBuilder && a.length >= 5 && b.length >= 5 && (
            <div className={panel}>
              <h2 className="font-semibold mb-1">Starter comparison</h2>
              <p className="text-xs text-foreground/50 mb-3">
                Raw season averages for the first five entries; the simulation
                applies its own 240-minute rotation.
              </p>
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Lineup A</th>
                    <th>Lineup B</th>
                    <th>Higher value</th>
                  </tr>
                </thead>
                <tbody>
                  {(["pts", "reb", "ast", "fg"] as const).map((key) => {
                    const x = total(selected(a).slice(0, 5))[key],
                      y = total(selected(b).slice(0, 5))[key];
                    return (
                      <tr key={key} className="border-t">
                        <th className="py-3">
                          {key === "fg" ? "FG%" : key.toUpperCase()}
                        </th>
                        <td>{x === null ? "N/A" : x.toFixed(1)}</td>
                        <td>{y === null ? "N/A" : y.toFixed(1)}</td>
                        <td>
                          {x === null || y === null
                            ? "Unknown"
                            : Math.abs(x - y) < 0.0001
                              ? "Equal"
                              : x > y
                                ? "A"
                                : "B"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-sm text-foreground/60 mt-3">
                This table compares starter season averages, not the simulated
                result. Shared links use the latest stored stats when opened.
              </p>
            </div>
          )}
        </>
      )}
      {kind === "daily-five" && data && (
        <>
          <div className={panel}>
            <p className="font-semibold">
              {data.day} · Budget {data.budget} · Five players · resets 00:00
              UTC
            </p>
            <p className="text-sm text-foreground/60 mt-2">
              Score = PTS + 1.2 × REB + 1.5 × AST, using today’s frozen per-game
              dataset. Each player’s score is rounded to one decimal. Price =
              round(score ÷ 2), with a minimum of 8 and maximum of 28. This is a
              lineup puzzle, not live fantasy scoring. No position restrictions.
            </p>
            <p className="mt-2">
              Choose your best five, then lock your only submission for today.
            </p>
            <p className="text-sm text-foreground/60">
              {data.signedIn
                ? "Your result is saved to your account."
                : "Guest results belong to this browser. Sign in before playing for account-based history; guest results stay separate."}
            </p>
          </div>
          {lineup(a, "Your five")}
          <div className={panel}>
            <p
              className={
                total(selected(a)).cost > data.budget ? "text-red-400" : ""
              }
            >
              Spent: {total(selected(a)).cost}/{data.budget} · Score:{" "}
              {total(selected(a)).score.toFixed(1)}
            </p>
            {!data.result ? (
              <button
                className={button + " mt-3"}
                disabled={
                  busy ||
                  a.length !== 5 ||
                  total(selected(a)).cost > data.budget
                }
                onClick={() => void load({ ids: a, day: data.day })}
              >
                Lock today’s lineup
              </button>
            ) : (
              <div className="mt-3">
                <h2 className="text-xl font-bold">
                  Saved score: {Number(data.result.score).toFixed(1)}
                </h2>
                <p>
                  Best possible today: {data.best.score.toFixed(1)} · Your
                  efficiency:{" "}
                  {(
                    (Number(data.result.score) / data.best.score) *
                    100
                  ).toFixed(1)}
                  %
                </p>
                <p className="text-sm mt-2">
                  One optimal lineup:{" "}
                  {data.best.ids
                    .map((id: number) => pool.find((p) => p.id === id)?.name)
                    .join(", ")}
                </p>
                <Link href="/history" className="underline">
                  View history and achievements
                </Link>
              </div>
            )}
          </div>
        </>
      )}
      {(kind === "matchups" || kind === "daily-five") &&
        data &&
        (kind !== "matchups" || showMatchupBuilder) &&
        !(kind === "daily-five" && data.result) && (
          <section className={panel}>
            <h2 className="font-semibold">
              {kind === "matchups"
                ? `Add players to Lineup ${side.toUpperCase()}`
                : "Today’s player pool"}
            </h2>
            <input
              aria-label="Filter players"
              placeholder="Filter by name or team…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-3 w-full rounded border bg-background p-3"
            />
            {kind === "matchups" && (
              <label className="block text-sm mb-3">
                Position{" "}
                <select
                  aria-label="Filter players by position"
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="ml-2 rounded border bg-background p-2"
                >
                  <option value="all">All positions</option>
                  <option value="G">Guard</option>
                  <option value="F">Forward</option>
                  <option value="C">Center</option>
                </select>
              </label>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 max-h-[600px] overflow-auto">
              {pool
                .filter(
                  (p) =>
                    kind !== "matchups" ||
                    positionFilter === "all" ||
                    roles(p.position).some((role) => role === positionFilter),
                )
                .filter((p) =>
                  (p.name + " " + p.team)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .slice(0, matchEra === "alltime" ? 180 : 1000)
                .map((p) => {
                  const chosen = (
                    kind === "daily-five" || side === "a" ? a : b
                  ).includes(p.id);
                  return (
                    <button
                      key={p.id}
                      aria-pressed={chosen}
                      disabled={busy}
                      onClick={() => toggle(p.id)}
                      className={`${panel} text-left ${chosen ? "ring-2 ring-emerald-500" : ""}`}
                    >
                      <div className="flex gap-2 items-center">
                        <PlayerImage
                          playerId={p.id}
                          alt={p.name}
                          className="w-14 h-14 object-contain"
                        />
                        <div>
                          <p className="font-semibold">
                            {chosen ? "✓ " : ""}
                            {p.name}
                          </p>
                          <p className="text-xs text-foreground/60">
                            {p.team}
                            {kind === "matchups"
                              ? ` · ${p.position} · ${p.games} GP`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs mt-2">
                        {p.pts} PTS · {p.reb} REB · {p.ast} AST
                      </p>
                      {kind === "daily-five" && (
                        <p className="mt-2 font-semibold">
                          Price {p.cost} · Score {p.score}
                        </p>
                      )}
                    </button>
                  );
                })}
            </div>
          </section>
        )}
      {kind === "watchlist" && data && (
        <>
          <p className="text-foreground/60">
            Your private list. Follow players to see their stored stats and next
            scheduled team game. A team’s game does not confirm player
            availability.
          </p>
          <fieldset
            disabled={busy}
            className={busy ? "pointer-events-none opacity-50" : ""}
          >
            <SearchPlayers
              onPlayerClick={(p) =>
                void load({ action: "add", playerId: Number(p.PERSON_ID) })
              }
            />
          </fieldset>
          {!data.players.length && (
            <p className={panel}>
              No followed players yet. Search above to add your first player.
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {data.players.map((p: any) => (
              <article key={p.id} className={panel}>
                <div className="flex items-center gap-3">
                  <PlayerImage
                    playerId={p.id}
                    alt={p.name}
                    className="w-20 h-20 object-contain"
                  />
                  <div>
                    <Link
                      href={`/player/${p.id}`}
                      className="font-bold underline"
                    >
                      {p.name}
                    </Link>
                    <p>{p.team}</p>
                  </div>
                </div>
                <p className="mt-3">
                  {p.stats
                    ? `${p.stats.pts} PTS · ${p.stats.reb} REB · ${p.stats.ast} AST`
                    : "No current-season stats available."}
                </p>
                <p className="text-sm text-foreground/60 my-3">
                  {p.nextGame
                    ? `${p.nextGame.awayTeam} at ${p.nextGame.homeTeam} · ${new Date(p.nextGame.startTime).toLocaleString("en-US")}`
                    : "No upcoming game available in the stored schedule."}
                </p>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void load({ action: "remove", playerId: p.id })
                  }
                >
                  Unfollow {p.name}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {kind === "history" && data && (
        <>
          <p className="text-foreground/60">
            {data.signedIn ? "Account history" : "This browser’s guest history"}{" "}
            · Dates use UTC. Previous browser-only games are not imported.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.achievements.map((x: any) => (
              <div
                key={x.name}
                className={
                  panel + (x.unlocked ? " border-emerald-500" : " opacity-60")
                }
              >
                <h2 className="font-semibold">
                  {x.unlocked ? "🏆" : "🔒"} {x.name}
                </h2>
                <p className="text-sm">{x.description}</p>
              </div>
            ))}
          </div>
          <section className={panel}>
            <label className="font-semibold">
              Challenge calendar{" "}
              <input
                aria-label="Calendar month"
                type="month"
                value={month}
                max={data.day.slice(0, 7)}
                onChange={(e) => {
                  if (/^\d{4}-\d{2}$/.test(e.target.value))
                    setMonth(e.target.value);
                }}
                className="rounded border bg-background p-2 ml-3"
              />
            </label>
            <p className="text-xs text-foreground/60 mt-2">
              ✓ Won · × Lost · … In progress · — Not played · Five = submitted
              score
            </p>
            <div className="grid grid-cols-7 gap-2 mt-4">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="text-xs text-center">
                  {d}
                </div>
              ))}
              {Array.from(
                {
                  length:
                    (new Date(month + "-01T00:00:00Z").getUTCDay() + 6) % 7,
                },
                (_, i) => (
                  <div key={"blank" + i} />
                ),
              )}
              {Array.from(
                {
                  length: new Date(
                    Number(month.slice(0, 4)),
                    Number(month.slice(5, 7)),
                    0,
                  ).getDate(),
                },
                (_, i) => {
                  const date = month + "-" + String(i + 1).padStart(2, "0");
                  const records = data.guesser.filter(
                    (r: any) => r.day === date,
                  );
                  const five = data.dailyFive.find((r: any) => r.day === date);
                  return (
                    <div
                      key={date}
                      className="border rounded-lg p-2 text-xs min-h-24"
                    >
                      <p className="font-bold mb-2">{i + 1}</p>
                      {(["current", "alltime"] as const).map((era) => {
                        const r = records.find((r: any) => r.era === era);
                        return (
                          <p key={era}>
                            {era === "current" ? "Current" : "All-Time"}:{" "}
                            {r
                              ? r.status === "won"
                                ? `✓ ${r.attempts}/6`
                                : r.status === "expired"
                                  ? "Expired"
                                  : r.status === "lost"
                                    ? "×"
                                    : `… ${r.attempts}/6`
                              : "—"}
                          </p>
                        );
                      })}
                      {five && (
                        <p className="text-emerald-500">
                          Five: {Number(five.score).toFixed(1)}
                        </p>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </section>
        </>
      )}
      {note && (
        <p role="status" className="break-all">
          {note}
        </p>
      )}
      {sharedLink && (
        <a href={sharedLink} className="block underline">
          Open shared lineups
        </a>
      )}
    </main>
  );
}
