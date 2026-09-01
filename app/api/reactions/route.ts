import { NextRequest, NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { createClient } from "@/utils/supabase/server";
const reactions = ["🔥", "🐐", "🗑️"];
export async function POST(req: NextRequest) {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const input = await req.json();
    const id = Number(input?.player_id);
    if (!Number.isSafeInteger(id) || id <= 0 || !reactions.includes(input?.reaction))
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    const { data: player } = await db.from("Osnovno_NBA").select("PERSON_ID").eq("PERSON_ID",id).maybeSingle();
    if (!player) return NextResponse.json({ error: "Unknown player" }, { status: 400 });
    const client = await getMongoClient();
    await client.db("qnba").collection("reactions").updateOne(
      { player_id: id, user_id: user.id },
      { $set: { reaction: input.reaction, timestamp: new Date().toISOString() } }, { upsert: true }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Reactions temporarily unavailable" }, { status: error instanceof SyntaxError ? 400 : 503 });
  }
}
export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("player_id"));
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid player" }, { status: 400 });
  try {
    const client = await getMongoClient();
    const data = await client.db("qnba").collection("reactions").aggregate([
      { $match: { player_id: id } }, { $group: { _id: "$reaction", count: { $sum: 1 } } }
    ]).toArray();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Reactions temporarily unavailable" }, { status: 503 });
  }
}

