import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  VaultEvidenceSourceType,
  VaultEvidencePublishability,
} from "@prisma/client";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import { generateSnapshotRecordHash } from "@/lib/vault/evidenceSnapshotHash";

type RouteCtx = { params: Promise<{ caseId: string }> };

const VALID_SOURCE_TYPES: VaultEvidenceSourceType[] = [
  "WEBSITE",
  "X_POST",
  "TELEGRAM",
  "DISCORD",
  "GITHUB",
  "MEDIUM",
  "WHITEPAPER",
  "EXPLORER",
  "ARKHAM",
  "METASLEUTH",
  "DUNE",
  "CHAINABUSE",
  "GOPLUS",
  "SCAMSNIFFER",
  "OTHER",
];

const VALID_PUBLISHABILITY: VaultEvidencePublishability[] = [
  "PRIVATE",
  "SHAREABLE",
  "PUBLISHABLE",
  "REDACTED",
];

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  try {
    const snapshots = await prisma.vaultEvidenceSnapshot.findMany({
      where: { caseId },
      orderBy: { capturedAt: "desc" },
    });
    return NextResponse.json({ snapshots });
  } catch (err) {
    console.error("[evidence-snapshots] list failed", err);
    return NextResponse.json({ snapshots: [] });
  }
}

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));

  // URL — optional but must be valid if provided
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  let url: string | null = null;
  if (rawUrl) {
    url = normalizeUrl(rawUrl);
    if (url === null) {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }
  }

  // Title — required; fall back to URL hostname if omitted
  let title = typeof body.title === "string" ? body.title.slice(0, 500).trim() : "";
  if (!title && url) {
    try {
      title = new URL(url).hostname;
    } catch {}
  }
  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }

  // sourceType
  const sourceType: VaultEvidenceSourceType =
    typeof body.sourceType === "string" &&
    VALID_SOURCE_TYPES.includes(body.sourceType as VaultEvidenceSourceType)
      ? (body.sourceType as VaultEvidenceSourceType)
      : "OTHER";

  // publishability
  const publishability: VaultEvidencePublishability =
    typeof body.publishability === "string" &&
    VALID_PUBLISHABILITY.includes(body.publishability as VaultEvidencePublishability)
      ? (body.publishability as VaultEvidencePublishability)
      : "PRIVATE";

  // note
  const note =
    typeof body.note === "string" ? body.note.slice(0, 8000).trim() || null : null;

  // tags
  const tags: string[] = Array.isArray(body.tags)
    ? body.tags
        .filter((x: unknown): x is string => typeof x === "string")
        .map((t: string) => t.slice(0, 100).trim())
        .filter(Boolean)
        .slice(0, 50)
    : [];

  // relatedEntityId — must belong to this case if provided
  let relatedEntityId: string | null = null;
  if (typeof body.relatedEntityId === "string" && body.relatedEntityId) {
    const entity = await prisma.vaultCaseEntity.findFirst({
      where: { id: body.relatedEntityId, caseId },
      select: { id: true },
    });
    if (!entity) {
      return NextResponse.json(
        { error: "related_entity_not_in_case" },
        { status: 400 }
      );
    }
    relatedEntityId = entity.id;
  }

  const capturedAt = new Date();
  const contentHashSha256 = generateSnapshotRecordHash({
    caseId,
    url,
    title,
    sourceType,
    note,
    tags,
    relatedEntityId,
    capturedAt,
  });

  try {
    const snapshot = await prisma.vaultEvidenceSnapshot.create({
      data: {
        caseId,
        workspaceId: ctx.workspace.id,
        investigatorAccessId: ctx.access.id,
        url,
        title,
        sourceType,
        note,
        tags,
        relatedEntityId,
        publishability,
        contentHashSha256,
        capturedAt,
      },
    });

    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      caseId,
      action: "EVIDENCE_SNAPSHOT_CREATED",
      actor: ctx.access.label,
      request,
      metadata: {
        snapshotId: snapshot.id,
        sourceType,
        publishability,
      },
    });

    return NextResponse.json({ snapshot });
  } catch (err) {
    console.error("[evidence-snapshots] create failed", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
