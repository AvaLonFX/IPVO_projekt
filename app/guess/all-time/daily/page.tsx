import GuessGame from "@/components/GuessGame";

export default function AllTimeDailyPage() {
  return (
    <GuessGame
      apiPath="/api/guess/alltime-daily"
      title="All-Time Daily"
      subtitle="One all-time player each day. Everyone gets the same challenge."
    />
  );
}
