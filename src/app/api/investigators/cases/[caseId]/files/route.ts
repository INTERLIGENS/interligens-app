import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const files = await prisma.vaultCaseFile.findMany({
    where: { caseId },
    orderBy: { uploadedAt: "desc" },
    // r2Key + r2Bucket deliberately excluded from the response
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
    },
  });

  return NextResponse.json({ files });
}
