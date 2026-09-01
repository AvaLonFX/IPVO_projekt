import "server-only";
import { admin } from "./guesser-server";
import { profile } from "./match-simulation";
export async function simulationPlayers(ids?: number[]) {
  const db = admin();
  let query = db
    .from("nba_current_snapshot")
    .select("player_id,season,synced_at,payload")
    .order("player_id")
    .limit(1000);
  if (ids) query = query.in("player_id", ids);
  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length || new Set(data.map((p) => p.season)).size !== 1)
    throw Error("A consistent season snapshot is unavailable.");
  const { data: bios, error: be } = await db
    .from("Osnovno_NBA")
    .select("PERSON_ID,POSITION")
    .in(
      "PERSON_ID",
      data.map((p) => p.player_id),
    )
    .limit(1000);
  if (be) throw be;
  const positions = new Map(
    bios.map((p) => [Number(p.PERSON_ID), String(p.POSITION || "")]),
  );
  const players = data
    .map((row) =>
      profile(
        row.payload as Record<string, unknown>,
        positions.get(Number(row.player_id)) || "",
      ),
    )
    .filter((p): p is NonNullable<typeof p> => !!p);
  return { players, season: data[0].season, syncedAt: data[0].synced_at };
}
