import { NextRequest, NextResponse } from "next/server";
import { getVaultWorkspace } from "@/lib/vault/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/investigators/me
 *
 * Lightweight identity endpoint for the investigator client. Returns the
 * current vault handle + display name so client components (e.g. the
 * graph editor, which uses the handle in PNG watermarks) don't need to
 * round-trip through the main profile API.
 */
export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    handle: ctx.profile.handle,
    displayName: ctx.profile.displayName ?? null,
    workspaceId: ctx.workspace.id,
  });
}
