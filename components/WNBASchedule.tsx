"use client";

import { useEffect, useState } from "react";

// Map of team tricode to WNBA team ID for logos
const teamAbbreviationToId: Record<string, string> = {
  ATL: "1611661330",
  CHI: "1611661329",
  CON: "1611661323",
  DAL: "1611661321",
  IND: "1611661325",
  LAS: "1611661320",
  MIN: "1611661324",
  NYL: "1611661313",
  PHX: "1611661317",
  SEA: "1611661328",
  WAS: "1611661322",
  LVA: "1611661319",
  GSV: "1611661331",
};

interface Game {
    gameID: string;
    date: string;
    homeTeam: string;
    awayTeam: string;
    status: string;
  }
  
  export default function WNBASchedule() {
    const [games, setGames] = useState<Game[]>([]);
  
    useEffect(() => {
      const fetchSchedule = async () => {
        try {
          const res = await fetch("/api/wnba-schedule");
          const data = await res.json();
          setGames(data);
        } catch (error) {
          console.error("Error fetching WNBA schedule:", error);
        }
      };
  
      fetchSchedule();
    }, []);
  
    const getLogoUrl = (tricode: string): string | null => {
      const teamId = teamAbbreviationToId[tricode];
      return teamId
        ? `https://cdn.wnba.com/logos/wnba/${teamId}/primary/L/logo.svg`
        : null;
    };
  
    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold mb-6 text-center">WNBA Schedule</h2>
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
                      <span className="font-medium text-gray-700">
                        {game.homeTeam}
                      </span>
                    </td>
                    <td className="py-2 px-4 flex items-center gap-2">
                      {getLogoUrl(game.awayTeam) && (
                        <img
                          src={getLogoUrl(game.awayTeam)!}
                          alt={game.awayTeam}
                          className="w-6 h-6 object-contain"
                        />
                      )}
                      <span className="font-medium text-gray-700">
                        {game.awayTeam}
                      </span>
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