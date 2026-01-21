import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

import Script from "next/script";
import { Suspense } from "react";
import GAListener from "@/components/ga/GAListener";
import { GA_ID } from "@/lib/gtag";

import ScheduleTicker from "@/components/ScheduleTicker";

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

const NAV = [
  { href: "/", label: "Home"},
  { href: "/dashboard", label: "Dashboard" },
  { href: "/teams", label: "NBA Teams" },
  { href: "/dreamteam", label: "Dream Team" },
  { href: "/guess", label: "Guesser" },
  { href: "/analytics", label: "Analytics" },
  { href: "/FunnelRetention", label: "Funnel" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {GA_ID ? (
            <>
              <Script
                strategy="afterInteractive"
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              />
              <Script strategy="afterInteractive" id="ga-init">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  window.gtag = gtag;
                  gtag('js', new Date());
                  gtag('config', '${GA_ID}', { send_page_view: false });
                `}
              </Script>
              <Suspense fallback={null}>
                <GAListener />
              </Suspense>
            </>
          ) : null}

          <input id="mobile-nav" type="checkbox" className="peer sr-only" />

          <div className="min-h-screen w-full app-gradient">
            <div className="flex min-h-screen w-full">
              <aside className="hidden lg:flex w-64 flex-col border-r bg-background">
                <div className="h-16 flex items-center gap-3 px-4 border-b">
                  <Image
                    src="/slike_test/qnba_logo.png"
                    alt="QNBA"
                    width={32}
                    height={32}
                    priority
                    className="h-8 w-8 object-contain"
                  />
                  <div className="leading-tight">
                    <div className="font-bold tracking-tight">QNBA</div>
                    <div className="text-xs text-foreground/60">
                      Stats & Analytics
                    </div>
                  </div>
                </div>

                <nav className="flex-1 p-3">
                  <div className="text-xs text-foreground/60 px-2 mb-2">MENU</div>
                  <div className="flex flex-col gap-1">
                    {NAV.map((item) => (
                      <SideNavLink key={item.href} href={item.href}>
                        {item.label}
                      </SideNavLink>
                    ))}
                  </div>
                </nav>

                <div className="border-t p-3 flex items-center justify-between">
                  <span className="text-xs text-foreground/60">Theme</span>
                  <ThemeSwitcher />
                </div>
              </aside>

              <div className="flex-1 min-w-0 flex flex-col">
                <header className="sticky top-0 z-50 h-16 border-b bg-background/80 backdrop-blur">
                  <div className="h-full flex items-center justify-between px-4 gap-3">
                    {/* LEFT: hamburger + logo */}
                    <div className="flex items-center gap-3 shrink-0">
                      <label
                        htmlFor="mobile-nav"
                        className="lg:hidden cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-foreground/5 transition"
                        aria-label="Open menu"
                      >
                        ☰
                      </label>

                      <Link href="/" className="flex items-center gap-2">
                        <Image
                          src="/slike_test/qnba_logo.png"
                          alt="QNBA"
                          width={28}
                          height={28}
                          priority
                          className="h-7 w-7 object-contain"
                        />
                        <span className="font-bold">QNBA</span>
                      </Link>
                    </div>

                    {/* MIDDLE: schedule ticker (takes remaining space) */}
                    <div className="hidden md:flex flex-1 min-w-0 justify-center">
                      <div className="w-full max-w-[1200px] min-w-0">
                        <ScheduleTicker variant="header" />
                      </div>
                    </div>

                    {/* RIGHT: actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:block">
                        <ThemeSwitcher />
                      </div>
                      {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                    </div>
                  </div>
                </header>

                {/* on mobile we still want it visible, but not taking big space:
                    show it right under header, compact */}
                <div className="md:hidden border-b border-white/10 bg-background/40 backdrop-blur">
                  <div className="px-4 py-2">
                    <ScheduleTicker variant="header" />
                  </div>
                </div>

                <main className="flex-1 min-w-0">
                  <div className="mx-auto w-full max-w-7xl px-4 py-6">
                    {children}
                  </div>
                </main>
              </div>
            </div>
          </div>

          <label
            htmlFor="mobile-nav"
            className="
              lg:hidden fixed inset-0 z-[999] bg-black/40
              opacity-0 pointer-events-none
              peer-checked:opacity-100 peer-checked:pointer-events-auto
              transition
            "
            aria-label="Close menu backdrop"
          />

          <div
            className="
              lg:hidden fixed left-0 top-0 z-[1000] h-full w-80 max-w-[85vw]
              bg-background border-r shadow-xl
              -translate-x-full peer-checked:translate-x-0
              transition-transform duration-200
            "
          >
            <div className="h-16 flex items-center justify-between px-4 border-b">
              <div className="flex items-center gap-2">
                <Image
                  src="/slike_test/qnba_logo.png"
                  alt="QNBA"
                  width={28}
                  height={28}
                  priority
                  className="h-7 w-7 object-contain"
                />
                <div className="leading-tight">
                  <div className="font-bold">QNBA</div>
                  <div className="text-xs text-foreground/60">
                    Stats & Analytics
                  </div>
                </div>
              </div>

              <label
                htmlFor="mobile-nav"
                className="cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-foreground/5 transition"
                aria-label="Close menu"
              >
                ✕
              </label>
            </div>

            <nav className="p-3">
              <div className="text-xs text-foreground/60 px-2 mb-2">MENU</div>

              <div className="flex flex-col gap-1">
                {NAV.map((item) => (
                  <label
                    key={item.href}
                    htmlFor="mobile-nav"
                    className="cursor-pointer"
                  >
                    <Link
                      href={item.href}
                      className="
                        block rounded-xl px-3 py-2 text-sm font-semibold
                        text-foreground/80 hover:bg-foreground/5
                        transition
                      "
                    >
                      {item.label}
                    </Link>
                  </label>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border p-3 flex items-center justify-between">
                <span className="text-xs text-foreground/60">Theme</span>
                <ThemeSwitcher />
              </div>
            </nav>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

function SideNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="
        rounded-xl px-3 py-2 text-sm font-semibold
        text-foreground/80 hover:bg-foreground/5
        transition
      "
    >
      {children}
    </Link>
  );
}
