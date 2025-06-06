import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("GameSchedule")
    .select("*")
    .gt("startTime", new Date().toISOString()) // just for filtering future games
    .order("startTime", { ascending: true })
    .limit(25);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
