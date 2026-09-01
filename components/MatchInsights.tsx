"use client";
import PlayerImage from "@/components/PlayerImage";
import { assignLineup, lineupSlots } from "@/lib/lineup-roles";
import type { Simulation } from "@/lib/match-simulation";
export type PreviewPlayer = {
  id: number;
  name: string;
  position?: string;
  confidence?: string;
  games?: number;
  minutes?: number;
  cost?: number;
};
export function MatchLineups({ teams }: { teams: PreviewPlayer[][] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {teams.map((team, side) => {
        const ordered = assignLineup(team.slice(0, 5));
        const display = ordered ? [...ordered, ...team.slice(5)] : team;
        return (
          <section
            key={side}
            className={`rounded-xl border p-4 ${side === 0 ? "border-orange-500/30" : "border-sky-500/30"}`}
          >
            <h3 className="font-bold mb-3">
              Lineup {side === 0 ? "A" : "B"} · {team.length}/8
            </h3>
            {display.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 py-2">
                <PlayerImage
                  playerId={p.id}
                  alt=""
                  className="w-10 h-10 object-contain"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {p.name}{" "}
                    <span className="text-foreground/50">
                      {ordered
                        ? i < 5
                          ? lineupSlots[i]
                          : "BENCH"
                        : p.position}
                    </span>
                  </p>
                  <p className="text-xs text-foreground/50">
                    {p.position} · {p.games} GP · {p.minutes} MPG
                  </p>
                  {p.confidence === "Limited sample" && (
                    <p className="text-xs text-amber-500">
                      Limited sample · stronger statistical adjustment
                    </p>
                  )}
                </div>
              </div>
            ))}
            <p
              className={`text-xs mt-2 ${ordered ? "text-emerald-500" : "text-amber-500"}`}
            >
              {ordered
                ? `Ready: G / G / F / F / C starters${team.length > 5 ? ` · ${team.length - 5} bench` : " · no bench"}`
                : "Needs 2 guards, 2 forwards and 1 center. G-F / F-C players can cover either listed role."}
            </p>
          </section>
        );
      })}
    </div>
  );
}
export function MatchInsights({
  result,
  cursor,
}: {
  result: Simulation;
  cursor: number;
}) {
  const visible = result.plays.slice(0, cursor),
    last = visible.at(-1);
  const leads = [0, ...visible.map((p) => p.score[0] - p.score[1])];
  const max = Math.max(10, ...leads.map(Math.abs));
  const width = 600,
    height = 140;
  const points = leads
    .map(
      (v, i) =>
        `${(i * width) / Math.max(1, result.plays.length)},${height / 2 - (v / max) * (height / 2 - 12)}`,
    )
    .join(" ");
  return (
    <div className="space-y-4">
      {last?.run && last.run.points >= 6 && (
        <p
          className="rounded-xl border border-orange-500/30 p-3 font-bold"
          role="status"
        >
          Lineup {last.run.side === 0 ? "A" : "B"} on a {last.run.points}–0
          scoring run
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        {result.profiles.map((team, side) => {
          const leaders = team
            .map((p, i) => ({ ...p, pts: last?.scorers[side][i] || 0 }))
            .sort((a, b) => b.pts - a.pts)
            .slice(0, 2);
          return (
            <div key={side} className="rounded-xl border bg-background/40 p-4">
              <h3 className="text-xs uppercase text-foreground/60 mb-2">
                Lineup {side === 0 ? "A" : "B"} · Scoring leaders
              </h3>
              {leaders.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 text-sm py-1"
                >
                  <PlayerImage
                    playerId={p.id}
                    alt=""
                    className="w-8 h-8 object-contain"
                  />
                  <span className="flex-1">{p.name}</span>
                  <strong>{p.pts} PTS</strong>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <figure className="rounded-xl border bg-background/40 p-4">
        <figcaption className="font-bold">Lead tracker</figcaption>
        <p className="text-xs text-foreground/60">
          Above the line: A leads · Below: B leads · Largest leads so far: A +
          {Math.max(...leads)} / B +{Math.abs(Math.min(...leads))}
        </p>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36"
          role="img"
          aria-label={`Lead over revealed plays. Current lead: ${Math.abs(leads.at(-1) || 0)} points for ${(leads.at(-1) || 0) >= 0 ? "A" : "B"}.`}
        >
          <line
            x1="0"
            x2={width}
            y1={height / 2}
            y2={height / 2}
            stroke="currentColor"
            opacity="0.25"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
          />
          <text x="4" y="12" fill="currentColor" fontSize="10">
            A +{max}
          </text>
          <text x="4" y="136" fill="currentColor" fontSize="10">
            B +{max}
          </text>
        </svg>
        <p className="text-xs text-foreground/50">
          Tip-off → final · Only revealed plays are shown.
        </p>
      </figure>
    </div>
  );
}
