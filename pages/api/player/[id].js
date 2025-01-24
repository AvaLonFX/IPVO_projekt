import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { Redis } from '@upstash/redis';

// Hard-code the Redis client configuration
const redis = new Redis({
  url: 'https://generous-jawfish-45569.upstash.io', // Your Upstash Redis URL
  token: 'AbIBAAIjcDFkYjM2NDgyZDlkNzE0YzIyOGJkMGE5MGY5YzM5YzUxMXAxMA', // Your Upstash Redis Token
});

export async function GET(req) {
  try {
    // Extract player ID from URL
    const playerId = req.url.split("/").pop();
    if (!playerId) {
      return NextResponse.json({ error: "Player ID is required" }, { status: 400 });
    }

    // Check if data is cached in Redis
    const cachedData = await redis.get(`player:${playerId}`);

    if (cachedData) {
      console.log("Returning cached data from Redis");
      return NextResponse.json(JSON.parse(cachedData));
    }

    console.log("Fetching data from Supabase...");
    const { data: playerData, error: playerError } = await supabase
      .from("Osnovno_NBA")
      .select("*")
      .eq("PERSON_ID", playerId)
      .single();

    if (playerError || !playerData) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const { data: statsData, error: statsError } = await supabase
      .from("FullStats_NBA")
      .select("*")
      .eq("PERSON_ID", playerId)
      .single();

    if (statsError || !statsData) {
      return NextResponse.json({ error: "Player stats not found" }, { status: 404 });
    }

    const playerResponse = {
      player: playerData,
      stats: statsData,
    };

    console.log("Caching data in Redis for 1 hour...");
    await redis.set(`player:${playerId}`, JSON.stringify(playerResponse), { ex: 3600 });

    return NextResponse.json(playerResponse);

  } catch (err) {
    console.error("Error fetching player data:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
