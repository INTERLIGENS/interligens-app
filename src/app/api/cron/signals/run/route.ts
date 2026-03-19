/**
 * src/app/api/cron/signals/run/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { detectAllInfluencers } from "@/lib/surveillance/signals/detectSellWhileShilling";
import { updateAllScores } from "@/lib/surveillance/signals/recidivismScore";

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret") ?? "";
  try {
    const a = Buffer.from(secret, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const detection = await detectAllInfluencers(30);
  const scores = await updateAllScores();
  return NextResponse.json({ detection, scoresUpdated: scores.length });
}

export async function GET(req: NextRequest) { return POST(req); }
