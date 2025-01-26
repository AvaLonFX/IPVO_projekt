import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
    try {
        // Pozivamo postojeću RPC funkciju koja vraća player_id i broj dodavanja
        const { data, error } = await supabase
            .rpc("get_most_added_players") // Ovo je SQL funkcija koju već koristiš
            .limit(5);

        if (error) throw error;

        // Ako nema podataka, vraćamo prazan niz
        if (!data || data.length === 0) {
            return NextResponse.json([]);
        }

        // Dohvati podatke o igračima iz FullStats_NBA na osnovu player_id
        const playerIds = data.map((p: any) => p.player_id);
        const { data: players, error: playersError } = await supabase
            .from("FullStats_NBA")
            .select("PERSON_ID, PLAYER_NAME") // Biramo samo potrebne podatke
            .in("PERSON_ID", playerIds);

        if (playersError) throw playersError;

        // Mapiranje rezultata kako bi se osiguralo da je ime dostupno
        const finalData = data.map((p: any) => ({
            ...p,
            player_name: players.find((player: any) => player.PERSON_ID === p.player_id)?.PLAYER_NAME || "Unknown Player",
        }));

        return NextResponse.json(finalData);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
