// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = url.searchParams.get("redirect_to") || "/";

  // Odmah pripremimo response na koji ćemo ZAPISATI cookie
  const response = NextResponse.redirect(new URL(redirectTo, url.origin));

  if (!code) {
    return response;
  }

  // Supabase client koji koristi REQUEST za čitanje cookieja
  // i RESPONSE za zapisivanje cookieja (ključna razlika!)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.headers
            .get("cookie")
            ?.split("; ")
            .find((c) => c.startsWith(`${name}=`));
          return cookie?.split("=")[1];
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("exchangeCodeForSession error:", error.message);
    // Ako želiš, možeš ovdje redirectat na /sign-in?error=...
  }

  // Vraćamo response koji sada u sebi ima postavljen Supabase session cookie
  return response;
}
