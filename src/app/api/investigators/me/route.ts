import { NextRequest, NextResponse } from "next/server";
import { getVaultWorkspace } from "@/lib/vault/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    handle: ctx.profile.handle,
    displayName: ctx.profile.displayName ?? null,
    workspaceId: ctx.workspace.id,
  });
}
