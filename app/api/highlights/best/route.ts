import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const dayParam = searchParams.get("day"); // optional: YYYY-MM-DD
  const day = dayParam ?? todayISO();

  // 1) pokušaj naći današnji daily video
  let daily:
    | { id: number; day: string; youtube_video_id: string; title: string | null }
    | null = null;

  const { data: dailyToday } = await supabase
    .from("yt_daily_videos")
    .select("id, day, youtube_video_id, title")
    .eq("day", day)
    .maybeSingle();

  if (dailyToday) {
    daily = dailyToday as any;
  } else {
    // fallback: uzmi zadnji dostupni dan u bazi
    const { data: latest } = await supabase
      .from("yt_daily_videos")
      .select("id, day, youtube_video_id, title")
      .order("day", { ascending: false })
      .limit(1);

    daily = (latest?.[0] as any) ?? null;
  }

  if (!daily) {
    return NextResponse.json({ daily: null, best: null }, { status: 200 });
  }

  // 2) dohvat svih clipova za taj dan + pripadne highlight zapise
  const { data: clips } = await supabase
    .from("yt_video_clips")
    .select(
      `
      id, rank, start_sec, end_sec,
      player_highlights ( id, person_id, event, score, event_conf, player_conf )
    `
    )
    .eq("daily_video_id", daily.id);

  const flattened =
    (clips ?? [])
      .map((c: any) => {
        const h = c.player_highlights?.[0];
        if (!h) return null;
        return {
          clip_id: c.id,
          rank: c.rank,
          start_sec: c.start_sec,
          end_sec: c.end_sec,
          youtube_video_id: daily.youtube_video_id,
          daily_title: daily.title,
          day: daily.day,
          ...h,
        };
      })
      .filter(Boolean) ?? [];

  if (flattened.length === 0) {
    return NextResponse.json({ daily, best: null }, { status: 200 });
  }

  flattened.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
  const best = flattened[0] as any;

  // 3) player info iz Osnovno_NBA (ako postoji person_id)
  let player: any = null;
  if (best.person_id) {
    const { data: p } = await supabase
      .from("Osnovno_NBA")
      .select("PERSON_ID, player_full_name, TEAM_ABBREVIATION, TEAM_NAME")
      .eq("PERSON_ID", best.person_id)
      .limit(1)
      .maybeSingle();
    player = p ?? null;
  }

  return NextResponse.json(
    {
      daily,
      best: { ...best, player },
    },
    { status: 200 }
  );
}
