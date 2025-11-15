import GuessGame from "@/components/GuessGame";

export default function AllTimeDailyPage() {
  return (
    <GuessGame
      apiPath="/api/guess/alltime-daily"
      title="All-Time Daily"
      subtitle="Jedan all-time igrač dnevno. Svi dobivaju istog."
    />
  );
}
