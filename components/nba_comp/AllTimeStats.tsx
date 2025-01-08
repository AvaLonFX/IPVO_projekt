"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AllTimeStats() {
  const [players, setPlayers] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("PTS");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const playersPerPage = 10;
  const router = useRouter(); // Za navigaciju

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const { data, error, count } = await supabase
          .from("FullStats_NBA")
          .select("*", { count: "exact" })
          .neq(filter, 0)
          .order(filter, { ascending: order === "asc" })
          .range((page - 1) * playersPerPage, page * playersPerPage - 1);

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
  }, [filter, order, page]);

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
    <div style={{ padding: "20px" }}>
      {/* Back to Search Button */}
      <div style={{ marginBottom: "20px", textAlign: "left" }}>
        <button
          onClick={() => router.push("../")} // Navigacija na glavnu stranicu
          style={{
            padding: "10px 20px",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Back to Search
        </button>
      </div>
      <h2 className="text-2xl mb-2" style={{ marginBottom: "20px" }}>
        Explore Players by Stats
      </h2>
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <label>
          Filter by:
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              marginLeft: "10px",
              padding: "5px",
              border: "1px solid #0070f3",
              borderRadius: "5px",
            }}
          >
            <option value="PTS">Points</option>
            <option value="REB">Rebounds</option>
            <option value="AST">Assists</option>
            <option value="STL">Steals</option>
            <option value="BLK">Blocks</option>
            <option value="Player_Rating">Player Rating</option>
            <option value="FG_PCT">Field Goal %</option> {/* Dodano */}
            <option value="FT_PCT">Free Throw %</option> {/* Dodano */}
          </select>
        </label>
        <label>
          Order:
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
            style={{
              marginLeft: "10px",
              padding: "5px",
              border: "1px solid #0070f3",
              borderRadius: "5px",
            }}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>
      {players.length > 0 ? (
        <div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "20px",
              boxShadow: "0px 4px 8px rgba(0,0,0,0.1)",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#0070f3", color: "black" }}>
                <th
                  style={{
                    padding: "20px",
                    textAlign: "left",
                    border: "1px solid #ddd",
                  }}
                >
                  Player Name
                </th>
                <th
                  style={{
                    padding: "20px",
                    textAlign: "left",
                    border: "1px solid #ddd",
                  }}
                >
                  Points
                </th>
                <th
                  style={{
                    padding: "20px",
                    textAlign: "left",
                    border: "1px solid #ddd",
                  }}
                >
                  Rebounds
                </th>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ddd",
                  }}
                >
                  Assists
                </th>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ddd",
                  }}
                >
                  Steals
                </th>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ddd",
                  }}
                >
                  Blocks
                </th>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ddd",
                  }}
                >
                  FG %
                </th>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ddd",
                  }}
                >
                  FT %
                </th>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ddd",
                    backgroundColor: "#d4edda", // Zelenkasta pozadina
                    color: "#0000", // Tamnozelena boja teksta
                  }}
                >
                  Player Rating
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr
                  key={player.PERSON_ID}
                  style={{
                    backgroundColor: "#fff",
                    borderBottom: "1px solid #ddd",
                  }}
                  onClick={() =>
                    window.location.assign(`/player/${player.PERSON_ID}`)
                  }
                  onMouseOver={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f1f1f1")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.backgroundColor = "#fff")
                  }
                >
                  <td style={{ padding: "20px" }}>{player.PLAYER_NAME}</td>
                  <td style={{ padding: "20px" }}>{player.PTS || 0}</td>
                  <td style={{ padding: "20px" }}>{player.REB || 0}</td>
                  <td style={{ padding: "20px" }}>{player.AST || 0}</td>
                  <td style={{ padding: "20px" }}>{player.STL || 0}</td>
                  <td style={{ padding: "20px" }}>{player.BLK || 0}</td>
                  <td style={{ padding: "20px" }}>
                    {player.FG_PCT ? parseFloat(player.FG_PCT).toFixed(2) : 0}
                  </td>
                  <td style={{ padding: "20px" }}>
                    {player.FT_PCT ? parseFloat(player.FT_PCT).toFixed(2) : 0}
                  </td>
                  <td
                    style={{
                      padding: "10px",
                      backgroundColor: "#d4edda", // Zelenkasta pozadina
                      color: "#155724", // Tamnozelena boja teksta
                    }}
                  >
                    {player.Player_Rating || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Navigacija */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <button
              onClick={prevPage}
              disabled={page === 1}
              style={{
                padding: "5px 10px",
                backgroundColor: page === 1 ? "#ddd" : "#0070f3",
                color: page === 1 ? "#999" : "#fff",
                borderRadius: "5px",
                border: "none",
                cursor: page === 1 ? "not-allowed" : "pointer",
              }}
            >
              Previous
            </button>
            <p>
              Page {page} of {Math.ceil(totalPlayers / playersPerPage)}
            </p>
            <button
              onClick={nextPage}
              disabled={page === Math.ceil(totalPlayers / playersPerPage)}
              style={{
                padding: "5px 10px",
                backgroundColor:
                  page === Math.ceil(totalPlayers / playersPerPage)
                    ? "#ddd"
                    : "#0070f3",
                color:
                  page === Math.ceil(totalPlayers / playersPerPage)
                    ? "#999"
                    : "#fff",
                borderRadius: "5px",
                border: "none",
                cursor:
                  page === Math.ceil(totalPlayers / playersPerPage)
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              Next
            </button>
            <input
              type="number"
              value={page}
              onChange={(e) => goToPage(Number(e.target.value))}
              style={{
                width: "50px",
                textAlign: "center",
                padding: "5px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
        </div>
      ) : (
        <p>No players found.</p>
      )}
    </div>
  );
}
