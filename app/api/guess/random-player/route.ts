import { NextRequest } from "next/server";
import { gameRoute } from "@/lib/guesser-server";
export const runtime = "nodejs";
export const GET = (req: NextRequest) => gameRoute(req, "alltime", "practice");
export const POST = GET;
