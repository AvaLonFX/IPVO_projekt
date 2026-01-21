import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";

export default async function Signup(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;

  if ("message" in searchParams) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage message={searchParams} />
        <SmtpMessage />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <h1 className="text-2xl sm:text-3xl font-semibold">Sign up</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="text-foreground font-semibold underline" href="/sign-in">
          Sign in
        </Link>
      </p>

      <form className="mt-7 flex flex-col gap-3">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            placeholder="Choose a username"
            required
            className="h-11 rounded-xl"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            placeholder="you@example.com"
            required
            className="h-11 rounded-xl"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            name="password"
            placeholder="Your password"
            minLength={6}
            required
            className="h-11 rounded-xl"
            autoComplete="new-password"
          />
        </div>

        <SubmitButton
          formAction={signUpAction}
          pendingText="Signing up..."
          className="mt-2 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition font-semibold"
        >
          Sign up
        </SubmitButton>

        <FormMessage message={searchParams} />
      </form>

      <div className="mt-6">
        <SmtpMessage />
      </div>
    </div>
  );
}
