// src/app/api/casefile/generate/route.ts
//
// POST /api/casefile/generate
//   Body: { source: "vine" | "botify" | "custom", data?: CaseFileInput, uploadToR2?: boolean }
//   Returns: PDF binary (application/pdf) or JSON with R2 key
//
// Admin-only route. For the retail-safe GET equivalent see
// src/app/api/casefile/pdf/route.ts.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import {
  generateCaseFilePdf,
  type CaseFileInput,
} from "@/lib/casefile/pdfGenerator";
import { buildBotifyInput, buildVineInput } from "@/lib/casefile/presets";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: { source?: string; data?: CaseFileInput; uploadToR2?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let input: CaseFileInput;
  if (body.source === "vine") {
    input = buildVineInput();
  } else if (body.source === "botify") {
    input = buildBotifyInput();
  } else if (body.data) {
    input = body.data;
  } else {
    return NextResponse.json(
      { error: "Provide source='vine'|'botify' or a custom data object" },
      { status: 400 }
    );
  }

  const result = await generateCaseFilePdf(input, {
    uploadToR2: body.uploadToR2 ?? false,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (body.uploadToR2 && result.r2Key) {
    return NextResponse.json({
      success: true,
      r2Key: result.r2Key,
      sizeBytes: result.pdfBytes?.length,
    });
  }

  return new NextResponse(result.pdfBytes ? Buffer.from(result.pdfBytes) : null, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${input.case_meta.case_id}.pdf"`,
      "Cache-Control": "no-cache",
    },
  });
}
