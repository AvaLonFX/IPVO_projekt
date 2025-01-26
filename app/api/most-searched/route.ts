import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 600;

export async function GET() {
    try {
        const { data, error } = await supabase
            .from("searchstats")
            .select("player_id, search_count, FullStats_NBA(PLAYER_NAME)")
            .order("search_count", { ascending: false })
            .limit(5);

        if (error) throw error;

        return NextResponse.json(data, {
            headers: {
                "Cache-Control": "s-maxage=600, stale-while-revalidate=300",
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
