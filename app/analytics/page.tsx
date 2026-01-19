// app/analytics/page.tsx
import Link from "next/link";
import { fetchGuesserEventsSummary, getGoogleAuthUrl, disconnectGa } from "@/lib/ga-data";


export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const sp = await searchParams;

  //const authUrl = getGoogleAuthUrl();
  const summary = await fetchGuesserEventsSummary(7); // last 7 days

  async function disconnectAction() {
    "use server";
    await disconnectGa();
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>
      <p className="text-sm text-gray-500">
        Ovdje dohvaćamo GA4 evente preko <b>Google Analytics Data API</b> (runReport).
      </p>

      {sp?.error && (
        <div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-700 text-sm">
          Error: {sp.error}
        </div>
      )}

      {!summary ? (
        <div className="p-4 rounded-xl border bg-white space-y-3">
          <p className="text-sm">
            Trenutno nisi povezan s Google Analytics. Klikni gumb ispod i autoriziraj{" "}
            <b>analytics.readonly</b>.
          </p>
          <Link
            href="/api/google/start"

            className="inline-block px-4 py-2 rounded-md bg-black text-white hover:bg-gray-800 transition"
          >
            Connect Google Analytics
          </Link>
        </div>
      ) : (
        <div className="p-4 rounded-xl border bg-white space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              ✅ Povezano. Prikaz za zadnjih <b>7 dana</b>.
            </p>

            <form action={disconnectAction}>
              <button className="px-3 py-2 rounded-md border hover:bg-gray-50 text-sm">
                Disconnect
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard title="guesser_start" value={summary.guesser_start} />
            <StatCard title="guesser_guess" value={summary.guesser_guess} />
            <StatCard title="guesser_hint" value={summary.guesser_hint} />
            <StatCard title="guesser_end" value={summary.guesser_end} />
          </div>

          <p className="text-xs text-gray-500">
            Napomena: `era` i `mode` parametri koje šalješ u trackEvent neće se vidjeti u GA Data API-ju
            dok ih ne registriraš u GA4 kao custom dimensions. Za zadatak je dovoljno da se vidi da
            eventi postoje i da ih dohvaćaš preko API-ja.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="p-4 rounded-xl border bg-gray-50">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
