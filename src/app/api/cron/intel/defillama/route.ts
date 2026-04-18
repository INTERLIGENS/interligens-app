import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { ingestDefiLlama } from "@/lib/intel/ingestion/sources/defiLlamaProtocols";

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
  if (a.length !== b.length) { timingSafeEqual(a, Buffer.alloc(a.length)); return false; }
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !verifyCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await ingestDefiLlama();
    console.log("[cron/defillama] done", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/defillama] failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "ingest_failed" },
      { status: 500 }
    );
  }
}
