/**
 * src/app/api/cron/alerts/deliver/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { deliverPendingAlerts } from "@/lib/surveillance/alerts/deliverAlerts";

export const runtime = "nodejs";
export const maxDuration = 300; // SEC-010
export const dynamic = "force-dynamic";


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
  const result = await deliverPendingAlerts();
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) { return POST(req); }
