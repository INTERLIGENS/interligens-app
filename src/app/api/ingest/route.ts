// src/app/api/ingest/route.ts
// POST /api/ingest — universal ingestion endpoint (admin only).
// Accepts any raw input and runs it through the ingestion pipeline.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { ingest } from "@/lib/ingestion/pipeline";
import type { IngestionSource } from "@/lib/ingestion/types";
import { validateArkhamCsv } from "@/lib/ingestion/csv-validator";

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

  // CSV Arkham: validate first, default dryRun=true
  const dryRun = source === "csv_arkham"
    ? body.dryRun !== false  // default true unless explicitly false
    : body.dryRun === true;

  if (source === "csv_arkham") {
    try {
      const validation = await validateArkhamCsv(input);

      if (validation.valid.length === 0) {
        return NextResponse.json({
          error: "No valid rows in CSV",
          preview: validation.preview,
          errors: validation.errors,
          duplicates: validation.duplicates,
        }, { status: 422 });
      }

      // dryRun=true → return preview without insert
      if (dryRun) {
        return NextResponse.json({
          dryRun: true,
          validRows: validation.valid.length,
          errors: validation.errors,
          duplicates: validation.duplicates,
          preview: validation.preview,
        }, { status: 200 });
      }

      // dryRun=false → run pipeline per valid row
      const jobs = [];
      for (const row of validation.valid) {
        const csvLine = [row.txHash, row.walletAddress ?? "", "SOL", row.eventDate.toISOString(), String(row.amountUsd), row.kolHandle ?? "", row.tokenSymbol ?? ""].join(",");
        const job = await ingest(csvLine, "csv_arkham", false);
        jobs.push({ jobId: job.id, status: job.status, txHash: row.txHash });
      }
      return NextResponse.json({
        dryRun: false,
        inserted: jobs.length,
        errors: validation.errors,
        duplicates: validation.duplicates,
        preview: validation.preview,
        jobs,
      }, { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    const job = await ingest(input, source, dryRun);
    return NextResponse.json({ job }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
