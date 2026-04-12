import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VaultEntityType } from "@prisma/client";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

const VALID_TYPES: VaultEntityType[] = [
  "WALLET",
  "TX_HASH",
  "HANDLE",
  "URL",
  "DOMAIN",
  "ALIAS",
  "EMAIL",
  "IP",
  "CONTRACT",
  "OTHER",
];

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type");
  const where: Record<string, unknown> = { caseId };
  if (typeParam && VALID_TYPES.includes(typeParam as VaultEntityType)) {
    where.type = typeParam;
  }

  const entities = await prisma.vaultCaseEntity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  return NextResponse.json({ entities });
}

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const rawList = Array.isArray((body as { entities?: unknown }).entities)
    ? ((body as { entities: unknown[] }).entities as unknown[])
    : [body];

  let created = 0;
  let updated = 0;
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const type = e.type as string;
    const value = e.value as string;
    if (!type || !value) continue;
    if (!VALID_TYPES.includes(type as VaultEntityType)) continue;
    const normalizedValue = String(value).slice(0, 500);

    const existing = await prisma.vaultCaseEntity.findUnique({
      where: {
        caseId_type_value: {
          caseId,
          type: type as VaultEntityType,
          value: normalizedValue,
        },
      },
    });

    if (existing) {
      await prisma.vaultCaseEntity.update({
        where: { id: existing.id },
        data: {
          label: typeof e.label === "string" ? e.label.slice(0, 200) : existing.label,
          confidence:
            typeof e.confidence === "number" ? e.confidence : existing.confidence,
          extractionMethod:
            typeof e.extractionMethod === "string"
              ? e.extractionMethod.slice(0, 80)
              : existing.extractionMethod,
          sourceFileId:
            typeof e.sourceFileId === "string"
              ? e.sourceFileId
              : existing.sourceFileId,
        },
      });
      updated++;
    } else {
      await prisma.vaultCaseEntity.create({
        data: {
          caseId,
          type: type as VaultEntityType,
          value: normalizedValue,
          label: typeof e.label === "string" ? e.label.slice(0, 200) : null,
          confidence: typeof e.confidence === "number" ? e.confidence : null,
          extractionMethod:
            typeof e.extractionMethod === "string"
              ? e.extractionMethod.slice(0, 80)
              : null,
          sourceFileId:
            typeof e.sourceFileId === "string" ? e.sourceFileId : null,
        },
      });
      created++;
    }
  }

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "ENTITIES_ADDED",
    actor: ctx.access.label,
    request,
    metadata: { created, updated },
  });

  return NextResponse.json({ created, updated });
}
