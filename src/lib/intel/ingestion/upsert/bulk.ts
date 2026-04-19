/**
 * Shared bulk-upsert helpers for Intel ingestors.
 *
 * Every P0 source writes to AddressLabel or DomainLabel in large chunks.
 * Going through prisma.upsert() row-by-row is 10-100x slower than a single
 * `INSERT … ON CONFLICT DO UPDATE` batch, so all ingestors route through
 * here.
 *
 * Inputs are pre-deduplicated by the caller. Dedup key matches the
 * composite unique index on each table.
 */

import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

const CHUNK = 1000;

export type AddressLabelRow = {
  address: string;
  chain: string;
  labelType: string;
  label: string;
  confidence: "low" | "medium" | "high";
  category?: string | null;
  entityName?: string | null;
  sourceName: string;
  sourceUrl: string;
  evidence?: string | null;
  visibility?: string;
  license?: string | null;
};

export type DomainLabelRow = {
  domain: string;
  labelType: string;
  label: string;
  confidence: "low" | "medium" | "high";
  category?: string | null;
  entityName?: string | null;
  sourceName: string;
  sourceUrl: string;
  evidence?: string | null;
  visibility?: string;
  license?: string | null;
};

export async function bulkUpsertAddressLabels(rows: AddressLabelRow[]): Promise<{ upserted: number; errors: number }> {
  let upserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];
    const now = new Date();
    for (const r of batch) {
      const idx = params.length;
      params.push(
        randomUUID(),
        r.chain,
        r.address,
        r.labelType,
        r.label,
        r.confidence,
        r.entityName ?? null,
        r.sourceName,
        r.sourceUrl,
        r.evidence ?? null,
        r.visibility ?? "public",
        r.license ?? null,
        "low",
        true,
        now,
        now,
      );
      values.push(
        `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5},` +
        ` $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10},` +
        ` $${idx + 11}, $${idx + 12}, $${idx + 13}, $${idx + 14}, $${idx + 15},` +
        ` $${idx + 16})`,
      );
    }
    const sql = `INSERT INTO "AddressLabel" (
        "id", "chain", "address", "labelType", "label", "confidence",
        "entityName", "sourceName", "sourceUrl", "evidence",
        "visibility", "license", "tosRisk", "isActive",
        "firstSeenAt", "lastSeenAt"
      ) VALUES ${values.join(",")}
      ON CONFLICT ("chain", "address", "labelType", "label", "sourceUrl")
      DO UPDATE SET "isActive" = TRUE, "lastSeenAt" = EXCLUDED."lastSeenAt";`;
    try {
      await prisma.$executeRawUnsafe(sql, ...params);
      upserted += batch.length;
    } catch (err) {
      errors += batch.length;
      console.error("[address-bulk] batch failed", err);
    }
  }
  return { upserted, errors };
}

export async function bulkUpsertDomainLabels(rows: DomainLabelRow[]): Promise<{ upserted: number; errors: number }> {
  let upserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];
    const now = new Date();
    for (const r of batch) {
      const idx = params.length;
      params.push(
        randomUUID(),
        r.domain,
        r.labelType,
        r.label,
        r.confidence,
        r.category ?? null,
        r.entityName ?? null,
        r.sourceName,
        r.sourceUrl,
        r.evidence ?? null,
        r.visibility ?? "public",
        r.license ?? null,
        "low",
        true,
        now,
        now,
      );
      values.push(
        `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5},` +
        ` $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10},` +
        ` $${idx + 11}, $${idx + 12}, $${idx + 13}, $${idx + 14}, $${idx + 15},` +
        ` $${idx + 16})`,
      );
    }
    const sql = `INSERT INTO "DomainLabel" (
        "id", "domain", "labelType", "label", "confidence", "category",
        "entityName", "sourceName", "sourceUrl", "evidence",
        "visibility", "license", "tosRisk", "isActive",
        "firstSeenAt", "lastSeenAt"
      ) VALUES ${values.join(",")}
      ON CONFLICT ("domain", "labelType", "label", "sourceUrl")
      DO UPDATE SET "isActive" = TRUE, "lastSeenAt" = EXCLUDED."lastSeenAt";`;
    try {
      await prisma.$executeRawUnsafe(sql, ...params);
      upserted += batch.length;
    } catch (err) {
      errors += batch.length;
      console.error("[domain-bulk] batch failed", err);
    }
  }
  return { upserted, errors };
}
