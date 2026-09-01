import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { DREAM_TEAM_SELECT } from "@/lib/dream-team";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
    const { data, error } = await supabase.from("UserDreamTeams").select(DREAM_TEAM_SELECT)
      .eq("user_id", user.id).order("position");
    if (error) throw error;
    return NextResponse.json(data ?? [], { headers });
  } catch {
    return NextResponse.json({ error: "Could not load your Dream Team." }, { status: 503, headers });
  }
}
