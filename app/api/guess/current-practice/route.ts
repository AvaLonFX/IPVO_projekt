import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // prilagodi putanju ako je drugačija

async function fetchCurrentPlayers() {
  const { data, error } = await supabase
    .from("CurrentStats_NBA")
    .select(
      `
      PLAYER_ID,
      PLAYER_NAME,
      TEAM_ABBREVIATION,
      PTS,
      REB,
      AST
    `
    )
    .gt("PTS", 5) // malo filtriranje da ne dobijemo baš fringe igrače
    .limit(400);

  if (error || !data || data.length === 0) {
    console.error(error);
    throw new Error("Ne mogu dohvatiti igrače iz CurrentStats_NBA.");
  }
  return data;
}

async function fetchOsnovnoInfo(playerId: number) {
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
      DRAFT_YEAR
    `
    )
    .eq("PERSON_ID", playerId)
    .maybeSingle();

  if (error) {
    console.error("Greška pri dohvaćanju Osnovno_NBA:", error);
  }

  return data;
}

export async function GET() {
  try {
    const current = await fetchCurrentPlayers();
    const randomIndex = Math.floor(Math.random() * current.length);
    const c = current[randomIndex];

    // dodatni podaci iz Osnovno_NBA
    const basic = await fetchOsnovnoInfo(c.PLAYER_ID);

    const astNum = Number(c.AST ?? 0);

    return NextResponse.json({
      player: {
        id: c.PLAYER_ID,
        name: basic?.player_full_name ?? c.PLAYER_NAME,
        team: basic?.TEAM_NAME ?? c.TEAM_ABBREVIATION,
        position: basic?.POSITION ?? null,
        country: basic?.COUNTRY ?? null,
        height: basic?.HEIGHT ?? null,
        draftYear: basic?.DRAFT_YEAR ?? null,
      },
      stats: {
        pts: c.PTS,
        reb: c.REB,
        ast: astNum,
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
