// ───────���──────────────────────────��──────────────────────────────────────────
// Case Intelligence — Ingest Pipeline
// Takes SourceRaw[] from any fetcher, deduplicates, upserts into
// CanonicalEntity + SourceObservation, tracks IntelIngestionBatch.
// ───���─────────────────��───────────────────────────────────────────────────────

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
  // amf + goplus stubs — skip silently
};

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

    // Upsert each row
    for (const raw of unique) {
      const dedupKey = buildDedupKey(raw.entityType, raw.value);

      // Upsert CanonicalEntity
      const existing = await prisma.canonicalEntity.findUnique({
        where: { dedupKey },
        include: { observations: { select: { riskClass: true, sourceSlug: true } } },
      });

      if (existing) {
        // Compute new strongest risk across all observations + this one
        let strongest = raw.riskClass;
        for (const obs of existing.observations) {
          strongest = strongerRisk(
            strongest,
            obs.riskClass as IntelRiskClass
          );
        }

        await prisma.canonicalEntity.update({
          where: { id: existing.id },
          data: {
            riskClass: strongest,
            strongestSource:
              strongest === raw.riskClass ? slug : existing.strongestSource,
            sourceCount: { increment: existing.observations.some(
              (o) => o.sourceSlug === slug
            ) ? 0 : 1 },
            lastSeenAt: now,
            isActive: true,
          },
        });

        // Upsert SourceObservation
        const existingObs = await prisma.sourceObservation.findUnique({
          where: {
            entityId_sourceSlug: {
              entityId: existing.id,
              sourceSlug: slug,
            },
          },
        });

        if (existingObs) {
          await prisma.sourceObservation.update({
            where: { id: existingObs.id },
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
          });
          recordsUpdated++;
        } else {
          await prisma.sourceObservation.create({
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
          });
          recordsNew++;
        }
      } else {
        // Create new entity + observation
        await prisma.canonicalEntity.create({
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
        });
        recordsNew++;
      }
    }

    // Mark entities from this source that weren't in this batch as removed
    // (important for OFAC delisting tracking)
    const freshValues = new Set(unique.map((r) => r.value));
    const staleObs = await prisma.sourceObservation.findMany({
      where: {
        sourceSlug: slug,
        listIsActive: true,
        entity: {
          value: { notIn: [...freshValues] },
        },
      },
      select: { id: true, entityId: true },
    });

    for (const obs of staleObs) {
      await prisma.sourceObservation.update({
        where: { id: obs.id },
        data: { listIsActive: false, removedAt: now },
      });
      recordsRemoved++;
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

// ── Ingest all sources ──��───────────────────────────────────────────────────

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
