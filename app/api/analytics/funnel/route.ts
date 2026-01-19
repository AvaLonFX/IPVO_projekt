import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // jedinstveni korisnici koji su tražili igrače
  const { data: searchUsers, error: e1 } = await supabase
    .from("user_interactions")
    .select("user_id")
    .eq("event_type", "search_click");

  // jedinstveni korisnici koji su gledali profile
  const { data: viewUsers, error: e2 } = await supabase
    .from("user_interactions")
    .select("user_id")
    .eq("event_type", "view_player");

  if (e1 || e2) {
    return NextResponse.json({ error: "Query error" }, { status: 500 });
  }

  const searchSet = new Set(searchUsers?.map((r) => r.user_id));
  const viewSet = new Set(viewUsers?.map((r) => r.user_id));

  const searched = searchSet.size;
  const viewed = Array.from(searchSet).filter((u) => viewSet.has(u)).length;

  return NextResponse.json({
    funnel: [
      { step: "Search player", users: searched },
      { step: "View player profile", users: viewed },
    ],
    conversionRate:
      searched > 0 ? Number(((viewed / searched) * 100).toFixed(2)) : 0,
  });
}
