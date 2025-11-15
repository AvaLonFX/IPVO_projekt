import Link from "next/link";

export default function GuessHubPage() {
  const cards = [
    {
      href: "/guess/all-time/practice",
      title: "All-Time Practice",
      desc: "Random all-time player based on career averages.",
    },
    {
      href: "/guess/all-time/daily",
      title: "All-Time Daily",
      desc: "Jedan all-time igrač dnevno za sve korisnike.",
    },
    {
      href: "/guess/current/practice",
      title: "Current Practice",
      desc: "Aktivni NBA igrači, trenutne sezone statistike.",
    },
    {
      href: "/guess/current/daily",
      title: "Current Daily",
      desc: "Jedan aktualni igrač dnevno.",
    },
  ];

  return (
    <main className="min-h-screen px-4 py-10 flex justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">QNBA Guesser modes</h1>
        <p className="text-slate-300 mb-6">
          Odaberi način igre: all-time ili current, practice ili daily.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 hover:border-emerald-500 hover:bg-slate-900 transition"
            >
              <h2 className="text-lg font-semibold mb-1">{c.title}</h2>
              <p className="text-sm text-slate-300">{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
