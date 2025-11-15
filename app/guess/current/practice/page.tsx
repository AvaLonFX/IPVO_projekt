import GuessGame from "@/components/GuessGame";

export default function CurrentPracticePage() {
  return (
    <GuessGame
      apiPath="/api/guess/current-practice"
      title="Current Practice"
      subtitle="Aktivni NBA igrači – statistika ove sezone."
    />
  );
}
