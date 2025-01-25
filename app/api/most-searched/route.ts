import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = createClient();
  console.log("Fetching most searched players...");

  const { data, error } = await (await supabase)
    .from("searchstats")
    .select("player_id, search_count, FullStats_NBA(PLAYER_NAME)")
    .order("search_count", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Supabase error:", error);  // LOG ERRORA U KONZOLU
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("Fetched data:", data);
  return NextResponse.json(data, { status: 200 });
}
