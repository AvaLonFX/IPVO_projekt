import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl, saveTokensFromCode } from "@/lib/ga-data";

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl();
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/analytics?error=missing_code", baseUrl));
  }

  try {
    await saveTokensFromCode(code);
    return NextResponse.redirect(new URL("/analytics?connected=1", baseUrl));
  } catch (e: any) {
    const msg = encodeURIComponent(e?.message ?? "token_exchange_failed");
    return NextResponse.redirect(new URL(`/analytics?error=${msg}`, baseUrl));
  }
}
