import Link from "next/link";

export default function GuessPage() {
  return (
    <div className="w-full px-4 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          QNBA Guesser modes
        </h1>
        <p className="mt-1 text-foreground/70">
          Odaberi način igre: all-time ili current, practice ili daily.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/guess/all-time/practice"
            className="group rounded-2xl border border-border/60 bg-background/20 backdrop-blur-md p-5 hover:bg-background/30 transition"
          >
            <div className="text-lg font-semibold">All-Time Practice</div>
            <div className="mt-1 text-sm text-foreground/70">
              Random all-time player based on career averages.
            </div>
            <div className="mt-4 text-sm font-semibold underline underline-offset-4 opacity-80 group-hover:opacity-100">
              Open →
            </div>
          </Link>

          <Link
            href="/guess/all-time/daily"
            className="group rounded-2xl border border-border/60 bg-background/20 backdrop-blur-md p-5 hover:bg-background/30 transition"
          >
            <div className="text-lg font-semibold">All-Time Daily</div>
            <div className="mt-1 text-sm text-foreground/70">
              Jedan all-time igrač dnevno za sve korisnike.
            </div>
            <div className="mt-4 text-sm font-semibold underline underline-offset-4 opacity-80 group-hover:opacity-100">
              Open →
            </div>
          </Link>

          <Link
            href="/guess/current/practice"
            className="group rounded-2xl border border-border/60 bg-background/20 backdrop-blur-md p-5 hover:bg-background/30 transition"
          >
            <div className="text-lg font-semibold">Current Practice</div>
            <div className="mt-1 text-sm text-foreground/70">
              Aktivni NBA igrači, trenutne sezone statistike.
            </div>
            <div className="mt-4 text-sm font-semibold underline underline-offset-4 opacity-80 group-hover:opacity-100">
              Open →
            </div>
          </Link>

          <Link
            href="/guess/current/daily"
            className="group rounded-2xl border border-border/60 bg-background/20 backdrop-blur-md p-5 hover:bg-background/30 transition"
          >
            <div className="text-lg font-semibold">Current Daily</div>
            <div className="mt-1 text-sm text-foreground/70">
              Jedan aktualni igrač dnevno.
            </div>
            <div className="mt-4 text-sm font-semibold underline underline-offset-4 opacity-80 group-hover:opacity-100">
              Open →
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
