import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/utils/supabase/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ Ispravno dodano 'await'
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("UserDreamTeams")
    .select("player_id, FullStats_NBA(PLAYER_NAME, PTS, REB, AST, Player_Rating)");

  if (error) {
    return res.status(500).json({ error: "Failed to fetch Dream Team" });
  }

  // ✅ Keširanje odgovora na serveru
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");

  return res.status(200).json(data);
}
