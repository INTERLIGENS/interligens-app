/**
 * POST /admin/casefile-engine/[id]/generate-pdf
 *
 * V1 scaffold: returns a stub JSON response so the route surface is in place.
 * Real PDF generation will be wired in once the Neon migration is applied and
 * a CasefileDraft row can be fetched by id.
 *
 * Order of guards (both must pass):
 *   1. Feature flag (FEATURE_CASEFILE_ENGINE_V1) — 404 when disabled.
 *   2. Admin auth (ADMIN_TOKEN via x-admin-token / Bearer) — 401/403 when missing.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  featureDisabledApiResponse,
  isCasefileEngineEnabled,
} from "@/lib/casefile-engine/gate";
import { requireAdminApi } from "@/lib/security/adminAuth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  if (!isCasefileEngineEnabled()) {
    return featureDisabledApiResponse();
  }

  const adminGate = requireAdminApi(req);
  if (adminGate) return adminGate;

  const { id } = await ctx.params;

  return NextResponse.json(
    {
      ok: true,
      stage: "scaffold",
      message:
        "Casefile Engine V1 — PDF generation will be wired after Neon migration is applied.",
      casefileDraftId: id,
      synthetic: true,
    },
    { status: 202 },
  );
}
