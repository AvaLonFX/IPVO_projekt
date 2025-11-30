"use client";

import { useEffect, useState } from "react";

const teamAbbreviationToId: Record<string, string> = {
  ATL: "1610612737",
  BOS: "1610612738",
  BKN: "1610612751",
  CHA: "1610612766",
  CHI: "1610612741",
  CLE: "1610612739",
  DAL: "1610612742",
  DEN: "1610612743",
  DET: "1610612765",
  GSW: "1610612744",
  HOU: "1610612745",
  IND: "1610612754",
  LAC: "1610612746",
  LAL: "1610612747",
  MEM: "1610612763",
  MIA: "1610612748",
  MIL: "1610612749",
  MIN: "1610612750",
  NOP: "1610612740",
  NYK: "1610612752",
  OKC: "1610612760",
  ORL: "1610612753",
  PHI: "1610612755",
  PHX: "1610612756",
  POR: "1610612757",
  SAC: "1610612758",
  SAS: "1610612759",
  TOR: "1610612761",
  UTA: "1610612762",
  WAS: "1610612764",
};

interface Game {
  gameID: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
}

export default function NBASchedule() {
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await fetch("/api/nba-schedule");
        const data = await res.json();
        setGames(data);
      } catch (error) {
        console.error("Error fetching NBA schedule:", error);
      }
    };

    fetchSchedule();
  }, []);

  const getLogoUrl = (tricode: string) => {
    const teamId = teamAbbreviationToId[tricode];
    return teamId
      ? `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`
      : null;
  };

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6 text-center">NBA Schedule</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 text-sm shadow-md rounded-lg overflow-hidden">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="py-3 px-4 text-left">Date</th>
              <th className="py-3 px-4 text-left">Home</th>
              <th className="py-3 px-4 text-left">Away</th>
              <th className="py-3 px-4 text-left">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {games.map((game) => {
              const dateStr = game.date
                ? new Date(game.date).toLocaleDateString("en-US")
                : "TBD";

              return (
                <tr key={game.gameID} className="hover:bg-gray-50 transition">
                  <td className="py-2 px-4 font-medium text-gray-800">
                    {dateStr}
                  </td>

                  <td className="py-2 px-4 flex items-center gap-2">
                    {getLogoUrl(game.homeTeam) && (
                      <img
                        src={getLogoUrl(game.homeTeam)!}
                        alt={game.homeTeam}
                        className="w-6 h-6 object-contain"
                      />
                    )}
                    {game.homeTeam}
                  </td>

                  <td className="py-2 px-4 flex items-center gap-2">
                    {getLogoUrl(game.awayTeam) && (
                      <img
                        src={getLogoUrl(game.awayTeam)!}
                        alt={game.awayTeam}
                        className="w-6 h-6 object-contain"
                      />
                    )}
                    {game.awayTeam}
                  </td>

                  <td className="py-2 px-4 text-gray-600">
                    {game.status || "TBD"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
