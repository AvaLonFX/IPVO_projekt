import Link from "next/link";
import Image from "next/image";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_30%_10%,rgba(249,115,22,0.15),transparent_55%),radial-gradient(900px_500px_at_80%_20%,rgba(59,130,246,0.12),transparent_60%)]" />
      </div>

      {/* Minimal auth header (no sidebar/topbar) */}
      <header className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/slike_test/qnba_logo.png"
            alt="QNBA Logo"
            width={28}
            height={28}
            priority
          />
          <span className="font-semibold tracking-tight">QNBA</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <Link
            href="/sign-in"
            className="px-3 py-2 rounded-xl border border-border bg-card/40 hover:bg-accent transition text-sm font-semibold"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition text-sm font-semibold"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* Centered content, leaves space for header */}
      <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6 pt-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
