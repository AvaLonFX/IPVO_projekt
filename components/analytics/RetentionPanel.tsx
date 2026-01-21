"use client";

import { useEffect, useMemo, useState } from "react";

type RetentionResponse = {
  day1?: number;
  day7?: number;
  d1?: number;
  d7?: number;
  retention1?: number;
  retention7?: number;
};

function pct(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(1)}%`;
}

function getD1D7(r: RetentionResponse | null) {
  const d1 = r?.day1 ?? r?.d1 ?? r?.retention1 ?? null;
  const d7 = r?.day7 ?? r?.d7 ?? r?.retention7 ?? null;
  return { d1, d7 };
}

export default function RetentionPanel() {
  const [data, setData] = useState<RetentionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // ako ti je endpoint drugačiji, samo promijeni ovu liniju:
        const res = await fetch("/api/analytics/retention", { cache: "no-store" });
        const json = (await res.json()) as RetentionResponse;

        if (!res.ok) throw new Error((json as any)?.error || "Retention API error");
        setData(json);
      } catch (e: any) {
        // ako endpoint ne postoji ili nema podataka, nećemo rušiti UI
        setErr(e?.message ?? null);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { d1, d7 } = useMemo(() => getD1D7(data), [data]);

  const hasNumbers = d1 !== null && d7 !== null;

  return (
    <section className="w-full rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Retention</h2>
          <p className="text-sm text-foreground/70">
            Koliko novih korisnika se vrati nakon 1 i 7 dana.
          </p>
        </div>

        {hasNumbers ? (
          <div className="text-right">
            <div className="text-xs text-foreground/60">D7 / D1 ratio</div>
            <div className="text-2xl font-semibold text-foreground">
              {d1 && d1 > 0 ? pct((d7! / d1) * 100) : "—"}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        {loading && <div className="text-sm text-foreground/70">Učitavam retention…</div>}

        {!loading && err && (
          <div className="text-sm text-foreground/60">
            Nema podataka još. (ili endpoint nije postavljen)
          </div>
        )}

        {!loading && !err && !hasNumbers && (
          <div className="text-sm text-foreground/60">Nema podataka još.</div>
        )}

        {!loading && hasNumbers && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RetentionCard title="Day 1" value={d1!} />
            <RetentionCard title="Day 7" value={d7!} />

            <div className="sm:col-span-2 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="text-sm font-semibold text-foreground">Trend (mini)</div>
              <p className="mt-1 text-xs text-foreground/60">
                Ovo je samo “D1 → D7” vizual. Za pravi trend po danima treba timeseries iz GA.
              </p>

              <div className="mt-4 flex items-end gap-3">
                <Bar label="D1" value={d1!} max={Math.max(d1!, d7!)} />
                <Bar label="D7" value={d7!} max={Math.max(d1!, d7!)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function RetentionCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <div className="text-xs text-foreground/60">{title}</div>
      <div className="text-2xl font-semibold text-foreground">{pct(value)}</div>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between text-xs text-foreground/60">
        <span>{label}</span>
        <span className="font-semibold text-foreground/80">{pct(value)}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: "linear-gradient(90deg, hsl(var(--chart-2)), hsl(var(--chart-1)))",
          }}
        />
      </div>
    </div>
  );
}
