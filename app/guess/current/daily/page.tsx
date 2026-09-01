import GuessGame from "@/components/GuessGame";

export default function CurrentDailyPage() {
  return (
    <GuessGame
      apiPath="/api/guess/current-daily"
      title="Current Daily"
      subtitle="One current player each day. Everyone gets the same challenge."
    />
  );
}
