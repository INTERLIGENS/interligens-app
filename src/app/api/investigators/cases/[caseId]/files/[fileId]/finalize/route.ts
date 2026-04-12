import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VaultParseStatus } from "@prisma/client";
import {
  getVaultWorkspace,
  assertFileOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string; fileId: string }> };

const VALID: VaultParseStatus[] = [
  "PENDING",
  "PARSED",
  "PARTIAL",
  "MANUAL_REQUIRED",
  "FAILED",
];

export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const { caseId, fileId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const file = await assertFileOwnership(ctx.workspace.id, caseId, fileId);
  if (file instanceof NextResponse) return file;

  const body = await request.json().catch(() => ({}));
  const { parseStatus, entitiesFound, parseMode, parseError } = body as {
    parseStatus?: string;
    entitiesFound?: number;
    parseMode?: string;
    parseError?: string;
  };

  const data: Record<string, unknown> = { parsedAt: new Date() };
  if (parseStatus && VALID.includes(parseStatus as VaultParseStatus)) {
    data.parseStatus = parseStatus;
  }
  if (typeof entitiesFound === "number" && entitiesFound >= 0) {
    data.entitiesFound = Math.floor(entitiesFound);
  }
  if (typeof parseMode === "string") data.parseMode = parseMode.slice(0, 80);
  if (typeof parseError === "string") data.parseError = parseError.slice(0, 500);

  const updated = await prisma.vaultCaseFile.update({
    where: { id: fileId },
    data,
    select: {
      id: true,
      filenameEnc: true,
      filenameIv: true,
      mimeType: true,
      sizeBytes: true,
      uploadedAt: true,
      parseStatus: true,
      parsedAt: true,
      entitiesFound: true,
      parseMode: true,
      parseError: true,
    }, // r2Key deliberately excluded
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "FILE_UPLOADED",
    actor: ctx.access.label,
    request,
    metadata: { parseStatus, entitiesFound },
  });

  return NextResponse.json({ file: updated });
}
