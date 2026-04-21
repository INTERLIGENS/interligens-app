// src/app/api/casefile/pdf/route.ts
//
// GET /api/casefile/pdf?handle=<kolHandle>&template=<public|internal>&lang=<en|fr>&mock=1
//
// Two-template PDF endpoint:
//   template=public   → public-safe, printable, 9-section diffamation-safe
//                       intelligence report (generateCaseFilePdfPublic).
//                       This is what the KOL page CaseFile button calls.
//   template=internal → full internal forensic report with smoking guns,
//                       requisitions and shiller roster (generateCaseFilePdf
//                       + buildBotifyInput). Shares the data with POST
//                       /api/casefile/generate.
//
// Auth: ?mock=1 bypasses ADMIN_TOKEN (same pattern as /api/report/v2).
// Handle → preset resolution via kolHandleToCasefilePreset (BOTIFY-linked
// handles resolve; everything else → 404).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/security/auth";
import { generateCaseFilePdf } from "@/lib/casefile/pdfGenerator";
import {
  generateCaseFilePdfPublic,
  type PublicReportLang,
} from "@/lib/casefile/pdfGeneratorPublic";
import {
  buildBotifyInput,
  buildVineInput,
  kolHandleToCasefilePreset,
} from "@/lib/casefile/presets";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Template = "public" | "internal";

// Direct mint → preset map. Callers that already hold the token mint
// (scan page, share links, OG previews) can bypass the KOL handle lookup
// entirely. Keep narrow; every entry ships in step with a casefile
// published under the matching preset.
const MINT_TO_PRESET: Record<string, "botify" | "vine"> = {
  BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb: "botify",
};

function parseTemplate(raw: string | null): Template {
  if (raw === "internal") return "internal";
  return "public"; // default to public — it's the retail surface
}

function parseLang(raw: string | null): PublicReportLang {
  if (raw === "fr") return "fr";
  return "en";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isMock = searchParams.get("mock") === "1";
  if (!isMock) {
    const auth = await checkAuth(req);
    if (!auth.authorized) return auth.response!;
  }

  const handle = (searchParams.get("handle") ?? "").trim();
  const mint = (searchParams.get("mint") ?? "").trim();
  const presetOverride = searchParams.get("preset");
  const template = parseTemplate(searchParams.get("template"));
  const lang = parseLang(searchParams.get("lang"));

  if (!handle && !mint && !presetOverride) {
    return NextResponse.json(
      { error: "handle, mint or preset required" },
      { status: 400 }
    );
  }

  // Mint takes precedence when provided — it's the most specific anchor.
  // handle/presetOverride are still supported for the KOL-page button.
  let preset: "botify" | "vine" | null = null;
  if (presetOverride === "vine" || presetOverride === "botify") {
    preset = presetOverride;
  } else if (mint) {
    preset = MINT_TO_PRESET[mint] ?? null;
    if (!preset) {
      return NextResponse.json(
        { error: "mint has no linked case file" },
        { status: 400 }
      );
    }
  } else {
    preset = kolHandleToCasefilePreset(handle);
  }
  if (!preset) {
    return NextResponse.json(
      { error: "handle has no linked case file" },
      { status: 404 }
    );
  }

  // ── PUBLIC template — retail-safe 9-section diffamation-safe PDF ──────
  if (template === "public") {
    // Only the BOTIFY case has a published public template in v1.
    // Vine will follow once its public script is approved; for now it
    // falls back to the BOTIFY public skeleton with the vine case id
    // only if explicitly requested — defensive behaviour to avoid
    // surfacing vine content that hasn't been copy-cleared.
    if (preset !== "botify") {
      return NextResponse.json(
        { error: "public template not available for this preset" },
        { status: 404 }
      );
    }
    const caseId = "CASE-2024-BOTIFY-001";
    const result = await generateCaseFilePdfPublic(lang, caseId);
    if (!result.success || !result.pdfBytes) {
      return NextResponse.json(
        { error: result.error ?? "pdf_render_failed" },
        { status: 500 }
      );
    }
    const filename = `${caseId}-public-${lang}.pdf`;
    return new NextResponse(Buffer.from(result.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ── INTERNAL template — full forensic report ─────────────────────────
  const input = preset === "vine" ? buildVineInput() : buildBotifyInput();
  const result = await generateCaseFilePdf(input, { uploadToR2: false });
  if (!result.success || !result.pdfBytes) {
    return NextResponse.json(
      { error: result.error ?? "pdf_render_failed" },
      { status: 500 }
    );
  }
  const filename = `${input.case_meta.case_id}-internal-${lang}.pdf`;
  return new NextResponse(Buffer.from(result.pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
