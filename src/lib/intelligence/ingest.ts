// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Ingest Pipeline
// Takes SourceRaw[] from any fetcher, deduplicates, upserts into
// CanonicalEntity + SourceObservation, tracks IntelIngestionBatch.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { buildDedupKey } from "./normalize";
import type { SourceRaw } from "./sources/types";
import type { IntelRiskClass } from "./types";
import { SOURCES, type SourceSlug } from "./sources/registry";
import { fetchOfac } from "./sources/ofac";
import { fetchFca } from "./sources/fca";
import { fetchScamSniffer } from "./sources/scamsniffer";
import { fetchForta } from "./sources/forta";

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

    // Process in chunks of 50 to reduce round-trips
    const chunks = chunk(unique, 50);
    for (const batch of chunks) {
      // Gather all dedupKeys for this chunk to do a single lookup
      const dedupKeys = batch.map((r) => buildDedupKey(r.entityType, r.value));

      const existingEntities = await prisma.canonicalEntity.findMany({
        where: { dedupKey: { in: dedupKeys } },
        include: {
          observations: {
            select: { riskClass: true, sourceSlug: true },
          },
        },
      });
      const entityMap = new Map(existingEntities.map((e) => [e.dedupKey, e]));

      // Build transaction operations for this chunk
      const ops: any[] = [];

      for (const raw of batch) {
        const dedupKey = buildDedupKey(raw.entityType, raw.value);
        const existing = entityMap.get(dedupKey);

        if (existing) {
          // Compute new strongest risk
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

          // Upsert SourceObservation via unique constraint
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
          // Create new entity + observation
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

      // Execute chunk as a single transaction
      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }
    }

    // Mark entities from this source that weren't in this batch as removed
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
