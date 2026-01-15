import DeployButton from "@/components/deploy-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import DreamtButton from "@/components/dreamt-button";
import TeamsButton from "@/components/teams-button";
import GuessButton from "@/components/guess-button";

import Script from "next/script";
import { Suspense } from "react";
import GAListener from "@/components/ga/GAListener";
import { GA_ID } from "@/lib/gtag";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "QNBA",
  description: "The fastest way to build apps with Next.js and Supabase",
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Google Analytics (GA4) */}
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

              {/* useSearchParams() mora biti unutar Suspense u App Routeru */}
              <Suspense fallback={null}>
                <GAListener />
              </Suspense>
            </>
          ) : null}

          <main className="min-h-screen flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-20 items-center">
              {/* NAVBAR */}
              <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="w-full max-w-8xl flex justify-between items-center p-3 px-5 text-sm">
                  <div className="flex gap-5 items-center font-semibold">
                    {/* LOGO */}
                    <Link href={"/"}>
                      <Image
                        src="/slike_test/qnba_logo.png"
                        alt="QNBA Logo"
                        width={100}
                        height={100}
                        priority
                      />
                    </Link>

                    {/* BUTTONI */}
                    <div className="flex items-center gap-2">
                      <TeamsButton />
                      <DreamtButton />
                      <GuessButton />
                    </div>
                  </div>

                  {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                </div>
              </nav>

              {/* CONTENT */}
              <div className="flex flex-col gap-20 p-5 w-full max-w-5xl">
                {children}
              </div>

              {/* FOOTER */}
              <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
                <p>
                  Powered by{" "}
                  <a
                    href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
                    target="_blank"
                    className="font-bold hover:underline"
                    rel="noreferrer"
                  >
                    Supabase
                  </a>
                </p>
                <ThemeSwitcher />
              </footer>
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
