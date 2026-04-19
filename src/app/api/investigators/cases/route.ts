import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace, logAudit } from "@/lib/vault/auth.server";
import { buildFingerprint } from "@/lib/vault/fingerprint.server";

export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Default list excludes ARCHIVED to match workspace/metrics.activeCases.
  // Callers that want the complete set opt-in with ?includeArchived=true.
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const cases = await prisma.vaultCase.findMany({
    where: {
      workspaceId: ctx.workspace.id,
      ...(includeArchived ? {} : { status: { not: "ARCHIVED" } }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      titleEnc: true,
      titleIv: true,
      tagsEnc: true,
      tagsIv: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { entities: true, files: true } },
    },
  });

  return NextResponse.json({
    cases: cases.map((c) => ({
      id: c.id,
      titleEnc: c.titleEnc,
      titleIv: c.titleIv,
      tagsEnc: c.tagsEnc,
      tagsIv: c.tagsIv,
      status: c.status,
      entityCount: c._count.entities,
      fileCount: c._count.files,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { titleEnc, titleIv, tagsEnc, tagsIv } = body as Record<string, string>;
  const rawTemplate = (body as { caseTemplate?: unknown }).caseTemplate;
  const ALLOWED_TEMPLATES = [
    "blank",
    "rug-pull",
    "kol-promo",
    "cex-cashout",
    "infostealer",
  ];
  const caseTemplate =
    typeof rawTemplate === "string" && ALLOWED_TEMPLATES.includes(rawTemplate)
      ? rawTemplate
      : "blank";
  if (!titleEnc || !titleIv || !tagsEnc || !tagsIv) {
    return NextResponse.json({ error: "missing_ciphertext" }, { status: 400 });
  }

  const created = await prisma.vaultCase.create({
    data: {
      workspaceId: ctx.workspace.id,
      titleEnc,
      titleIv,
      tagsEnc,
      tagsIv,
      caseTemplate,
    },
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId: created.id,
    action: "CASE_CREATED",
    actor: ctx.access.label,
    request,
    fingerprint: buildFingerprint(request),
  });

  return NextResponse.json({
    id: created.id,
    titleEnc: created.titleEnc,
    titleIv: created.titleIv,
    tagsEnc: created.tagsEnc,
    tagsIv: created.tagsIv,
    status: created.status,
    createdAt: created.createdAt,
  });
}
