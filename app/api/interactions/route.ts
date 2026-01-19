import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    itemType = "player",
    itemId,
    eventType,
    weight = 1,
  } = await req.json();

  if (!itemId || !eventType) {
    return NextResponse.json({ error: "Missing itemId/eventType" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("user_interactions").insert({
    user_id: user.id,
    item_type: itemType,
    item_id: String(itemId),
    event_type: eventType,
    weight,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
