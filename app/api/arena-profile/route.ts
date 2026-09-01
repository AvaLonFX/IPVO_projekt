import { NextRequest, NextResponse } from "next/server";
import { admin, identity } from "@/lib/guesser-server";

const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

async function profileStats(ownerKey: string) {
  const { data, error } = await admin().from("match_results").select("payload,created_at").eq("owner_key", ownerKey).eq("source", "challenge").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  let wins = 0, losses = 0, games = 0, pointsFor = 0, pointsAgainst = 0;
  for (const row of data || []) {
    const series = row.payload?.series;
    if (!series?.games?.length) continue;
    const side = row.payload?.viewerSide === 1 ? 1 : 0;
    games += series.games.length;
    for (const game of series.games) { pointsFor += game.score[side]; pointsAgainst += game.score[1 - side]; }
    if (series.winner === side) wins++; else losses++;
  }
  return { wins, losses, seriesPlayed: wins + losses, games, pointsFor, pointsAgainst, winRate: wins + losses ? Math.round(1000 * wins / (wins + losses)) / 10 : 0 };
}

export async function GET(req: NextRequest) {
  try {
    const requested = req.nextUrl.searchParams.get("slug");
    let ownerKey: string;
    let query = admin().from("match_profiles").select("owner_key,public_slug,display_name,is_public");
    if (requested) query = query.eq("public_slug", requested).eq("is_public", true);
    else { const identityData = await identity(); ownerKey = identityData.owner; query = query.eq("owner_key", ownerKey); }
    let { data: profile, error } = await query.maybeSingle();
    if (error) throw error;
    if (!profile && !requested) {
      const current = await identity(); ownerKey = current.owner;
      const inserted = await admin().from("match_profiles").insert({ owner_key: ownerKey }).select("owner_key,public_slug,display_name,is_public").single();
      if (inserted.error) throw inserted.error; profile = inserted.data;
    }
    if (!profile) return json({ error: "Arena profile not found." }, 404);
    return json({ slug: profile.public_slug, displayName: profile.display_name, isPublic: profile.is_public, stats: await profileStats(profile.owner_key), own: !requested });
  } catch (error) { console.error("Arena profile load failed", error); return json({ error: "Unable to load arena profile." }, 503); }
}

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && req.headers.get("origin") !== req.nextUrl.origin) return json({ error: "Invalid request origin." }, 403);
  try {
    const body = JSON.parse(await req.text());
    const displayName = String(body.displayName || "").trim().slice(0, 32);
    if (displayName.length < 2) return json({ error: "Display name must have at least two characters." }, 400);
    const { owner } = await identity();
    const { data, error } = await admin().from("match_profiles").upsert({ owner_key: owner, display_name: displayName, is_public: body.isPublic !== false, updated_at: new Date().toISOString() }, { onConflict: "owner_key" }).select("public_slug,display_name,is_public").single();
    if (error) throw error;
    return json({ slug: data.public_slug, displayName: data.display_name, isPublic: data.is_public });
  } catch (error) { console.error("Arena profile update failed", error); return json({ error: "Unable to save arena profile." }, 503); }
}

