// src/lib/intel-vault/dedup.ts
import { prisma } from "@/lib/prisma";
import type { NormalizedRow } from "./types";

const CHUNK = 500;

export async function upsertRows(rows: NormalizedRow[], batchId: string): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // Process in chunks to avoid query size limits
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);

    // Fetch existing by address+chain bulk
    const addresses = chunk.map(r => r.address);
    const existing = await prisma.addressLabel.findMany({
      where: { address: { in: addresses } },
      select: { id: true, address: true, chain: true, labelType: true, label: true, sourceUrl: true, evidence: true },
    });

    const existingMap = new Map(
      existing.map(e => [`${e.chain}:${e.address}:${e.labelType}:${e.label}:${e.sourceUrl ?? ""}`, e])
    );

    const toCreate: NormalizedRow[] = [];

    for (const row of chunk) {
      const key = `${row.chain}:${row.address}:${row.labelType}:${row.label}:${row.sourceUrl ?? ""}`;
      const ex = existingMap.get(key);
      if (ex) {
        let evidence = ex.evidence ?? "";
        if (row.evidence && !evidence.includes(row.evidence)) {
          evidence = [evidence, row.evidence].filter(Boolean).join(" | ");
        }
        await prisma.addressLabel.update({
          where: { id: ex.id },
          data: { lastSeenAt: new Date(), evidence: evidence || null },
        });
        updated++;
      } else {
        toCreate.push(row);
      }
    }

    if (toCreate.length > 0) {
      const result = await prisma.addressLabel.createMany({
        data: toCreate.map(row => ({
          ...row,
          chain: row.chain as never,
          labelType: row.labelType as never,
          confidence: row.confidence as never,
          visibility: row.visibility as never,
          tosRisk: row.tosRisk as never,
          batchId,
        })),
        skipDuplicates: true as never,
      });
      created += result.count;
    }
  }

  return { created, updated };
}
