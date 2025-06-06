"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Button from "@/components/backtosearchbutton";

export default function CurrentStats() {
  const [players, setPlayers] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("PTS");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [teamFilter, setTeamFilter] = useState<string>(""); // Team filter
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const playersPerPage = 10;
  const router = useRouter();

  const nbaTeams = [
    "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
    "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
    "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS"
  ];

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        let query = supabase
          .from("CurrentStats_NBA")
          .select("*", { count: "exact" })
          .neq(filter, 0)
          .order(filter, { ascending: order === "asc" })
          .range((page - 1) * playersPerPage, page * playersPerPage - 1);

        if (teamFilter) {
          query = query.eq("TEAM_ABBREVIATION", teamFilter);
        }

        const { data, error, count } = await query;

        if (error) {
          console.error("Error fetching players:", error);
        } else {
          setPlayers(data || []);
          setTotalPlayers(count || 0);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      }
    };

    fetchPlayers();
  }, [filter, order, page, teamFilter]);

  const nextPage = () => {
    if (page < Math.ceil(totalPlayers / playersPerPage)) setPage(page + 1);
  };

  const prevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const goToPage = (pageNum: number) => {
    if (pageNum > 0 && pageNum <= Math.ceil(totalPlayers / playersPerPage)) {
      setPage(pageNum);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button />
      </div>

      <h2 className="text-2xl font-semibold mb-4">Explore Players by Stats</h2>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium">Filter by:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mt-1 px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="PTS">Points</option>
            <option value="REB">Rebounds</option>
            <option value="AST">Assists</option>
            <option value="STL">Steals</option>
            <option value="BLK">Blocks</option>
            <option value="FG_PCT">Field Goal %</option>
            <option value="FT_PCT">Free Throw %</option>
            <option value="Player_Rating">Player Rating</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Order:</label>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
            className="mt-1 px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Team:</label>
          <select
            value={teamFilter}
            onChange={(e) => {
              setTeamFilter(e.target.value);
              setPage(1); // reset to page 1 on new filter
            }}
            className="mt-1 px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">All Teams</option>
            {nbaTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {players.length > 0 ? (
        <div>
          <table className="w-full border-collapse border border-gray-300 mb-6 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                {[
                  "Player Name",
                  "Points",
                  "Rebounds",
                  "Assists",
                  "Steals",
                  "Blocks",
                  "FG %",
                  "FT %",
                  "Player Rating"
                ].map((heading) => (
                  <th key={heading} className="px-4 py-2 text-left border">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr
                  key={player.PLAYER_ID}
                  className="hover:bg-gray-100 cursor-pointer"
                  onClick={() =>
                    window.location.assign(`/player/${player.PLAYER_ID}`)
                  }
                >
                  <td className="px-4 py-2 border">{player.PLAYER_NAME}</td>
                  <td className="px-4 py-2 border">{player.PTS || 0}</td>
                  <td className="px-4 py-2 border">{player.REB || 0}</td>
                  <td className="px-4 py-2 border">{player.AST || 0}</td>
                  <td className="px-4 py-2 border">{player.STL || 0}</td>
                  <td className="px-4 py-2 border">{player.BLK || 0}</td>
                  <td className="px-4 py-2 border">
                    {player.FG_PCT ? parseFloat(player.FG_PCT).toFixed(2) : 0}
                  </td>
                  <td className="px-4 py-2 border">
                    {player.FT_PCT ? parseFloat(player.FT_PCT).toFixed(2) : 0}
                  </td>
                  <td className="px-4 py-2 border bg-green-100 text-green-700 font-semibold">
                    {player.Player_Rating || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={prevPage}
              disabled={page === 1}
              className={`px-4 py-2 rounded-md ${
                page === 1
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              Previous
            </button>
            <span className="text-sm">
              Page {page} of {Math.ceil(totalPlayers / playersPerPage)}
            </span>
            <button
              onClick={nextPage}
              disabled={page === Math.ceil(totalPlayers / playersPerPage)}
              className={`px-4 py-2 rounded-md ${
                page === Math.ceil(totalPlayers / playersPerPage)
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              Next
            </button>
            <input
              type="number"
              value={page}
              onChange={(e) => goToPage(Number(e.target.value))}
              className="w-16 px-3 py-2 border border-gray-300 rounded-md text-center"
              min={1}
              max={Math.ceil(totalPlayers / playersPerPage)}
            />
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-500">No players found.</p>
      )}
    </div>
  );
}
