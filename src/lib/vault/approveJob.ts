// src/lib/vault/approveJob.ts
import { prisma } from "@/lib/prisma";
import { rebuildCacheForAddresses } from "./vaultLookup";

const CHUNK_SIZE = parseInt(process.env.APPROVE_CHUNK_SIZE ?? "5000");

export async function runApproveJob(batchId: string): Promise<void> {
  try {
    await prisma.ingestionBatch.update({
      where: { id: batchId },
      data: { status: "processing", processingStartedAt: new Date(), processedRows: 0 },
    });

    const batch = await prisma.ingestionBatch.findUnique({
      where: { id: batchId },
      include: { rawDocuments: true },
    });
    if (!batch) throw new Error("Batch not found");

    // Parse raw document rows
    const raw = batch.rawDocuments[0];
    if (!raw) throw new Error("No raw document");
    const rows: Record<string, unknown>[] = JSON.parse(raw.content);
    const total = rows.length;

    let processed = 0;
    const touchedAddrs: { chain: string; address: string }[] = [];

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      for (const row of chunk) {
        const chain = String(row.chain ?? "unknown");
        const address = String(row.address ?? "");
        const labelType = String(row.labelType ?? "other");
        const label = String(row.label ?? "");
        if (!address) continue;
        touchedAddrs.push({ chain, address });
        await prisma.addressLabel.upsert({
          where: { dedup_key: { chain, address, labelType, label, sourceUrl: null } } as never,
          update: { lastSeenAt: new Date(), isActive: true },
          create: {
            chain, address, labelType, label,
            sourceName: String(row.sourceName ?? ""),
            sourceUrl: String(row.sourceUrl ?? "") || null,
            evidence: row.evidence ? String(row.evidence) : null,
            entityName: row.entityName ? String(row.entityName) : null,
            confidence: String(row.confidence ?? "low"),
            visibility: String(row.visibility ?? "internal_only"),
            license: row.license ? String(row.license) : null,
            tosRisk: String(row.tosRisk ?? "low"),
            isActive: true,
            batchId,
          },
        });
      }
      processed += chunk.length;
      await prisma.ingestionBatch.update({
        where: { id: batchId },
        data: { processedRows: processed },
      });
    }

    // Rebuild cache for touched addresses
    const uniqueAddrs = [...new Map(touchedAddrs.map(a => [`${a.chain}:${a.address}`, a])).values()];
    await rebuildCacheForAddresses(uniqueAddrs);

    await prisma.ingestionBatch.update({
      where: { id: batchId },
      data: { status: "approved", processingEndedAt: new Date(), processedRows: total, approvedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { action: "BATCH_APPROVE", actorId: "system", batchId, meta: JSON.stringify({ rows: total }) },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.ingestionBatch.update({
      where: { id: batchId },
      data: { status: "failed", errorMessage: msg, processingEndedAt: new Date() },
    }).catch(() => {});
    await prisma.auditLog.create({
      data: { action: "BATCH_APPROVE_FAILED", actorId: "system", batchId, meta: JSON.stringify({ error: msg }) },
    }).catch(() => {});
    throw err;
  }
}
