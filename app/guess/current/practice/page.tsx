import GuessGame from "@/components/GuessGame";

export default function CurrentPracticePage() {
  return (
    <GuessGame
      apiPath="/api/guess/current-practice"
      title="Current Practice"
      subtitle="NBA players and stats from the latest verified season dataset."
    />
  );
}
