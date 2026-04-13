import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

const EXPIRY_MAP: Record<string, number> = {
  "1h": 1 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const expiresIn =
    typeof body.expiresIn === "string" && EXPIRY_MAP[body.expiresIn]
      ? body.expiresIn
      : "24h";
  const titleSnapshot =
    typeof body.titleSnapshot === "string"
      ? body.titleSnapshot.slice(0, 300)
      : "Untitled case";
  const entitySnapshot = Array.isArray(body.entitySnapshot)
    ? body.entitySnapshot.slice(0, 1000)
    : [];
  const hypothesisSnapshot = Array.isArray(body.hypothesisSnapshot)
    ? body.hypothesisSnapshot.slice(0, 100)
    : null;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRY_MAP[expiresIn]);

  try {
    const share = await prisma.vaultCaseShare.create({
      data: {
        caseId,
        token,
        expiresAt,
        workspaceId: ctx.workspace.id,
        titleSnapshot,
        entitySnapshot,
        hypothesisSnapshot: hypothesisSnapshot ?? undefined,
      },
    });

    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      caseId,
      action: "CASE_SHARED",
      actor: ctx.access.label,
      request,
      metadata: { shareId: share.id, expiresIn, expiresAt },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.interligens.com";
    return NextResponse.json({
      shareUrl: `${baseUrl}/shared/case/${token}`,
      expiresAt,
    });
  } catch (err) {
    console.error("[share] create failed", err);
    return NextResponse.json({ error: "share_failed" }, { status: 500 });
  }
}
