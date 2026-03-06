// src/lib/intel-vault/dedup.ts
import { prisma } from "@/lib/prisma";
import type { NormalizedRow } from "./types";

export async function upsertRows(rows: NormalizedRow[], batchId: string): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const key = {
      chain: row.chain as never,
      address: row.address,
      labelType: row.labelType as never,
      label: row.label,
      sourceUrl: row.sourceUrl ?? null,
    };

    const existing = await prisma.addressLabel.findUnique({
      where: { dedup_key: key },
    });

    if (existing) {
      // Merge evidence (append if new, no duplicate)
      let evidence = existing.evidence ?? "";
      if (row.evidence && !evidence.includes(row.evidence)) {
        evidence = [evidence, row.evidence].filter(Boolean).join(" | ");
      }
      await prisma.addressLabel.update({
        where: { dedup_key: key },
        data: { lastSeenAt: new Date(), evidence: evidence || null },
      });
      updated++;
    } else {
      await prisma.addressLabel.create({
        data: {
          ...row,
          chain: row.chain as never,
          labelType: row.labelType as never,
          confidence: row.confidence as never,
          visibility: row.visibility as never,
          tosRisk: row.tosRisk as never,
          batchId,
        },
      });
      created++;
    }
  }

  return { created, updated };
}
