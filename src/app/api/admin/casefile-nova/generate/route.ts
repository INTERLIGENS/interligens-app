/**
 * src/app/api/admin/casefile-nova/generate/route.ts
 *
 * POST /api/admin/casefile-nova/generate
 *
 * Generates the $NOVA synthetic casefile PDF and streams it back to the
 * caller. Guards in order of importance:
 *
 *   1. Feature flag FEATURE_CASEFILE_NOVA_GENERATOR. Returns 404 when
 *      disabled so we do not even acknowledge the route exists in production.
 *   2. requireAdminApi() - x-admin-token header or admin_token cookie.
 *
 * Streaming the buffer back keeps this route stateless: no R2 upload, no DB
 * write. R2 archival is a follow-up PR.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { generateNovaPDF } from "@/lib/pdf/nova/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!FEATURE_FLAGS.CASEFILE_NOVA_GENERATOR) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: { version?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine; we fall back to the default version below.
  }
  const version = typeof body.version === "string" && body.version.length > 0
    ? body.version
    : "v1.1";

  try {
    const pdfBuffer = await generateNovaPDF({ version });
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="INTERLIGENS-Casefile-NOVA-${version}.pdf"`,
        "Cache-Control": "no-store",
        "X-Casefile-Mode": "synthetic-demo",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("[casefile-nova] generation failed:", err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
