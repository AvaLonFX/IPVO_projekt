import { createBrowserClient } from "@supabase/ssr";

export const createClient = () => {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,  // ✅ Osigurava da sesija ostane nakon refresh-a
        autoRefreshToken: true, // ✅ Osvježava token kad istekne
        detectSessionInUrl: true, // ✅ Potrebno za OAuth prijave
      },
    }
  );

  // 📌 Ručno dohvaćanje sesije kod inicijalizacije
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      console.log("Session initialized:", data.session);
    } else {
      console.log("No active session found.");
    }
  });

  return supabase;
};
