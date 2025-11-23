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
    <div className="flex-1 flex flex-col min-w-64 max-w-sm mx-auto">
      <h1 className="text-2xl font-medium">Sign in</h1>
      <p className="text-sm text-foreground">
        Don&apos;t have an account?{" "}
        <Link className="text-foreground font-medium underline" href="/sign-up">
          Sign up
        </Link>
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {/* FORM 1: samo Google login */}
        <form action={signInWithGoogleAction as any} className="w-full">
          <SubmitButton
            pendingText="Redirecting..."
            formAction={signInWithGoogleAction as any}
            className="w-full flex items-center justify-center gap-3 py-2 border border-gray-300 rounded-md bg-white font-medium hover:bg-gray-50 transition"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="h-5 w-5"
            />
            <span className="text-gray-700">Continue with Google</span>
          </SubmitButton>
        </form>

        {/* separator */}
        <div className="flex items-center my-2">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="px-3 text-xs text-gray-500">or</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        {/* FORM 2: email + password login */}
        <form className="flex flex-col gap-2">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <Label htmlFor="email">Email</Label>
          <Input name="email" placeholder="you@example.com" required />

          <div className="flex justify-between items-center">
            <Label htmlFor="password">Password</Label>
            <Link
              className="text-xs text-foreground underline"
              href="/forgot-password"
            >
              Forgot Password?
            </Link>
          </div>

          <Input
            type="password"
            name="password"
            placeholder="Your password"
            required
          />

          <SubmitButton
            pendingText="Signing In..."
            formAction={signInAction as any}
          >
            Sign in
          </SubmitButton>
        </form>

        <FormMessage message={searchParams} />
      </div>
    </div>
  );
}
