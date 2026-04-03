// ─────────────────────────────────────────────────────────────────────────────
// Admin API — Review / promote entity displaySafety
// POST /api/intelligence/admin/entities/:id/review
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

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

  const updated = await prisma.canonicalEntity.update({
    where: { id },
    data: {
      displaySafety,
      reviewedBy: reviewedBy ?? "admin",
      reviewedAt: new Date(),
    },
  });

  // Audit log
  await prisma.intelAuditLog.create({
    data: {
      actor: `admin:${reviewedBy ?? "unknown"}`,
      action: "entity.reviewed",
      targetType: "CanonicalEntity",
      targetId: id,
      detail: {
        from: entity.displaySafety,
        to: displaySafety,
        value: entity.value,
        type: entity.type,
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
