"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // Adjust the import based on your setup
import { useRouter } from "next/navigation";

export default function DreamTeam() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push("/sign-in"); // Redirect to your sign-in page
        } else {
          setUser(session.user); // Store user info if needed
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        router.push("/sign-in");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return <p>Loading...</p>; // Show a loader while checking authentication
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
