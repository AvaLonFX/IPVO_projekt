import GuessGame from "@/components/GuessGame";

export default function AllTimePracticePage() {
  return (
    <GuessGame
      apiPath="/api/guess/alltime-practice"
      title="All-Time Practice"
      subtitle="Random all-time player (career PTS / REB / AST)."
    />
  );
}
