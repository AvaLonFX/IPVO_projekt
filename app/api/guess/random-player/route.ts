// app/api/guess/random-player/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  // Uzimamo igrače direktno iz Osnovno_NBA
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
      PTS,
      REB,
      AST,
      DRAFT_YEAR
    `
    )
    .gt("PTS", 5)         // malo filtriramo da ne dobijemo skroz random role playere
    .limit(200);          // uzmemo prvih 200 pa biramo random među njima

  if (error || !data || data.length === 0) {
    console.error("Error fetching Osnovno_NBA:", error);
    return NextResponse.json(
      { error: "Ne mogu dohvatiti igrače iz Osnovno_NBA." },
      { status: 500 }
    );
  }

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
      draft_year: p.DRAFT_YEAR,
    },
    stats: {
      pts: p.PTS,
      reb: p.REB,
      ast: p.AST,
    },
  });
}
