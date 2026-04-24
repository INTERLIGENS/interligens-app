// src/app/api/ingest/route.ts
// POST /api/ingest — universal ingestion endpoint (admin only).
// Accepts any raw input and runs it through the ingestion pipeline.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { ingest } from "@/lib/ingestion/pipeline";
import type { IngestionSource } from "@/lib/ingestion/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RATE_LIMIT = { windowMs: 60_000, max: 10, keyPrefix: "rl:ingest" };

const VALID_SOURCES: IngestionSource[] = [
  "wallet_address",
  "twitter_handle",
  "csv_arkham",
  "json_casefile",
  "manual",
];

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip, RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: { input?: unknown; source?: unknown; dryRun?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input.trim() : null;
  if (!input) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }

  const source: IngestionSource =
    typeof body.source === "string" && VALID_SOURCES.includes(body.source as IngestionSource)
      ? (body.source as IngestionSource)
      : "manual";

  const dryRun = body.dryRun === true;

  try {
    const job = await ingest(input, source, dryRun);
    return NextResponse.json({ job }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
