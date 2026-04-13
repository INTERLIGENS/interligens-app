import { NextRequest, NextResponse } from "next/server";
import { getVaultWorkspace, logAudit } from "@/lib/vault/auth.server";

export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    action: "WORKSPACE_SALT_FETCHED",
    actor: ctx.access.label,
    request,
  });

  return NextResponse.json({ kdfSalt: ctx.workspace.kdfSalt });
}
