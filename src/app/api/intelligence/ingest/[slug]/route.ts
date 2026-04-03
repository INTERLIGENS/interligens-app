// ─────────────────────────────────────────────────────────────────────────────
// Cron / Admin API — Trigger ingest for a single source
// POST /api/intelligence/ingest/ofac
// Auth: x-cron-secret header must match CRON_SECRET env var
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { ingestSource, SOURCES } from "@/lib/intelligence";
import type { SourceSlug } from "@/lib/intelligence";

export const maxDuration = 300; // 5 minutes — OFAC XML is ~200MB

function authenticate(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    "";

  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

async function handleIngest(slug: string) {
  if (slug === "all") {
    const { ingestAll } = await import("@/lib/intelligence");
    const results = await ingestAll(`admin:cron`);
    return NextResponse.json({ results });
  }

  if (!(slug in SOURCES)) {
    return NextResponse.json(
      { error: `Unknown source: ${slug}`, available: Object.keys(SOURCES) },
      { status: 400 }
    );
  }

  const result = await ingestSource(slug as SourceSlug, `admin:cron`);
  return NextResponse.json(result);
}

// GET — Vercel crons call GET with Authorization: Bearer <CRON_SECRET>
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const deny = authenticate(req);
  if (deny) return deny;
  const { slug } = await params;
  return handleIngest(slug);
}

// POST — manual / CLI calls
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const deny = authenticate(req);
  if (deny) return deny;
  const { slug } = await params;
  return handleIngest(slug);
}
