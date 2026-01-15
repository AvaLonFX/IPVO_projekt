"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GuessStatsChart } from "@/components/GuessStatsChart";
import SearchPlayers from "@/components/nba_comp/SearchPlayers";
import { trackEvent } from "@/lib/gtag";

type PlayerInfo = {
  id: number | string;
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

type GuessEntry = {
  id: number;
  name: string;
  correct: boolean;
};

type GuessGameProps = {
  apiPath: string;
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

  const [guesses, setGuesses] = useState<GuessEntry[]>([]);
  const [guessedIds, setGuessedIds] = useState<number[]>([]);

  const maxAttempts = 6;
  const maxHints = 4;

  const era = apiPath.includes("alltime") ? "all_time" : "current";
  const mode = apiPath.includes("daily") ? "daily" : "practice";

  const loadNewPlayer = async () => {
    setLoading(true);
    setMessage(null);
    setAttempts(0);
    setHints(0);
    setFinished(false);
    setGuesses([]);
    setGuessedIds([]);

    try {
      const res = await fetch(apiPath);
      const data = await res.json();
      console.log("API response:", apiPath, data);

      if (!res.ok || data.error) {
        setMessage("Error fetching player: " + (data.error || ""));
        setStats(null);
        setPlayer(null);

        return;
      }

      setPlayer(data.player);
      setStats(data.stats);
      trackEvent("guesser_start", { era, mode });

    } catch (err) {
      console.error("Fetch error:", err);
      setMessage("An error occurred while loading player data.");
      setStats(null);
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNewPlayer();
  }, [apiPath]);

  // Called when player is clicked in SearchPlayers
  const handlePlayerGuess = (clicked: any) => {
    if (!player || finished) return;

    const selectedNumericId = Number(clicked.PERSON_ID ?? clicked.PLAYER_ID);
    const targetNumericId = Number(player.id);

    // Prevent guessing same player twice
    if (guessedIds.includes(selectedNumericId)) {
      setMessage("You already guessed this player. Try someone else.");
      return;
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setGuessedIds((prev) => [...prev, selectedNumericId]);

    const guessName = `${clicked.PLAYER_FIRST_NAME} ${clicked.PLAYER_LAST_NAME}`;
    const isCorrect = selectedNumericId === targetNumericId;
    trackEvent("guesser_guess", {
      era,
      mode,
      correct: isCorrect,
      attempt: newAttempts,
    });


    setGuesses((prev) => [
      ...prev,
      {
        id: selectedNumericId,
        name: guessName,
        correct: isCorrect,
      },
    ]);

    if (isCorrect) {
      setMessage(`Correct! The player is ${player.name}.`);
      trackEvent("guesser_end", {
        era,
        mode,
        result: "win",
        attempts_used: newAttempts,
      });

      setFinished(true);
    } else {
      if (newAttempts >= maxAttempts) {
        setMessage(
          `You've used all attempts. The correct player was ${player.name}.`
        );
        trackEvent("guesser_end", {
        era,
        mode,
        result: "lose",
        attempts_used: newAttempts,
      });

        setFinished(true);
      } else {
        setMessage("Incorrect! Try again.");
      }
    }
  };

  const revealHint = () => {
    if (!player || finished) return;
    
    setHints((h) => Math.min(h + 1, maxHints));
    trackEvent("guesser_hint", {
      era,
      mode,
      hint_number: hints + 1,
    });

    setAttempts((prev) => {
      const newAttempts = prev + 1;

      if (newAttempts >= maxAttempts && player) {
        setFinished(true);
        setMessage(
          `You've used all attempts. The correct player was ${player.name}.`
        );
      }

      return newAttempts;
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10 flex justify-center">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-slate-300">{subtitle}</p>
        </header>

        {/* Image + Chart */}
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
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {!finished && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs uppercase tracking-wide text-slate-100/85 bg-slate-900/70 px-3 py-1 rounded-full">
                        Who is this player?
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <div className="w-full">
                {loading && <p>Loading player...</p>}
                {!loading && stats && (
                  <GuessStatsChart
                    pts={stats.pts}
                    reb={stats.reb}
                    ast={stats.ast}
                  />
                )}
                {!loading && !stats && (
                  <p className="text-slate-300">No stats available.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Search + hints + status */}
        <section className="bg-slate-900/80 rounded-xl p-5 space-y-4 border border-slate-700">
          <SearchPlayers
            onPlayerClick={handlePlayerGuess}
            inputTextColor="black"
          />

          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>
              Attempts: {attempts} / {maxAttempts}
            </span>
            <button
              onClick={revealHint}
              disabled={hints >= maxHints || finished}
              className="text-emerald-400 hover:underline disabled:opacity-40"
            >
              Show hint ({hints}/{maxHints})
            </button>
          </div>

          {/* Hints */}
          {player && hints > 0 && (
            <div className="space-y-2 text-sm text-slate-200">
              {hints >= 1 && (
                <div className="p-2 bg-slate-800 rounded-md border border-slate-700">
                  <strong>Position:</strong> {player.position || "N/A"}
                </div>
              )}
              {hints >= 2 && (
                <div className="p-2 bg-slate-800 rounded-md border border-slate-700">
                  <strong>Team:</strong> {player.team || "N/A"}
                </div>
              )}
              {hints >= 3 && (
                <div className="p-2 bg-slate-800 rounded-md border border-slate-700">
                  <strong>Country / Height:</strong>{" "}
                  {player.country || "N/A"} / {player.height || "N/A"}
                </div>
              )}
              {hints >= 4 && (
                <div className="p-2 bg-slate-800 rounded-md border border-slate-700">
                  <strong>Draft Year:</strong> {player.draftYear || "N/A"}
                </div>
              )}
            </div>
          )}

          {/* Guess history */}
          {guesses.length > 0 && (
            <div className="mt-3 text-sm text-slate-200">
              <p className="font-semibold mb-1">Guess history:</p>
              <ul className="space-y-1">
                {guesses.map((g, idx) => (
                  <li
                    key={`${g.id}-${idx}`}
                    className={`flex justify-between text-xs md:text-sm ${
                      g.correct ? "text-emerald-400" : "text-slate-300"
                    }`}
                  >
                    <span>
                      {idx + 1}. {g.name}
                    </span>
                    <span>{g.correct ? "✅ Correct" : "❌ Incorrect"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {message && <p className="text-sm mt-2">{message}</p>}

          {finished && player && (
            <div className="mt-3 p-4 rounded-xl bg-slate-800 border border-emerald-500/70">
              <p className="text-xs uppercase tracking-wide text-emerald-400 mb-1">
                Revealed Player
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
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={loadNewPlayer}
                className="px-6 py-3 rounded-lg text-white bg-black hover:bg-gray-800 transition font-semibold"
              >
                New Player
              </button>
              
              {player && (
                <Link
                  href={`/player/${player.id}`}
                  className="px-6 py-3 rounded-lg text-white bg-black hover:bg-gray-800 transition font-semibold"
                >
                  Show stats
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
