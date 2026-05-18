// src/app/api/casefile/public/route.ts
//
// GET /api/casefile/public?handle=<kolHandle>&lang=<en|fr>
// GET /api/casefile/public?mint=<tokenMint>&lang=<en|fr>
//
// Retail-facing public CaseFile endpoint. No auth. IP-rate-limited
// (RATE_LIMIT_PRESETS.pdf = 10 req / 5 min / IP, fail-closed on Upstash).
// Always renders the public 9-section diffamation-safe template via
// generateCaseFilePdfPublic — there is no path from this route to the
// internal forensic generator. Admin surface lives at /api/casefile/pdf
// and stays behind checkAuth.
//
// Response: application/pdf, Cache-Control: public, max-age=3600.
// Only BOTIFY-linked handles/mints resolve; everything else is 404.
//
// Why separate from /api/casefile/pdf: retail callers must not rely on
// a mock=1 bypass against the admin route (closed P0). This endpoint is
// the dedicated retail surface.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import {
  generateCaseFilePdfPublic,
  type PublicReportLang,
} from "@/lib/casefile/pdfGeneratorPublic";
import { kolHandleToCasefilePreset } from "@/lib/casefile/presets";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Mint → preset map. Keep in lockstep with MINT_TO_PRESET in
// /api/casefile/pdf; only presets with an approved public template
// belong here (BOTIFY is the only one in v1).
const MINT_TO_PRESET: Record<string, "botify"> = {
  BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb: "botify",
};

function parseLang(raw: string | null): PublicReportLang {
  return raw === "fr" ? "fr" : "en";
}

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.pdf);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  const { searchParams } = new URL(req.url);
  const handle = (searchParams.get("handle") ?? "").trim();
  const mint = (searchParams.get("mint") ?? "").trim();
  const lang = parseLang(searchParams.get("lang"));

  if (!handle && !mint) {
    return NextResponse.json(
      { error: "handle or mint required" },
      { status: 400 },
    );
  }

  let preset: "botify" | null = null;
  if (mint) {
    preset = MINT_TO_PRESET[mint] ?? null;
  } else {
    preset = kolHandleToCasefilePreset(handle) === "botify" ? "botify" : null;
  }

  if (!preset) {
    return NextResponse.json(
      { error: "no linked public case file" },
      { status: 404 },
    );
  }

  const caseId = "CASE-2024-BOTIFY-001";
  const result = await generateCaseFilePdfPublic(lang, caseId);
  if (!result.success || !result.pdfBytes) {
    return NextResponse.json(
      { error: result.error ?? "pdf_render_failed" },
      { status: 500 },
    );
  }

  return new NextResponse(Buffer.from(result.pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${caseId}-public-${lang}.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
