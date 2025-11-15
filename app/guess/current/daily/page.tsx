import GuessGame from "@/components/GuessGame";

export default function CurrentDailyPage() {
  return (
    <GuessGame
      apiPath="/api/guess/current-daily"
      title="Current Daily"
      subtitle="Jedan aktualni igrač dnevno. Svi isti."
    />
  );
}
