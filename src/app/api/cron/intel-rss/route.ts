/**
 * GET /api/cron/intel-rss
 * Vercel cron — every 20 min. Ingests Founder Intel RSS sources.
 * Auth: Bearer ${CRON_SECRET}.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runRssIngest } from "@/lib/intel/rss-ingester";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runRssIngest();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/intel-rss] failed", err);
    return NextResponse.json({ ok: false, error: "ingest_failed" }, { status: 500 });
  }
}
