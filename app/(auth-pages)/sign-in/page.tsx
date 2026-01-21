import { signInAction, signInWithGoogleAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Login(props: {
  searchParams: Promise<Message & { redirect?: string }>;
}) {
  const searchParams = await props.searchParams;
  const redirectTo = (searchParams?.redirect as string | undefined) ?? "/";

  return (
    <div className="flex flex-col">
      <h1 className="text-2xl sm:text-3xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link className="text-foreground font-semibold underline" href="/sign-up">
          Sign up
        </Link>
      </p>

      <div className="mt-7 flex flex-col gap-4">
        {/* Google */}
        <form action={signInWithGoogleAction as any} className="w-full">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <SubmitButton
            pendingText="Redirecting..."
            formAction={signInWithGoogleAction as any}
            className="w-full h-11 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition flex items-center justify-center gap-3"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="h-5 w-5"
            />
            <span className="font-semibold">Continue with Google</span>
          </SubmitButton>
        </form>

        {/* separator */}
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Email + password */}
        <form className="flex flex-col gap-3">
          <input type="hidden" name="redirectTo" value={redirectTo} />

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

          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              className="text-xs text-muted-foreground hover:text-foreground underline"
              href="/forgot-password"
            >
              Forgot Password?
            </Link>
          </div>

          <Input
            id="password"
            type="password"
            name="password"
            placeholder="Your password"
            required
            className="h-11 rounded-xl"
            autoComplete="current-password"
          />

          <SubmitButton
            pendingText="Signing In..."
            formAction={signInAction as any}
            className="h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition font-semibold"
          >
            Sign in
          </SubmitButton>
        </form>

        <FormMessage message={searchParams} />
      </div>
    </div>
  );
}
