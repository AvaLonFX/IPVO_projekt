import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_interactions")
    .select("user_id, created_at");

  if (error || !data) {
    return NextResponse.json({ error: "Query error" }, { status: 500 });
  }

  // grupiraj po korisniku
  const byUser = new Map<string, Date[]>();

  for (const row of data) {
    const d = new Date(row.created_at);
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id)!.push(d);
  }

  let newUsers = 0;
  let retainedDay1 = 0;

  for (const [_, dates] of Array.from(byUser.entries())) {
    dates.sort((a, b) => a.getTime() - b.getTime());

    const firstDay = dates[0].toDateString();
    newUsers++;

    const returnedNextDay = dates.some(
      (d) =>
        d.toDateString() !== firstDay &&
        (new Date(d).getTime() - dates[0].getTime()) <=
          1000 * 60 * 60 * 24 * 2
    );

    if (returnedNextDay) retainedDay1++;
  }

  return NextResponse.json({
    newUsers,
    retainedDay1,
    day1Retention:
      newUsers > 0
        ? Number(((retainedDay1 / newUsers) * 100).toFixed(2))
        : 0,
  });
}
