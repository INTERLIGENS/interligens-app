import { NextRequest, NextResponse } from "next/server";
import {
  getVaultWorkspace,
  assertFileOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import { buildFingerprint } from "@/lib/vault/fingerprint.server";
import { generatePresignedGetUrl } from "@/lib/vault/r2-vault";

type RouteCtx = { params: Promise<{ caseId: string; fileId: string }> };

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId, fileId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const file = await assertFileOwnership(ctx.workspace.id, caseId, fileId);
  if (file instanceof NextResponse) return file;

  const url = await generatePresignedGetUrl(file.r2Key);
  const expiresAt = new Date(Date.now() + 900_000).toISOString();

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "FILE_ACCESSED",
    actor: ctx.access.label,
    request,
    fingerprint: buildFingerprint(request),
  });

  // r2Key intentionally NOT in the response
  return NextResponse.json({ url, expiresAt });
}
