import redis from '../../../lib/redis'; // Import the updated Redis client from lib

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
  console.log("Returning cached data from Redis:", cachedData);  // Log the cached data
  return NextResponse.json(JSON.parse(cachedData));
} else {
  console.log("Cache miss: Fetching data from Supabase...");
}

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
    await redis.set(`player:${playerId}`, JSON.stringify(playerResponse), 'EX', 3600); // Cache for 1 hour

    return NextResponse.json(playerResponse);

  } catch (err) {
    console.error("Error fetching player data:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
