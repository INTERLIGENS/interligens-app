import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import { generateR2Key } from "@/lib/vault/r2-vault";

type RouteCtx = { params: Promise<{ caseId: string }> };

const ALLOWED_MIMES = new Set([
  "application/json",
  "text/csv",
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
]);

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const { filenameEnc, filenameIv, mimeType, sizeBytes } = body as {
    filenameEnc?: string;
    filenameIv?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  if (!filenameEnc || !filenameIv) {
    return NextResponse.json({ error: "missing_ciphertext" }, { status: 400 });
  }
  if (!mimeType || !ALLOWED_MIMES.has(mimeType)) {
    return NextResponse.json({ error: "mime_not_allowed" }, { status: 400 });
  }
  if (typeof sizeBytes !== "number" || sizeBytes <= 0 || sizeBytes > MAX_SIZE) {
    return NextResponse.json({ error: "size_out_of_range" }, { status: 400 });
  }

  // Size accounts for AES-GCM expansion (12 IV + 16 tag). Allow tiny headroom.
  const r2Key = generateR2Key(ctx.workspace.id, caseId);

  const created = await prisma.vaultCaseFile.create({
    data: {
      caseId,
      filenameEnc,
      filenameIv,
      mimeType,
      sizeBytes,
      r2Key, // internal — never returned
      r2Bucket: process.env.VAULT_R2_BUCKET ?? "interligens-vaults",
    },
    select: { id: true }, // explicit: drop r2Key from the response shape
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "FILE_DRAFT_CREATED",
    actor: ctx.access.label,
    request,
    metadata: { mimeType, sizeBytes },
  });

  return NextResponse.json({ fileId: created.id });
}
