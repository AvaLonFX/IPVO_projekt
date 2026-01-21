import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();

  const { searchParams } = new URL(req.url);
  const model = searchParams.get("model") || "lr_moneyline_v1";

  // 1) Upcoming schedule (kao prije)
  const { data: games, error: gamesError } = await supabase
    .from("GameSchedule")
    .select("nba_game_id,date,homeTeam,awayTeam,status,startTime,home_team_id,away_team_id")
    .gt("startTime", new Date().toISOString())
    .order("startTime", { ascending: true })
    .limit(25);

  if (gamesError) {
    return new Response(JSON.stringify({ error: gamesError.message }), { status: 500 });
  }

  const gameIds = (games || [])
    .map((g: any) => g.nba_game_id)
    .filter(Boolean);

  // 2) Odds for those games + chosen model
  let oddsMap = new Map<string, any>();

  if (gameIds.length > 0) {
    const { data: odds, error: oddsError } = await supabase
      .from("GameOdds")
      .select("nba_game_id,model_name,p_home,odds_home_decimal,odds_away_decimal")
      .in("nba_game_id", gameIds)
      .eq("model_name", model);

    if (oddsError) {
      return new Response(JSON.stringify({ error: oddsError.message }), { status: 500 });
    }

    (odds || []).forEach((o: any) => oddsMap.set(o.nba_game_id, o));
  }

  // 3) Merge
  const merged = (games || []).map((g: any) => {
    const o = oddsMap.get(g.nba_game_id);
    return {
      ...g,
      p_home: o?.p_home ?? null,
      odds_home_decimal: o?.odds_home_decimal ?? null,
      odds_away_decimal: o?.odds_away_decimal ?? null,
      model_name: model,
    };
  });

  return new Response(JSON.stringify(merged), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
