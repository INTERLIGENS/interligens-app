// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/intelligence/safety
// Update displaySafety for a CanonicalEntity.
// PERSON-type entities: gate at Prisma query level, never retail-visible.
// Auth: requireAdminApi
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

const VALID_SAFETY_VALUES = ["INTERNAL_ONLY", "ANALYST_REVIEWED", "RETAIL_SAFE"];

export async function PATCH(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: { entityId: string; displaySafety: string };
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
    select: { id: true, type: true },
  });

  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  // PERSON-type entities: NEVER set to RETAIL_SAFE
  if (entity.type === "PERSON" && body.displaySafety === "RETAIL_SAFE") {
    return NextResponse.json(
      { error: "PERSON-type entities cannot be set to RETAIL_SAFE" },
      { status: 403 }
    );
  }

  const updated = await prisma.canonicalEntity.update({
    where: { id: body.entityId },
    data: { displaySafety: body.displaySafety as any },
  });

  // Audit log
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
