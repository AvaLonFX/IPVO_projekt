import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
const weights: Record<string,number> = { search_click: 2, view_player: 1, compare_click: 3 };
export async function POST(req: Request) {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const input = await req.json();
    const id = Number(input.itemId);
    if ((input.itemType && input.itemType !== "player") || !Number.isSafeInteger(id) || id <= 0 || !Object.hasOwn(weights,input.eventType))
      return NextResponse.json({ error: "Invalid interaction" }, { status: 400 });
    const { error } = await db.from("user_interactions").insert({
      user_id: user.id, item_type: "player", item_id: String(id), event_type: input.eventType, weight: weights[input.eventType]
    });
    if (error) return NextResponse.json({ error: "Could not record interaction" }, { status: error.code === "42501" ? 400 : 503 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Invalid or unavailable request" }, { status: error instanceof SyntaxError ? 400 : 503 });
  }
}
