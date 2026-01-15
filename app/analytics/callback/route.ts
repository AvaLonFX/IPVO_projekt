// app/analytics/callback/route.ts
import { NextResponse } from "next/server";
import { saveTokensFromCode } from "@/lib/ga-data";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      `${origin}/analytics?error=${encodeURIComponent(error)}`
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/analytics?error=missing_code`);
  }

  try {
    await saveTokensFromCode(code);
    return NextResponse.redirect(`${origin}/analytics?connected=1`);
  } catch (e: any) {
    return NextResponse.redirect(
      `${origin}/analytics?error=${encodeURIComponent(
        e?.message ?? "token_error"
      )}`
    );
  }
}
