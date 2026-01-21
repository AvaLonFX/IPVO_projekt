"use client";

import { useEffect, useMemo, useState } from "react";

type FunnelRow = { step: string; users: number };

// conversionRate može biti stari broj ili novi objekt s više metrika
type ConversionRateObject = {
  viewFromSearch?: number;   // %
  compareFromView?: number;  // %
  compareFromSearch?: number; // %
};

type FunnelResponse = {
  funnel: FunnelRow[];
  conversionRate?: number | ConversionRateObject;
};

function formatPct(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(1)}%`;
}

export default function FunnelPanel() {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch("/api/analytics/funnel", { cache: "no-store" });
        const json = (await res.json()) as FunnelResponse;

        if (!res.ok) throw new Error((json as any)?.error || "Funnel API error");
        setData(json);
      } catch (e: any) {
        setErr(e?.message ?? "Unknown error");
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const funnel = data?.funnel ?? [];
  const maxUsers = useMemo(() => Math.max(1, ...funnel.map((r) => r.users)), [funnel]);

  const computedConversion = useMemo(() => {
    if (funnel.length < 2) return 0;
    const first = funnel[0]?.users ?? 0;
    const last = funnel[funnel.length - 1]?.users ?? 0;
    if (first <= 0) return 0;
    return (last / first) * 100;
  }, [funnel]);

  // Ako API vrati object conversionRate, glavni "headline" conversion je last/first (kao i prije)
  const conversionHeadline = useMemo(() => {
    const cr = data?.conversionRate;
    if (typeof cr === "number") return cr;
    return computedConversion;
  }, [data?.conversionRate, computedConversion]);

  const conversionDetails: ConversionRateObject | null = useMemo(() => {
    const cr = data?.conversionRate;
    if (cr && typeof cr === "object") return cr;
    return null;
  }, [data?.conversionRate]);

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Funnel</h2>
          <p className="text-sm text-slate-500">
            Pregled koraka (Search → View → …) i pad korisnika po koracima.
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">Conversion (last / first)</div>
          <div className="text-2xl font-semibold text-slate-900">
            {formatPct(conversionHeadline)}
          </div>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${Math.max(0, Math.min(100, conversionHeadline))}%` }}
        />
      </div>

      {/* Ako API vrati dodatne metrike, prikaži ih kao “mini stat” */}
      {conversionDetails && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Search → View</div>
            <div className="text-lg font-semibold text-slate-900">
              {formatPct(conversionDetails.viewFromSearch ?? 0)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">View → Compare</div>
            <div className="text-lg font-semibold text-slate-900">
              {formatPct(conversionDetails.compareFromView ?? 0)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Search → Compare</div>
            <div className="text-lg font-semibold text-slate-900">
              {formatPct(conversionDetails.compareFromSearch ?? 0)}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        {loading && <div className="text-sm text-slate-500">Učitavam funnel…</div>}
        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        {!loading && !err && funnel.length === 0 && (
          <div className="text-sm text-slate-500">Nema podataka još.</div>
        )}

        {!loading && !err && funnel.length > 0 && (
          <div className="mt-2 grid gap-3">
            {funnel.map((row, idx) => {
              const prev = idx === 0 ? null : funnel[idx - 1];
              const dropFromPrev =
                prev && prev.users > 0 ? (row.users / prev.users) * 100 : null;

              return (
                <div
                  key={`${row.step}-${idx}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
                          {idx + 1}
                        </span>
                        {row.step}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {prev ? (
                          <>
                            od prethodnog:{" "}
                            <span className="font-semibold text-slate-700">
                              {dropFromPrev ? formatPct(dropFromPrev) : "—"}
                            </span>
                          </>
                        ) : (
                          "prvi korak"
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xs text-slate-500">Users</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {row.users}
                      </div>
                    </div>
                  </div>

                  {/* bar za vizual */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-slate-900/80"
                      style={{ width: `${(row.users / maxUsers) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
