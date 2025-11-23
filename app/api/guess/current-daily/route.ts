import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // prilagodi po potrebi

function getDailyIndex(length: number, seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  if (hash < 0) hash = -hash;
  return hash % length;
}

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
    .gt("PTS", 5)
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
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const index = getDailyIndex(current.length, "current-" + today);
    const c = current[index];

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
//TEST