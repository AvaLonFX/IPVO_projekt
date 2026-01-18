import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/ga-data";

export async function GET() {
  return NextResponse.redirect(getGoogleAuthUrl());
}
