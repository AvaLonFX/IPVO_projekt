// app/analytics/page.tsx
import Link from "next/link";
import { fetchGuesserEventsSummary, disconnectGa } from "@/lib/ga-data";

type Summary = {
  guesser_start: number;
  guesser_guess: number;
  guesser_hint: number;
  guesser_end: number;
};
function toSummary(input: unknown): Summary | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;

  return {
    guesser_start: Number(obj.guesser_start ?? 0),
    guesser_guess: Number(obj.guesser_guess ?? 0),
    guesser_hint: Number(obj.guesser_hint ?? 0),
    guesser_end: Number(obj.guesser_end ?? 0),
  };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const sp = await searchParams;

  const raw = await fetchGuesserEventsSummary(7); // last 7 days
  const summary = toSummary(raw);

  async function disconnectAction() {
    "use server";
    await disconnectGa();
  }

  return (
    <div className="w-full mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-foreground/70">
          GA4 eventi za Guesser (Google Analytics Data API — runReport).
        </p>
      </div>

      {sp?.error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Error: {sp.error}
        </div>
      ) : null}

      {!summary ? (
        <div className="rounded-2xl border bg-background/30 backdrop-blur p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-base font-semibold">Nisi povezan s Google Analytics</div>
              <div className="text-sm text-foreground/70">
                Klikni ispod i autoriziraj <b>analytics.readonly</b>.
              </div>
            </div>

            <Link
              href="/api/google/start"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold
                         bg-primary text-primary-foreground hover:opacity-90 transition
                         w-full sm:w-auto"
            >
              Connect Google Analytics
            </Link>
          </div>
        </div>
      ) : (
        <ConnectedView summary={summary} onDisconnect={disconnectAction} />
      )}
    </div>
  );
}

function ConnectedView({
  summary,
  onDisconnect,
}: {
  summary: Summary;
  onDisconnect: () => Promise<void>;
}) {
  const events = [
    { key: "guesser_start", label: "Start", value: num(summary.guesser_start) },
    { key: "guesser_guess", label: "Guess", value: num(summary.guesser_guess) },
    { key: "guesser_hint", label: "Hint", value: num(summary.guesser_hint) },
    { key: "guesser_end", label: "End", value: num(summary.guesser_end) },
  ] as const;

  const total = events.reduce((a, b) => a + b.value, 0);
  const perDay = total / 7;
  const completion = events[0].value > 0 ? (events[3].value / events[0].value) * 100 : 0;

  // Donut uses theme-ish colors (nice on dark)
  const donutStops = [
    { label: "Start", value: events[0].value, color: "hsl(210 100% 60%)" },
    { label: "Guess", value: events[1].value, color: "hsl(160 70% 45%)" },
    { label: "Hint", value: events[2].value, color: "hsl(280 70% 60%)" },
    { label: "End", value: events[3].value, color: "hsl(340 80% 55%)" },
  ];

  return (
    <div className="space-y-6">
      {/* Connected header row */}
      <div className="rounded-2xl border bg-background/30 backdrop-blur px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-5 w-5 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-emerald-300 text-xs">✓</span>
            </div>
            <div className="space-y-1">
              <div className="font-semibold">Connected</div>
              <div className="text-sm text-foreground/70">Prikaz za zadnjih 7 dana.</div>
            </div>
          </div>

          <form action={onDisconnect} className="w-full sm:w-auto">
            <button
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold
                         border border-foreground/15 bg-background/10 hover:bg-foreground/5 transition"
            >
              Disconnect
            </button>
          </form>
        </div>

        {/* KPI cards */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {events.map((e) => (
            <KpiCard key={e.key} title={e.key} value={e.value} />
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Events overview */}
        <div className="rounded-2xl border bg-background/30 backdrop-blur p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Events overview</div>
              <div className="text-sm text-foreground/70">Usporedba eventa (zadnjih 7 dana)</div>
            </div>

            <div className="text-right">
              <div className="text-xs text-foreground/60">Total</div>
              <div className="text-2xl font-bold leading-none">{fmtInt(total)}</div>
              <div className="text-xs text-foreground/60">~{perDay.toFixed(1)}/day</div>
            </div>
          </div>

          <div className="mt-5 space-y-6">
            <BarChart rows={events.map((e) => ({ label: e.label, value: e.value }))} />

            <div className="rounded-2xl border border-foreground/10 bg-background/10 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold">Mini funnel</div>
                  <div className="text-xs text-foreground/70">
                    Brzi uvid u “Start → End” prolaz.
                  </div>
                </div>

                <div className="text-sm">
                  <span className="text-foreground/70">Completion (end/start): </span>
                  <span className="font-bold">{completion.toFixed(1)}%</span>
                </div>
              </div>

              <FunnelRow
                start={events[0].value}
                guess={events[1].value}
                hint={events[2].value}
                end={events[3].value}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MiniMetric label="Completion (end/start)" value={`${completion.toFixed(1)}%`} />
              <MiniMetric label="Starts" value={fmtInt(events[0].value)} />
              <MiniMetric label="Ends" value={fmtInt(events[3].value)} />
            </div>
          </div>
        </div>

        {/* Event share */}
        <div className="rounded-2xl border bg-background/30 backdrop-blur p-4 sm:p-6">
          <div className="space-y-1">
            <div className="text-lg font-semibold">Event share</div>
            <div className="text-sm text-foreground/70">Udio svakog eventa u totalu</div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            <Donut
              total={total}
              slices={donutStops.map((d) => ({ label: d.label, value: d.value, color: d.color }))}
            />

            <div className="space-y-2">
              {donutStops.map((d) => {
                const pct = total > 0 ? (d.value / total) * 100 : 0;
                return (
                  <div
                    key={d.label}
                    className="rounded-2xl border border-foreground/10 bg-background/10 px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <div className="text-sm font-semibold truncate">{d.label}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold">{fmtInt(d.value)}</div>
                      <div className="text-xs text-foreground/60">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}

              <div className="text-xs text-foreground/60 pt-2">
               
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="rounded-2xl border bg-background/20 backdrop-blur px-4 py-3 text-xs text-foreground/70">
       
      </div>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-background/10 px-4 py-3">
      <div className="text-xs text-foreground/60">{title}</div>
      <div className="mt-1 text-2xl font-bold">{fmtInt(value)}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-background/10 px-4 py-3">
      <div className="text-xs text-foreground/60">{label}</div>
      <div className="mt-1 text-base font-bold">{value}</div>
    </div>
  );
}

function BarChart({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = (r.value / max) * 100;
        return (
          <div key={r.label} className="grid grid-cols-[84px_1fr_64px] items-center gap-3">
            <div className="text-sm font-semibold text-foreground/80">{r.label}</div>

            <div className="h-3 rounded-full bg-background/20 border border-foreground/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background:
                    "linear-gradient(90deg, hsl(28 95% 55%), hsl(22 90% 60%), hsl(210 100% 60%))",
                }}
              />
            </div>

            <div className="text-right text-sm font-bold">{fmtInt(r.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

function FunnelRow({
  start,
  guess,
  hint,
  end,
}: {
  start: number;
  guess: number;
  hint: number;
  end: number;
}) {
  const max = Math.max(1, start, guess, hint, end);
  const items = [
    { label: "Start", value: start },
    { label: "Guess", value: guess },
    { label: "Hint", value: hint },
    { label: "End", value: end },
  ];

  return (
    <div className="mt-4 grid grid-cols-1 gap-3">
      <div className="grid grid-cols-4 gap-2">
        {items.map((it) => {
          const w = Math.max(8, (it.value / max) * 100);
          return (
            <div key={it.label} className="rounded-xl border border-foreground/10 bg-background/10 p-3">
              <div className="text-xs text-foreground/60">{it.label}</div>
              <div className="mt-1 text-sm font-bold">{fmtInt(it.value)}</div>
              <div className="mt-2 h-1.5 rounded-full bg-background/20 border border-foreground/10 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${w}%`,
                    background: "linear-gradient(90deg, hsl(28 95% 55%), hsl(210 100% 60%))",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Donut({
  total,
  slices,
}: {
  total: number;
  slices: { label: string; value: number; color: string }[];
}) {
  const safeTotal = Math.max(1, total);
  let acc = 0;

  const parts = slices
    .map((s) => {
      const from = (acc / safeTotal) * 360;
      acc += s.value;
      const to = (acc / safeTotal) * 360;
      return `${s.color} ${from.toFixed(2)}deg ${to.toFixed(2)}deg`;
    })
    .join(", ");

  const bg = total > 0 ? `conic-gradient(${parts})` : "conic-gradient(hsl(0 0% 30%) 0deg 360deg)";

  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        <div
          className="h-44 w-44 sm:h-48 sm:w-48 rounded-full border border-foreground/10"
          style={{ background: bg }}
          aria-label="Event share donut chart"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full border border-foreground/10 bg-background/80 backdrop-blur flex items-center justify-center">
            <div className="text-center leading-tight">
              <div className="text-xs text-foreground/60">Total</div>
              <div className="text-2xl font-bold">{fmtInt(total)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
function num(n: unknown) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : 0;
}
