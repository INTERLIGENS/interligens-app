/**
 * GET /api/cron/intel/scamsniffer
 * Daily Vercel cron — ingests the public ScamSniffer blacklist into
 * AddressLabel. Every row carries source-attribution to the repo.
 * Auth: Bearer ${CRON_SECRET}.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { ingestScamSniffer } from "@/lib/intel/scamSniffer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  if (process.env.NODE_ENV === "production" && !verifyCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await ingestScamSniffer();
    console.log("[cron/intel/scamsniffer] done", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/intel/scamsniffer] failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "scamsniffer_ingest_failed",
      },
      { status: 500 }
    );
  }
}
