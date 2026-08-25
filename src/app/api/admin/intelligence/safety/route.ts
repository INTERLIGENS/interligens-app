// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/intelligence/safety
// Update displaySafety for a CanonicalEntity.
// PERSON-type entities: gate at Prisma query level, never retail-visible.
// Auth: requireAdminApi
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { guardRetailPromotion } from "@/lib/intelligence/reviewIdentity";

const VALID_SAFETY_VALUES = ["INTERNAL_ONLY", "ANALYST_REVIEWED", "RETAIL_SAFE"];

export async function PATCH(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: { entityId: string; displaySafety: string; reviewedBy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.entityId || !body.displaySafety) {
    return NextResponse.json(
      { error: "entityId and displaySafety are required" },
      { status: 400 }
    );
  }

  if (!VALID_SAFETY_VALUES.includes(body.displaySafety)) {
    return NextResponse.json(
      { error: `displaySafety must be one of: ${VALID_SAFETY_VALUES.join(", ")}` },
      { status: 400 }
    );
  }

  // Fetch entity to check type
  const entity = await prisma.canonicalEntity.findUnique({
    where: { id: body.entityId },
    select: { id: true, type: true, value: true, displaySafety: true },
  });

  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  // ── P0-B — garde commun aux trois voies de promotion retail ────────────────
  // Le garde PERSON existait déjà ici ; ce qui manquait, c'est l'identité du
  // reviewer — cette route promouvait au retail SANS JAMAIS poser `reviewedBy`,
  // recréant exactement l'état RETAIL_SAFE + reviewedBy NULL de l'incident du
  // 2026-04-08. Refus AVANT toute écriture.
  // VALID_SAFETY_VALUES a déjà filtré : la valeur est l'un des trois littéraux.
  const nextSafety = body.displaySafety as
    | "INTERNAL_ONLY"
    | "ANALYST_REVIEWED"
    | "RETAIL_SAFE";

  const now = new Date();
  const guard = guardRetailPromotion({
    displaySafety: body.displaySafety,
    entityType: entity.type,
    value: entity.value,
    reviewedBy: body.reviewedBy,
    now,
  });
  if (guard.promotes && !guard.ok) {
    return NextResponse.json(
      { error: guard.reason, code: guard.code },
      { status: guard.status }
    );
  }

  // Hors promotion retail : comportement d'origine, inchangé.
  if (!guard.promotes || !guard.ok) {
    const updated = await prisma.canonicalEntity.update({
      where: { id: body.entityId },
      data: { displaySafety: nextSafety },
    });

    await prisma.intelAuditLog.create({
      data: {
        actor: "admin",
        action: "safety.updated",
        targetType: "CanonicalEntity",
        targetId: body.entityId,
        detail: {
          from: entity.type,
          displaySafety: body.displaySafety,
        },
      },
    });

    return NextResponse.json({ entity: updated });
  }

  // Promotion : l'entité et sa trace d'audit vivent ou meurent ensemble.
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.canonicalEntity.update({
      where: { id: body.entityId },
      data: { displaySafety: nextSafety, ...guard.stamp },
    });

    await tx.intelAuditLog.create({
      data: {
        actor: guard.actor,
        action: "safety.updated",
        targetType: "CanonicalEntity",
        targetId: body.entityId,
        detail: {
          from: entity.displaySafety,
          to: "RETAIL_SAFE",
          reviewedBy: guard.handle,
          type: entity.type,
          value: entity.value,
          route: "PATCH /api/admin/intelligence/safety",
        },
      },
    });

    return row;
  });

  return NextResponse.json({ entity: updated });
}
