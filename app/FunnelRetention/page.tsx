import FunnelPanel from "@/components/analytics/FunnelPanel";
import RetentionPanel from "@/components/analytics/RetentionPanel";

export default function AnalyticsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-semibold text-slate-900">Analytics</h1>

      <FunnelPanel />
      <RetentionPanel />
    </div>
  );
}
