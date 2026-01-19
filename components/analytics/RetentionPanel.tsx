"use client";

import { useEffect, useMemo, useState } from "react";

type RetentionResponse = {
  retention: {
    newUsers: number;
    day1: number; // 0-100 (postotak)
    day7: number; // 0-100
  };
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
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
        const res = await fetch("/api/analytics/retention", { cache: "no-store" });
        const json = (await res.json()) as RetentionResponse;

        if (!res.ok) throw new Error((json as any)?.error || "Retention API error");
        setData(json);
      } catch (e: any) {
        setErr(e?.message ?? "Unknown error");
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const r = data?.retention;

  const heat = useMemo(() => {
    if (!r) return [];
    const cells = [
      { label: "Day 1", value: r.day1 },
      { label: "Day 7", value: r.day7 },
    ];
    return cells.map((c) => ({
      ...c,
      intensity: clamp01((c.value ?? 0) / 100),
    }));
  }, [r]);

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Retention</h2>
          <p className="text-sm text-slate-500">
            Koliko novih korisnika se vrati nakon 1 i 7 dana.
          </p>
        </div>

        {r && (
          <div className="text-right">
            <div className="text-xs text-slate-500">New users (period)</div>
            <div className="text-2xl font-semibold text-slate-900">{r.newUsers}</div>
          </div>
        )}
      </div>

      <div className="mt-6">
        {loading && <div className="text-sm text-slate-500">Učitavam retention…</div>}
        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        {!loading && !err && !r && (
          <div className="text-sm text-slate-500">Nema podataka još.</div>
        )}

        {!loading && !err && r && (
          <>
            {/* KPI cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Day 1</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {r.day1.toFixed(1)}%
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, r.day1))}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Day 7</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {r.day7.toFixed(1)}%
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, r.day7))}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Decay (D7 vs D1)</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {(r.day7 - r.day1).toFixed(1)} pp
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  “pp” = postotni poeni. Negativno znači pad retencije do 7. dana.
                </p>
              </div>
            </div>

            {/* Mini “heatmap” */}
            <div className="mt-6 rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-medium text-slate-900">Heat view</div>
              <p className="text-xs text-slate-500">
                Tamnije = veći postotak povratka.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {heat.map((c) => (
                  <div
                    key={c.label}
                    className="rounded-xl border border-slate-200 p-4"
                    style={{
                      backgroundColor: `rgba(15, 23, 42, ${0.05 + c.intensity * 0.35})`,
                    }}
                  >
                    <div className="text-xs text-slate-600">{c.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {c.value.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* kratka interpretacija (da ti odmah paše za zadatak) */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Interpretacija</div>
              <p className="mt-1 text-sm text-slate-700">
                Ako je Day 1 znatno veći od Day 7, korisnici probaju app ali se ne vraćaju dugoročno.
                UX ideje: jasniji “next step” nakon prvog pregleda igrača, podsjetnik/“daily challenge”
                (guesser daily), ili istakni preporuke/usporedbe odmah na homeu.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
