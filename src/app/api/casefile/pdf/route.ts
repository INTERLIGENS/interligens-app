// src/app/api/casefile/pdf/route.ts
//
// GET /api/casefile/pdf?handle=<kolHandle>&mock=1
//   Retail-safe wrapper around the CaseFile PDF generator. Accepts a KOL
//   handle, resolves it to a case preset via kolHandleToCasefilePreset,
//   renders the multi-page forensic PDF through shared
//   src/lib/casefile/pdfGenerator.ts, and streams it back inline.
//
//   - ?mock=1 bypasses ADMIN_TOKEN auth (same pattern as /api/report/v2
//     and /api/casefile). Without it, checkAuth is still enforced so
//     direct admin / cron callers keep working.
//   - Unknown handle → 404. The KOL-page button is expected to resolve
//     the handle client-side before rendering, but the server is
//     defensive.
//
// The POST /api/casefile/generate route stays admin-only and still drives
// the /admin/casefile-generator UI. This file is the public read path.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/security/auth";
import { generateCaseFilePdf } from "@/lib/casefile/pdfGenerator";
import {
  buildBotifyInput,
  buildVineInput,
  kolHandleToCasefilePreset,
} from "@/lib/casefile/presets";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isMock = searchParams.get("mock") === "1";
  if (!isMock) {
    const auth = await checkAuth(req);
    if (!auth.authorized) return auth.response!;
  }

  const handle = (searchParams.get("handle") ?? "").trim();
  const presetOverride = searchParams.get("preset"); // admin-only convenience
  if (!handle && !presetOverride) {
    return NextResponse.json(
      { error: "handle or preset required" },
      { status: 400 }
    );
  }

  const preset =
    presetOverride === "vine" || presetOverride === "botify"
      ? presetOverride
      : kolHandleToCasefilePreset(handle);
  if (!preset) {
    return NextResponse.json(
      { error: "handle has no linked case file" },
      { status: 404 }
    );
  }

  const input = preset === "vine" ? buildVineInput() : buildBotifyInput();

  const result = await generateCaseFilePdf(input, { uploadToR2: false });
  if (!result.success || !result.pdfBytes) {
    return NextResponse.json(
      { error: result.error ?? "pdf_render_failed" },
      { status: 500 }
    );
  }

  return new NextResponse(Buffer.from(result.pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${input.case_meta.case_id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
