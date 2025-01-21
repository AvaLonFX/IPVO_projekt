"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client"; 

export default function DreamTeam() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient(); // ✅ Ispravan Supabase klijent

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        console.log("Session data:", data);

        if (error) {
          console.error("Error fetching session:", error);
          router.push("/sign-in");
          return;
        }

        if (!data?.session) {
          console.warn("No active session. Redirecting...");
          router.push("/sign-in");
          return;
        }

        console.log("User authenticated:", data.session.user);
        setUser(data.session.user);
      } catch (error) {
        console.error("Unexpected error:", error);
        router.push("/sign-in");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Create Your Dream Team</h1>
      <p>Welcome, {user?.email}!</p>

      {/* Add your logic for creating the dream team */}
      <div className="mt-4">
        <p>Start building your team by selecting players!</p>
        {/* Placeholder for team-building UI */}
      </div>
    </div>
  );
}
