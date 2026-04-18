import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace } from "@/lib/vault/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/investigators/audit/mine
// Returns the 100 most recent audit entries that belong to the caller's
// workspace (via investigatorAccessId OR workspaceId). The `ipAddress`
// field is hashed before storage (see logAudit → hashIP), so we can return
// it as-is — it's an opaque identifier, not a raw IP.
export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await prisma.vaultAuditLog.findMany({
    where: {
      OR: [
        { investigatorAccessId: ctx.access.id },
        { workspaceId: ctx.workspace.id },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      actor: true,
      ipAddress: true,
      userAgent: true,
      caseId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ entries: rows });
}
