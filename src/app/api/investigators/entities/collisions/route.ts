import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
} from "@/lib/vault/auth.server";

export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const caseId = url.searchParams.get("caseId");
  if (!caseId) {
    return NextResponse.json({ error: "caseId_required" }, { status: 400 });
  }
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  try {
    const mine = await prisma.vaultCaseEntity.findMany({
      where: { caseId },
      select: { value: true },
      take: 2000,
    });
    const values = Array.from(new Set(mine.map((m) => m.value)));
    if (values.length === 0) {
      return NextResponse.json({ hasCollisions: false, collisionCount: 0 });
    }

    const collisions = await prisma.vaultCaseEntity.findMany({
      where: {
        value: { in: values },
        case: {
          workspaceId: { not: ctx.workspace.id },
        },
      },
      select: { value: true },
      take: 2000,
    });

    const uniqueCollisionValues = new Set(collisions.map((c) => c.value));
    return NextResponse.json({
      hasCollisions: uniqueCollisionValues.size > 0,
      collisionCount: uniqueCollisionValues.size,
    });
  } catch (err) {
    console.error("[entities/collisions] failed", err);
    return NextResponse.json({ hasCollisions: false, collisionCount: 0 });
  }
}
