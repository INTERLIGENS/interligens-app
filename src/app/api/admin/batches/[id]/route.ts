// src/app/api/admin/batches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const deny = requireAdminApi(req);
  if (deny) return deny;
const batch = await prisma.ingestionBatch.findUnique({
    where: { id: (await params).id },
    include: { rawDocuments: { take: 1 } },
  });

  if (!batch) return NextResponse.json({ error: "Batch introuvable" }, { status: 404 });

  // Parse sample rows from raw document
  let sample: unknown[] = [];
  let topLabels: Record<string, number> = {};
  let chains: Record<string, number> = {};

  const raw = batch.rawDocuments[0]?.content;
  if (raw) {
    try {
      const rows = JSON.parse(raw) as Array<{ chain: string; labelType: string; label: string }>;
      sample = rows.slice(0, 10);
      for (const r of rows) {
        chains[r.chain] = (chains[r.chain] ?? 0) + 1;
        topLabels[r.labelType] = (topLabels[r.labelType] ?? 0) + 1;
      }
    } catch {}
  }

  return NextResponse.json({
    id: batch.id,
    status: batch.status,
    inputType: batch.inputType,
    totalRows: batch.totalRows,
    matchedAddrs: batch.matchedAddrs,
    dedupedRows: batch.dedupedRows,
    warnings: batch.warnings ? JSON.parse(batch.warnings) : [],
    approvedBy: batch.approvedBy,
    approvedAt: batch.approvedAt,
    createdAt: batch.createdAt,
    chains,
    topLabels,
    sample,
  });
}
