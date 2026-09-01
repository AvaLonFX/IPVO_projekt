import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
    const { data, error } = await db.rpc("funnel_summary").single();
    if (error) throw error;
    const { searched, viewed, compared } = data as { searched: number; viewed: number; compared: number };
    const rate = (a: number, b: number) => b ? Number((a / b * 100).toFixed(2)) : 0;
    return NextResponse.json({
      funnel: [{ step: "Search player", users: searched }, { step: "View player profile", users: viewed }, { step: "Click Compare", users: compared }],
      conversionRate: { viewFromSearch: rate(viewed,searched), compareFromView: rate(compared,viewed), compareFromSearch: rate(compared,searched) }
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Analytics temporarily unavailable" }, { status: 503, headers });
  }
}
