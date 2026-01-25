import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("retention_summary", { days_back: 30 });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  const newUsers = Number(row?.new_users ?? 0);
  const day1 = Number(row?.day1_users ?? 0);
  const day7 = Number(row?.day7_users ?? 0);

  return NextResponse.json({
    newUsers,
    day1,
    day7,
    day1Rate: newUsers > 0 ? Number(((day1 / newUsers) * 100).toFixed(2)) : 0,
    day7Rate: newUsers > 0 ? Number(((day7 / newUsers) * 100).toFixed(2)) : 0,
  });
}
