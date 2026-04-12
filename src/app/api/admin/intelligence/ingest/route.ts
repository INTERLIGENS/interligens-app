// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/intelligence/ingest
// Triggers intelligence ingest for a specific address or all sources.
// Auth: requireAdminApi
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { ingestSource, ingestAll } from "@/lib/intelligence";
import { fetchGoPlusToken, fetchGoPlusAddress } from "@/lib/intelligence";
import { lookupValue } from "@/lib/intelligence";
import type { SourceSlug } from "@/lib/intelligence";
import { SOURCES } from "@/lib/intelligence/sources/registry";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: { address?: string; sources?: string[]; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { address, sources, mode } = body;

  // Mode 1: Lookup existing intelligence for an address
  if (mode === "lookup" && address) {
    const signal = await lookupValue(address);
    return NextResponse.json({ signal });
  }

  // Mode 2: Realtime GoPlus lookup for a specific address
  if (address) {
    const chain = address.startsWith("0x") ? "ethereum" : "solana";
    const [tokenResults, addressResults] = await Promise.allSettled([
      fetchGoPlusToken(address, chain),
      fetchGoPlusAddress(address, chain),
    ]);

    const goplusResults = [
      ...(tokenResults.status === "fulfilled" ? tokenResults.value : []),
      ...(addressResults.status === "fulfilled" ? addressResults.value : []),
    ];

    // Also lookup in existing DB
    const signal = await lookupValue(address);

    return NextResponse.json({
      address,
      signal,
      goplusResults,
      goplusCount: goplusResults.length,
    });
  }

  // Mode 3: Batch ingest specific sources or all
  if (sources && sources.length > 0) {
    const validSlugs = sources.filter(
      (s): s is SourceSlug => s in SOURCES
    );
    if (validSlugs.length === 0) {
      return NextResponse.json(
        { error: "No valid source slugs provided", validSlugs: Object.keys(SOURCES) },
        { status: 400 }
      );
    }
    const results = [];
    for (const slug of validSlugs) {
      results.push(await ingestSource(slug, "admin-manual"));
    }
    return NextResponse.json({ results });
  }

  // Mode 4: Ingest all sources
  const results = await ingestAll("admin-manual");
  return NextResponse.json({ results });
}
