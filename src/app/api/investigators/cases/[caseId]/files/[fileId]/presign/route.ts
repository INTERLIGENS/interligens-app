import { NextRequest, NextResponse } from "next/server";
import {
  getVaultWorkspace,
  assertFileOwnership,
} from "@/lib/vault/auth.server";
import {
  checkRateLimit,
  rateLimitExceededBody,
} from "@/lib/vault/rateLimit.server";
import { generatePresignedPutUrl } from "@/lib/vault/r2-vault";

type RouteCtx = { params: Promise<{ caseId: string; fileId: string }> };

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId, fileId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rl = checkRateLimit(ctx.workspace.id, "file_presign", 50, 3600_000);
  if (!rl.allowed) {
    return NextResponse.json(rateLimitExceededBody(rl, "File presign"), {
      status: 429,
    });
  }

  const file = await assertFileOwnership(ctx.workspace.id, caseId, fileId);
  if (file instanceof NextResponse) return file;

  const presignedUrl = await generatePresignedPutUrl(file.r2Key, file.mimeType);
  const expiresAt = new Date(Date.now() + 300_000).toISOString();

  // r2Key is intentionally NOT in the response
  return NextResponse.json({ presignedUrl, expiresAt });
}
