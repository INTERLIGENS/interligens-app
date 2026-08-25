// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/admin/intelligence/entities
// List and upsert CanonicalEntity records.
// Auth: requireAdminApi
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { buildDedupKey, normalizeValue } from "@/lib/intelligence/normalize";
import { guardRetailPromotion } from "@/lib/intelligence/reviewIdentity";
import type { IntelEntityType } from "@/lib/intelligence";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const riskClass = url.searchParams.get("riskClass") || url.searchParams.get("risk") || undefined;
  const type = url.searchParams.get("type") || undefined;
  const search = url.searchParams.get("search") || url.searchParams.get("q") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = url.searchParams.has("offset")
    ? parseInt(url.searchParams.get("offset")!)
    : (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (riskClass) where.riskClass = riskClass;
  if (type) where.type = type;
  if (search) where.value = { contains: search, mode: "insensitive" };

  const [entities, total] = await Promise.all([
    prisma.canonicalEntity.findMany({
      where,
      include: {
        observations: {
          select: {
            id: true,
            sourceSlug: true,
            riskClass: true,
            listIsActive: true,
            label: true,
            ingestedAt: true,
          },
          orderBy: { ingestedAt: "desc" },
        },
        _count: { select: { cases: true } },
      },
      orderBy: { lastSeenAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.canonicalEntity.count({ where }),
  ]);

  return NextResponse.json({ records: entities, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: {
    type: string;
    value: string;
    chain?: string;
    riskClass?: string;
    displaySafety?: string;
    reviewedBy?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.type || !body.value) {
    return NextResponse.json(
      { error: "type and value are required" },
      { status: 400 }
    );
  }

  const normalized = normalizeValue(body.type as IntelEntityType, body.value);
  const dedupKey = buildDedupKey(body.type as IntelEntityType, normalized);
  const now = new Date();

  // ── P0-B — publier au retail est un acte de revue, pas un champ de payload ──
  // Garde commun aux trois voies de promotion. Refus AVANT toute écriture.
  const guard = guardRetailPromotion({
    displaySafety: body.displaySafety,
    entityType: body.type,
    value: normalized,
    reviewedBy: body.reviewedBy,
    now,
  });
  if (guard.promotes && !guard.ok) {
    return NextResponse.json(
      { error: guard.reason, code: guard.code },
      { status: guard.status }
    );
  }
  const stamp = guard.promotes && guard.ok ? guard.stamp : {};

  const upsertArgs = {
    where: { dedupKey },
    create: {
      type: body.type as any,
      value: normalized,
      chain: body.chain ?? null,
      riskClass: (body.riskClass as any) ?? "UNKNOWN",
      strongestSource: "admin-manual",
      sourceCount: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      dedupKey,
      displaySafety: (body.displaySafety as any) ?? "INTERNAL_ONLY",
      ...stamp,
    },
    update: {
      lastSeenAt: now,
      ...(body.riskClass ? { riskClass: body.riskClass as any } : {}),
      ...(body.displaySafety ? { displaySafety: body.displaySafety as any } : {}),
      ...stamp,
    },
  };

  // Hors promotion retail : comportement d'origine, inchangé.
  if (!guard.promotes || !guard.ok) {
    const entity = await prisma.canonicalEntity.upsert(upsertArgs);
    return NextResponse.json({ entity }, { status: 201 });
  }

  // Promotion : l'entité et sa trace d'audit vivent ou meurent ensemble.
  const entity = await prisma.$transaction(async (tx) => {
    const created = await tx.canonicalEntity.upsert(upsertArgs);
    await tx.intelAuditLog.create({
      data: {
        actor: guard.actor,
        action: "entity.reviewed",
        targetType: "CanonicalEntity",
        targetId: created.id,
        detail: {
          to: "RETAIL_SAFE",
          reviewedBy: guard.handle,
          type: created.type,
          value: created.value,
          route: "POST /api/admin/intelligence/entities",
        },
      },
    });
    return created;
  });

  return NextResponse.json({ entity }, { status: 201 });
}
