// ─────────────────────────────────────────────────────────────────────────────
// Admin API — Review / promote entity displaySafety
// POST /api/intelligence/admin/entities/:id/review
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { guardRetailPromotion } from "@/lib/intelligence/reviewIdentity";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { displaySafety, reviewedBy } = body;

  if (!displaySafety || !["INTERNAL_ONLY", "ANALYST_REVIEWED", "RETAIL_SAFE"].includes(displaySafety)) {
    return NextResponse.json(
      { error: "Invalid displaySafety. Must be INTERNAL_ONLY, ANALYST_REVIEWED, or RETAIL_SAFE" },
      { status: 400 }
    );
  }

  const entity = await prisma.canonicalEntity.findUnique({ where: { id } });
  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  // ── P0-B — garde commun aux trois voies de promotion retail ────────────────
  // Avant ce garde, cette route écrivait `reviewedBy ?? "admin"` et
  // `actor: admin:${reviewedBy ?? "unknown"}` : elle publiait au retail sous
  // une identité de rôle, sans garde PERSON. Refus AVANT toute écriture.
  const now = new Date();
  const guard = guardRetailPromotion({
    displaySafety,
    entityType: entity.type,
    value: entity.value,
    reviewedBy,
    now,
  });
  if (guard.promotes && !guard.ok) {
    return NextResponse.json(
      { error: guard.reason, code: guard.code },
      { status: guard.status }
    );
  }

  const updated = await prisma.canonicalEntity.update({
    where: { id },
    data: {
      displaySafety,
      ...(guard.promotes && guard.ok
        ? guard.stamp
        : { reviewedBy: reviewedBy ?? "admin", reviewedAt: now }),
    },
  });

  // Audit log
  await prisma.intelAuditLog.create({
    data: {
      actor:
        guard.promotes && guard.ok
          ? guard.actor
          : `admin:${reviewedBy ?? "unknown"}`,
      action: "entity.reviewed",
      targetType: "CanonicalEntity",
      targetId: id,
      detail: {
        from: entity.displaySafety,
        to: displaySafety,
        value: entity.value,
        type: entity.type,
        ...(guard.promotes && guard.ok
          ? { reviewedBy: guard.handle }
          : {}),
      },
    },
  });

  return NextResponse.json({
    id: updated.id,
    value: updated.value,
    type: updated.type,
    displaySafety: updated.displaySafety,
    reviewedBy: updated.reviewedBy,
    reviewedAt: updated.reviewedAt,
  });
}
