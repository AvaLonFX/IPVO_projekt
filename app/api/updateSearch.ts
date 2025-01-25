import { createClient } from "@/utils/supabase/client";
import { supabase } from "../../lib/supabase"; // Putanja do tvog Supabase klijenta

export const updateSearchCount = async (playerId: number) => {
    console.log(`Updating search count for player: ${playerId}`); // Debug info

    const { data, error } = await supabase.rpc("increment_search_count", { player_id_param: playerId});
  
    if (error) {
        console.error("Error updating search count:", error);
      } else {
        console.log(`Success:`, data);
      }
  };