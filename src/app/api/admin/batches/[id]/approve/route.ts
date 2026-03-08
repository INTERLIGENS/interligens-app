import { runApproveJob } from "@/lib/vault/approveJob";
// src/app/api/admin/batches/[id]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { upsertRows } from "@/lib/intel-vault/dedup";
import { rebuildCacheForAddresses } from "@/lib/vault/vaultLookup";
import type { NormalizedRow } from "@/lib/intel-vault/types";
import crypto from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const deny = requireAdminApi(req);
  if (deny) return deny;
const batch = await prisma.ingestionBatch.findUnique({
    where: { id: (await params).id },
    include: { rawDocuments: { take: 1 } },
  });

  if (!batch) return NextResponse.json({ error: "Batch introuvable" }, { status: 404 });
  if (batch.status === "approved") {
    return NextResponse.json({ error: "Batch déjà approuvé" }, { status: 409 });
  }

  const raw = batch.rawDocuments[0]?.content;
  if (!raw) return NextResponse.json({ error: "Aucune donnée dans le batch" }, { status: 422 });

  let rows: NormalizedRow[];
  try {
    rows = JSON.parse(raw) as NormalizedRow[];
  } catch {
    return NextResponse.json({ error: "Données corrompues" }, { status: 422 });
  }

  const { created, updated } = await upsertRows(rows, (await params).id);

  // Invalidate cache — single query with IN clause
  const addresses = rows.map(r => r.address);
  await prisma.riskSummaryCache.deleteMany({ where: { address: { in: addresses } } });
  // Rebuild cache only for small batches to avoid timeout
  if (rows.length <= 200) {
    await rebuildCacheForAddresses(rows.map(r => ({ chain: r.chain, address: r.address })));
  }

  const actorToken = req.headers.get("x-admin-token") ?? "admin";
  const actorId = crypto.createHash("sha256").update(actorToken).digest("hex").slice(0, 12);

  await prisma.ingestionBatch.update({
    where: { id: (await params).id },
    data: {
      status: "approved",
      approvedBy: actorId,
      approvedAt: new Date(),
      dedupedRows: updated,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "approve_batch",
      actorId,
      batchId: (await params).id,
      meta: JSON.stringify({ created, updated, total: rows.length }),
    },
  });

  return NextResponse.json({
    success: true,
    batchId: (await params).id,
    created,
    updated,
    total: rows.length,
  });
}
