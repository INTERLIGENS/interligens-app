import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import { buildFingerprint } from "@/lib/vault/fingerprint.server";
import {
  checkRateLimit,
  rateLimitExceededBody,
} from "@/lib/vault/rateLimit.server";

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

  const rl = checkRateLimit(ctx.workspace.id, "share_create", 20, 3600_000);
  if (!rl.allowed) {
    return NextResponse.json(rateLimitExceededBody(rl, "Share link creation"), {
      status: 429,
    });
  }

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

  // PRIVACY QA — assert snapshot does not contain sensitive fields
  const FORBIDDEN_KEYS = [
    "contentEnc",
    "contentIv",
    "r2Key",
    "r2Bucket",
    "kdfSalt",
    "titleEnc",
    "titleIv",
    "tagsEnc",
    "tagsIv",
    "filenameEnc",
    "filenameIv",
  ];
  function assertNoForbidden(obj: unknown, path = "snapshot") {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) assertNoForbidden(obj[i], `${path}[${i}]`);
      return;
    }
    for (const k of Object.keys(obj as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.includes(k) || k.endsWith("Enc") || k.endsWith("Iv")) {
        throw new Error(`FORBIDDEN_KEY_IN_SNAPSHOT:${path}.${k}`);
      }
      assertNoForbidden((obj as Record<string, unknown>)[k], `${path}.${k}`);
    }
  }
  try {
    assertNoForbidden({ entitySnapshot, hypothesisSnapshot, titleSnapshot });
  } catch (err) {
    console.error("[share] snapshot forbidden key", err);
    return NextResponse.json(
      { error: "forbidden_key_in_snapshot" },
      { status: 400 }
    );
  }

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
      fingerprint: buildFingerprint(request),
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
