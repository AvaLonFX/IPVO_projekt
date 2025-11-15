import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

async function fetchAllTimePlayers() {
  const { data, error } = await supabase
    .from("Osnovno_NBA")
    .select(
      `
      PERSON_ID,
      player_full_name,
      TEAM_NAME,
      POSITION,
      COUNTRY,
      HEIGHT,
      DRAFT_YEAR,
      PTS,
      REB,
      AST
    `
    )
    .gt("PTS", 5)
    .limit(400);

  if (error || !data || data.length === 0) {
    throw new Error("Ne mogu dohvatiti igrače iz Osnovno_NBA.");
  }
  return data;
}

export async function GET() {
  try {
    const data = await fetchAllTimePlayers();
    const randomIndex = Math.floor(Math.random() * data.length);
    const p = data[randomIndex];

    return NextResponse.json({
      player: {
        id: p.PERSON_ID,
        name: p.player_full_name,
        team: p.TEAM_NAME,
        position: p.POSITION,
        country: p.COUNTRY,
        height: p.HEIGHT,
        draftYear: p.DRAFT_YEAR ?? null,
      },
      stats: {
        pts: p.PTS,
        reb: p.REB,
        ast: p.AST,
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
