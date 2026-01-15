import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // FIX za Vercel/Supabase OAuth: ponekad vrati na "/" s ?code=...
  // Preusmjeri na /auth/callback da se odradi exchangeCodeForSession
  if (url.pathname === "/" && url.searchParams.get("code")) {
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
