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

  // jedinstveni korisnici koji su kliknuli "Compare"
  const { data: compareUsers, error: e3 } = await supabase
    .from("user_interactions")
    .select("user_id")
    .eq("event_type", "compare_click");

  if (e1 || e2 || e3) {
    return NextResponse.json({ error: "Query error" }, { status: 500 });
  }

  const searchSet = new Set(searchUsers?.map((r) => r.user_id));
  const viewSet = new Set(viewUsers?.map((r) => r.user_id));
  const compareSet = new Set(compareUsers?.map((r) => r.user_id));

  const searched = searchSet.size;

  // users koji su searchali i onda viewali
  const viewed = Array.from(searchSet).filter((u) => viewSet.has(u)).length;

  // users koji su viewali i onda kliknuli compare (funnel: Search -> View -> Compare)
  const compared = Array.from(searchSet).filter(
    (u) => viewSet.has(u) && compareSet.has(u)
  ).length;

  return NextResponse.json({
    funnel: [
      { step: "Search player", users: searched },
      { step: "View player profile", users: viewed },
      { step: "Click Compare", users: compared },
    ],
    conversionRate: {
      viewFromSearch: searched > 0 ? Number(((viewed / searched) * 100).toFixed(2)) : 0,
      compareFromView: viewed > 0 ? Number(((compared / viewed) * 100).toFixed(2)) : 0,
      compareFromSearch: searched > 0 ? Number(((compared / searched) * 100).toFixed(2)) : 0,
    },
  });
}
