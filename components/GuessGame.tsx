"use client";

import { useEffect, useState } from "react";
import { GuessStatsChart } from "@/components/GuessStatsChart";
import SearchPlayers from "@/components/nba_comp/SearchPlayers";

type PlayerInfo = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  country: string | null;
  height: string | null;
  draftYear: string | null;
};

type Stats = {
  pts: number;
  reb: number;
  ast: number;
};

type GuessGameProps = {
  apiPath: string;        // npr. "/api/guess/alltime-practice"
  title: string;
  subtitle: string;
};

export default function GuessGame({ apiPath, title, subtitle }: GuessGameProps) {
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [hints, setHints] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  const maxAttempts = 6;
  const maxHints = 4;

  const loadNewPlayer = async () => {
    setLoading(true);
    setMessage(null);
    setAttempts(0);
    setHints(0);
    setFinished(false);

    try {
      const res = await fetch(apiPath);
      const data = await res.json();
      console.log("API response:", apiPath, data);

      if (!res.ok || data.error) {
        setMessage("Greška pri dohvaćanju igrača: " + (data.error || ""));
        setStats(null);
        setPlayer(null);
        return;
      }

      setPlayer(data.player);
      setStats(data.stats);
    } catch (err) {
      console.error("Fetch error:", err);
      setMessage("Dogodila se greška.");
      setStats(null);
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNewPlayer();
  }, [apiPath]);

  const handlePlayerSelect = (selected: any) => {
    if (!player || finished) return;

    const selectedNumericId = Number(
      selected.PERSON_ID ?? selected.PLAYER_ID
    );
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (selectedNumericId === player.id) {
      setMessage(`TOČNO! Igrač je ${player.name}.`);
      setFinished(true);
    } else {
      if (newAttempts >= maxAttempts) {
        setMessage(
          `Iskoristio si sve pokušaje. Traženi igrač je bio ${player.name}.`
        );
        setFinished(true);
      } else {
        setMessage("Netočno, pokušaj ponovo!");
      }
    }
  };

  const revealHint = () => {
    if (!player || finished) return;

    setHints((h) => Math.min(h + 1, maxHints));

    setAttempts((prev) => {
      const newAttempts = prev + 1;

      if (newAttempts >= maxAttempts && player) {
        setFinished(true);
        setMessage(
          `Iskoristio si sve pokušaje. Traženi igrač je bio ${player.name}.`
        );
      }

      return newAttempts;
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10 flex justify-center">
      <div className="w-full max-w-4xl">
        {/* header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-slate-300">{subtitle}</p>
        </header>

        {/* slika + graf */}
        <section className="mb-10">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            {player && (
              <div className="flex justify-center">
                <div
                  className={`relative rounded-2xl overflow-hidden transition-all duration-700
                  ${finished ? "scale-100 opacity-100" : "scale-95 opacity-90"}`}
                >
                  <img
                    src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${player.id}.png`}
                    alt={player.name}
                    className={`h-64 w-64 md:h-80 md:w-80 object-cover transition-all duration-700
                      ${finished ? "blur-0 brightness-100" : "blur-xl brightness-75"}`}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                  {!finished && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs uppercase tracking-wide text-slate-100/85 bg-slate-900/70 px-3 py-1 rounded-full">
                        Tko je ovaj igrač?
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <div className="w-full">
                {loading && <p>Učitavanje igrača...</p>}
                {!loading && stats && (
                  <GuessStatsChart
                    pts={stats.pts}
                    reb={stats.reb}
                    ast={stats.ast}
                  />
                )}
                {!loading && !stats && (
                  <p className="text-slate-300">Nema dostupne statistike.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* search + hintovi + status */}
        <section className="bg-slate-900/80 rounded-xl p-5 space-y-4 border border-slate-700">
          <SearchPlayers onPlayerSelect={handlePlayerSelect} />

          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>
              Pokušaj: {attempts} / {maxAttempts}
            </span>
            <button
              onClick={revealHint}
              disabled={hints >= maxHints || finished}
              className="text-emerald-400 hover:underline disabled:opacity-40"
            >
              Prikaži hint ({hints}/{maxHints})
            </button>
          </div>

          {player && hints > 0 && (
            <div className="space-y-2 text-sm text-slate-200">
              {hints >= 1 && (
                <div className="p-2 bg-slate-800 rounded-md border border-slate-700">
                  <strong>Pozicija:</strong> {player.position || "N/A"}
                </div>
              )}
              {hints >= 2 && (
                <div className="p-2 bg-slate-800 rounded-md border border-slate-700">
                  <strong>Tim:</strong> {player.team || "N/A"}
                </div>
              )}
              {hints >= 3 && (
                <div className="p-2 bg-slate-800 rounded-md border border-slate-700">
                  <strong>Država / visina:</strong>{" "}
                  {player.country || "N/A"} / {player.height || "N/A"}
                </div>
              )}
              {hints >= 4 && (
                <div className="p-2 bg-slate-800 rounded-md border border-slate-700">
                  <strong>Draft godina:</strong> {player.draftYear || "N/A"}
                </div>
              )}
            </div>
          )}

          {message && <p className="text-sm mt-2">{message}</p>}

          {finished && player && (
            <div className="mt-3 p-4 rounded-xl bg-slate-800 border border-emerald-500/70">
              <p className="text-xs uppercase tracking-wide text-emerald-400 mb-1">
                Otkriveni igrač
              </p>
              <p className="text-lg font-bold text-white">{player.name}</p>
              <p className="text-xs text-gray-300">
                {player.team && `${player.team} • `}
                {player.position && `${player.position} • `}
                {player.draftYear && `Draft ${player.draftYear}`}
              </p>
            </div>
          )}

          {finished && (
            <button
              onClick={loadNewPlayer}
              className="mt-4 px-6 py-3 rounded-lg text-white bg-black hover:bg-gray-800 transition font-semibold"
            >
              Novi igrač
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
