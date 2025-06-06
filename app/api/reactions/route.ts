// app/api/reactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const { player_id, user_id, reaction } = await req.json();

    const client = await clientPromise;
    const db = client.db("qnba");
    const collection = db.collection("reactions");

    await collection.insertOne({
      player_id,
      user_id,
      reaction,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to submit reaction" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const player_id = req.nextUrl.searchParams.get("player_id");

  if (!player_id) {
    return NextResponse.json({ error: "Missing player_id" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db("qnba");

  const reactions = await db
    .collection("reactions")
    .aggregate([
      { $match: { player_id: parseInt(player_id) } }, // 👈 force numeric match
      { $group: { _id: "$reaction", count: { $sum: 1 } } },
    ])
    .toArray();

  return NextResponse.json(reactions);
}

