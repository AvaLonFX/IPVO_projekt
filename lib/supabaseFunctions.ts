import { supabase } from "@/lib/supabase";

// Funkcija za dodavanje igrača u Dream Team
export const addToDreamTeam = async (userId: string, playerId: number) => {
  const { data, error } = await supabase
    .from("UserDreamTeams")
    .insert([{ user_id: userId, player_id: playerId }]);

  if (error) {
    console.error("Error adding player:", error);
    return false;
  }

  return true;
};

// Funkcija za uklanjanje igrača iz Dream Team-a
export const removeFromDreamTeam = async (userId: string, playerId: number) => {
  const { data, error } = await supabase
    .from("UserDreamTeams")
    .delete()
    .eq("user_id", userId)
    .eq("player_id", playerId);

  if (error) {
    console.error("Error removing player:", error);
    return false;
  }

  return true;
};

// Funkcija za dohvaćanje korisnikovog Dream Team-a
export const fetchDreamTeam = async (userId: string) => {
  const { data, error } = await supabase
    .from("UserDreamTeams")
    .select("player_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching dream team:", error);
    return [];
  }

  return data.map((entry) => entry.player_id);
};
