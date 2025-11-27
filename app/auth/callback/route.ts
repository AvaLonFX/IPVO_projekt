// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = url.searchParams.get("redirect_to") || "/";

  // Response na koji ćemo ZAPISATI cookie
  const response = NextResponse.redirect(new URL(redirectTo, url.origin));

  if (!code) {
    return response;
  }

  // Supabase client koji:
  // - cookie čita iz requesta
  // - cookie ZAPISUJE u response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const raw = request.headers.get("cookie") ?? "";
          const cookies = raw.split("; ").map((c) => c.split("="));
          const cookie = cookies.find(([n]) => n === name);
          return cookie?.[1];
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
    // možeš i redirectati natrag na /sign-in?error=...
  }

  return response;
}
