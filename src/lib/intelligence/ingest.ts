// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Ingest Pipeline
// Takes SourceRaw[] from any fetcher, deduplicates, upserts into
// CanonicalEntity + SourceObservation, tracks IntelIngestionBatch.
// Uses raw SQL bulk upserts for high-volume sources (ScamSniffer: 344k).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildDedupKey } from "./normalize";
import type { SourceRaw } from "./sources/types";
import type { IntelRiskClass } from "./types";
import { SOURCES, type SourceSlug } from "./sources/registry";
import { fetchOfac } from "./sources/ofac";
import { fetchFca } from "./sources/fca";
import { fetchScamSniffer } from "./sources/scamsniffer";
import { fetchForta } from "./sources/forta";
import { fetchAmf } from "./sources/amf";

// ── Risk priority (lower index = stronger) ──────────────────────────────────
const RISK_ORDER: IntelRiskClass[] = [
  "SANCTION",
  "HIGH",
  "MEDIUM",
  "LOW",
  "UNKNOWN",
];

function strongerRisk(a: IntelRiskClass, b: IntelRiskClass): IntelRiskClass {
  return RISK_ORDER.indexOf(a) <= RISK_ORDER.indexOf(b) ? a : b;
}

// ── Fetcher registry ────────────────────────────────────────────────────────

const FETCHERS: Record<string, () => Promise<SourceRaw[]>> = {
  ofac: fetchOfac,
  amf: fetchAmf,
  fca: fetchFca,
  scamsniffer: fetchScamSniffer,
  forta: fetchForta,
};

// ── Chunk helper ────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// ── Escape for raw SQL ──────────────────────────────────────────────────────

function esc(v: string | null | undefined): string {
  if (v == null) return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

// ── Main ingest function ────────────────────────────────────────────────────

export interface IngestResult {
  batchId: string;
  sourceSlug: string;
  status: "success" | "partial" | "failed";
  recordsFetched: number;
  recordsNew: number;
  recordsUpdated: number;
  recordsRemoved: number;
  error?: string;
}

export async function ingestSource(
  slug: SourceSlug,
  triggeredBy: string = "manual"
): Promise<IngestResult> {
  const now = new Date();
  const nowISO = now.toISOString();

  // Create batch record
  const batch = await prisma.intelIngestionBatch.create({
    data: {
      sourceSlug: slug,
      startedAt: now,
      status: "running",
      triggeredBy,
    },
  });

  const fetcher = FETCHERS[slug];
  if (!fetcher) {
    await prisma.intelIngestionBatch.update({
      where: { id: batch.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: `No fetcher for source: ${slug}`,
      },
    });
    return {
      batchId: batch.id,
      sourceSlug: slug,
      status: "failed",
      recordsFetched: 0,
      recordsNew: 0,
      recordsUpdated: 0,
      recordsRemoved: 0,
      error: `No fetcher for source: ${slug}`,
    };
  }

  let rows: SourceRaw[] = [];
  let recordsNew = 0;
  let recordsUpdated = 0;
  let recordsRemoved = 0;

  try {
    rows = await fetcher();

    // Deduplicate by value within this batch
    const seen = new Set<string>();
    const unique: SourceRaw[] = [];
    for (const r of rows) {
      const key = `${r.entityType}:${r.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    }

    // Use raw SQL bulk upsert for large sources (>500 records)
    if (unique.length > 500) {
      const result = await bulkUpsert(unique, slug, nowISO, batch.id);
      recordsNew = result.recordsNew;
      recordsUpdated = result.recordsUpdated;
    } else {
      const result = await prismaUpsert(unique, slug, now);
      recordsNew = result.recordsNew;
      recordsUpdated = result.recordsUpdated;
    }

    // Mark stale observations (skip for very large sources — too expensive)
    if (unique.length < 10000) {
      const freshValues = unique.map((r) => r.value);
      if (freshValues.length > 0) {
        const staleObs = await prisma.sourceObservation.findMany({
          where: {
            sourceSlug: slug,
            listIsActive: true,
            entity: { value: { notIn: freshValues } },
          },
          select: { id: true },
        });
        if (staleObs.length > 0) {
          await prisma.sourceObservation.updateMany({
            where: { id: { in: staleObs.map((o) => o.id) } },
            data: { listIsActive: false, removedAt: now },
          });
          recordsRemoved = staleObs.length;
        }
      }
    }

    // Finalize batch
    await prisma.intelIngestionBatch.update({
      where: { id: batch.id },
      data: {
        status: "success",
        completedAt: new Date(),
        recordsFetched: rows.length,
        recordsNew,
        recordsUpdated,
        recordsRemoved,
      },
    });

    // Audit log
    await prisma.intelAuditLog.create({
      data: {
        actor: `cron:${slug}`,
        action: "ingest.completed",
        targetType: "IntelIngestionBatch",
        targetId: batch.id,
        detail: {
          fetched: rows.length,
          new: recordsNew,
          updated: recordsUpdated,
          removed: recordsRemoved,
        },
      },
    });

    return {
      batchId: batch.id,
      sourceSlug: slug,
      status: "success",
      recordsFetched: rows.length,
      recordsNew,
      recordsUpdated,
      recordsRemoved,
    };
  } catch (err: any) {
    const errorMsg = String(err?.message || err);

    await prisma.intelIngestionBatch.update({
      where: { id: batch.id },
      data: {
        status: rows.length > 0 ? "partial" : "failed",
        completedAt: new Date(),
        recordsFetched: rows.length,
        recordsNew,
        recordsUpdated,
        recordsRemoved,
        errorMessage: errorMsg.slice(0, 500),
      },
    });

    return {
      batchId: batch.id,
      sourceSlug: slug,
      status: rows.length > 0 ? "partial" : "failed",
      recordsFetched: rows.length,
      recordsNew,
      recordsUpdated,
      recordsRemoved,
      error: errorMsg,
    };
  }
}

// ── Bulk upsert via raw SQL (for large sources like ScamSniffer) ────────────

async function bulkUpsert(
  records: SourceRaw[],
  slug: string,
  nowISO: string,
  batchId: string
): Promise<{ recordsNew: number; recordsUpdated: number }> {
  let recordsNew = 0;
  let recordsUpdated = 0;

  const chunks500 = chunk(records, 500);
  let processed = 0;

  for (const ch of chunks500) {
    // 1. Bulk upsert CanonicalEntity
    const entityValues = ch.map((r) => {
      const dk = buildDedupKey(r.entityType, r.value);
      return `(gen_random_uuid()::text, ${esc(r.entityType)}, ${esc(r.value)}, ${esc(r.chain ?? null)}, ${esc(r.riskClass)}, ${esc(slug)}, 1, '${nowISO}'::timestamptz, '${nowISO}'::timestamptz, ${esc(dk)}, 'INTERNAL_ONLY', true, now(), now())`;
    });

    const entitySQL = `
      INSERT INTO intel_canonical_entities
        (id, type, value, chain, "riskClass", "strongestSource", "sourceCount", "firstSeenAt", "lastSeenAt", "dedupKey", "displaySafety", "isActive", "createdAt", "updatedAt")
      VALUES ${entityValues.join(",\n")}
      ON CONFLICT ("dedupKey") DO UPDATE SET
        "lastSeenAt" = '${nowISO}'::timestamptz,
        "isActive" = true,
        "updatedAt" = now()
    `;

    await prisma.$executeRawUnsafe(entitySQL);

    // 2. Look up entity IDs for this chunk
    const dedupKeys = ch.map((r) => buildDedupKey(r.entityType, r.value));
    const entities = await prisma.canonicalEntity.findMany({
      where: { dedupKey: { in: dedupKeys } },
      select: { id: true, dedupKey: true },
    });
    const dkToId = new Map(entities.map((e) => [e.dedupKey, e.id]));

    // 3. Bulk upsert SourceObservation
    const obsValues: string[] = [];
    for (const r of ch) {
      const dk = buildDedupKey(r.entityType, r.value);
      const entityId = dkToId.get(dk);
      if (!entityId) continue;

      obsValues.push(
        `(gen_random_uuid()::text, ${esc(entityId)}, ${esc(slug)}, ${r.sourceTier}, ${esc(r.riskClass)}, ${esc(r.label ?? null)}, ${esc(r.matchBasis)}, ${esc(r.externalUrl ?? null)}, ${esc(r.externalId ?? null)}, ${esc(r.jurisdiction ?? null)}, ${esc(r.listType ?? null)}, true, now(), ${r.observedAt ? `'${r.observedAt.toISOString()}'::timestamptz` : "NULL"})`
      );
    }

    if (obsValues.length > 0) {
      const obsSQL = `
        INSERT INTO intel_source_observations
          (id, "entityId", "sourceSlug", "sourceTier", "riskClass", label, "matchBasis", "externalUrl", "externalId", jurisdiction, "listType", "listIsActive", "ingestedAt", "observedAt")
        VALUES ${obsValues.join(",\n")}
        ON CONFLICT ("entityId", "sourceSlug") DO UPDATE SET
          "riskClass" = EXCLUDED."riskClass",
          label = EXCLUDED.label,
          "matchBasis" = EXCLUDED."matchBasis",
          "externalUrl" = EXCLUDED."externalUrl",
          "listIsActive" = true,
          "lastVerifiedAt" = now()
      `;

      const affected = await prisma.$executeRawUnsafe(obsSQL);
      // ON CONFLICT counts as updated, pure inserts as new
      // approximate: affected = total rows touched
      recordsNew += obsValues.length;
    }

    processed += ch.length;

    // Progress update every 5000 records
    if (processed % 5000 < 500) {
      await prisma.intelIngestionBatch.update({
        where: { id: batchId },
        data: {
          recordsFetched: processed,
          recordsNew,
        },
      });
    }
  }

  return { recordsNew, recordsUpdated };
}

// ── Prisma-based upsert (for small sources <500 records) ────────────────────

async function prismaUpsert(
  records: SourceRaw[],
  slug: string,
  now: Date
): Promise<{ recordsNew: number; recordsUpdated: number }> {
  let recordsNew = 0;
  let recordsUpdated = 0;

  const chunks50 = chunk(records, 50);
  for (const ch of chunks50) {
    const dedupKeys = ch.map((r) => buildDedupKey(r.entityType, r.value));

    const existingEntities = await prisma.canonicalEntity.findMany({
      where: { dedupKey: { in: dedupKeys } },
      include: {
        observations: {
          select: { riskClass: true, sourceSlug: true },
        },
      },
    });
    const entityMap = new Map(existingEntities.map((e) => [e.dedupKey, e]));

    const ops: any[] = [];

    for (const raw of ch) {
      const dedupKey = buildDedupKey(raw.entityType, raw.value);
      const existing = entityMap.get(dedupKey);

      if (existing) {
        let strongest = raw.riskClass;
        for (const obs of existing.observations) {
          strongest = strongerRisk(strongest, obs.riskClass as IntelRiskClass);
        }

        const alreadyHasSource = existing.observations.some(
          (o) => o.sourceSlug === slug
        );

        ops.push(
          prisma.canonicalEntity.update({
            where: { id: existing.id },
            data: {
              riskClass: strongest,
              strongestSource:
                strongest === raw.riskClass ? slug : existing.strongestSource,
              sourceCount: alreadyHasSource
                ? existing.sourceCount
                : existing.sourceCount + 1,
              lastSeenAt: now,
              isActive: true,
            },
          })
        );

        if (alreadyHasSource) {
          ops.push(
            prisma.sourceObservation.update({
              where: {
                entityId_sourceSlug: {
                  entityId: existing.id,
                  sourceSlug: slug,
                },
              },
              data: {
                riskClass: raw.riskClass,
                label: raw.label,
                matchBasis: raw.matchBasis,
                externalUrl: raw.externalUrl,
                jurisdiction: raw.jurisdiction,
                listType: raw.listType,
                listIsActive: true,
                lastVerifiedAt: now,
                meta: (raw.meta as any) ?? undefined,
              },
            })
          );
          recordsUpdated++;
        } else {
          ops.push(
            prisma.sourceObservation.create({
              data: {
                entityId: existing.id,
                sourceSlug: slug,
                sourceTier: raw.sourceTier,
                riskClass: raw.riskClass,
                label: raw.label,
                matchBasis: raw.matchBasis,
                externalUrl: raw.externalUrl,
                externalId: raw.externalId,
                jurisdiction: raw.jurisdiction,
                listType: raw.listType,
                listIsActive: true,
                observedAt: raw.observedAt,
                meta: (raw.meta as any) ?? undefined,
              },
            })
          );
          recordsNew++;
        }
      } else {
        ops.push(
          prisma.canonicalEntity.create({
            data: {
              type: raw.entityType,
              value: raw.value,
              chain: raw.chain,
              riskClass: raw.riskClass,
              strongestSource: slug,
              sourceCount: 1,
              firstSeenAt: now,
              lastSeenAt: now,
              dedupKey,
              observations: {
                create: {
                  sourceSlug: slug,
                  sourceTier: raw.sourceTier,
                  riskClass: raw.riskClass,
                  label: raw.label,
                  matchBasis: raw.matchBasis,
                  externalUrl: raw.externalUrl,
                  externalId: raw.externalId,
                  jurisdiction: raw.jurisdiction,
                  listType: raw.listType,
                  listIsActive: true,
                  observedAt: raw.observedAt,
                  meta: (raw.meta as any) ?? undefined,
                },
              },
            },
          })
        );
        recordsNew++;
      }
    }

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }
  }

  return { recordsNew, recordsUpdated };
}

// ── Ingest all sources ──────────────────────────────────────────────────────

export async function ingestAll(
  triggeredBy: string = "manual"
): Promise<IngestResult[]> {
  const slugs = Object.keys(FETCHERS) as SourceSlug[];
  const results: IngestResult[] = [];

  for (const slug of slugs) {
    results.push(await ingestSource(slug, triggeredBy));
  }

  return results;
}
