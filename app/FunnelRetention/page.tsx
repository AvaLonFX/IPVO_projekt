import FunnelPanel from "@/components/analytics/FunnelPanel";
import RetentionPanel from "@/components/analytics/RetentionPanel";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function FunnelRetentionPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/FunnelRetention");
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-foreground/70">
          Funnel + retention (dark-mode friendly).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <FunnelPanel />
        <RetentionPanel />
      </div>
    </div>
  );
}
