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

// ── LEGACY — horodatages non fiables comme preuve de dernière observation ───
//
// `intel_canonical_entities.lastSeenAt`, `intel_canonical_entities.updatedAt`
// et `intel_source_observations.lastVerifiedAt` sont désormais des champs
// LEGACY au sens suivant : ils ne prouvent PAS qu'une entité a été revue lors
// du dernier cycle.
//
// Depuis la garde `IS DISTINCT FROM` posée sur les deux `ON CONFLICT DO UPDATE`
// de `bulkUpsert`, une ligne dont rien n'a changé n'est plus réécrite — donc
// ces trois horodatages ne bougent plus. Ils datent le dernier CHANGEMENT, pas
// la dernière observation.
//
// DOCTRINE (actée) :
//   • fraîcheur d'une SOURCE ou d'un CYCLE  → JobRunLog / le cycle, pas ces champs
//   • état courant d'une ENTITÉ             → la ligne elle-même
//   • dernière confirmation PAR ENTITÉ      → NON GARANTIE aujourd'hui.
//     Dit explicitement pour qu'aucune sonde ne s'y adosse et ne produise un
//     faux positif — cf. reaper.ts:70, qui avait déjà REJETÉ ces trois champs
//     comme sondes, précisément parce qu'ils étaient réécrits à chaque run.
//
// Aucun rafraîchissement périodique ni `lastConfirmedCycleId` n'est introduit
// ici : ce serait une architecture nouvelle, et elle n'est pas décidée.
//
// Le même avertissement devrait figurer au point de DÉFINITION
// (`prisma/schema.prod.prisma`, modèles CanonicalEntity et SourceObservation).
// Ce fichier est un chemin GELÉ : le commentaire de schema demande une fenêtre
// de guard dédiée. Il est donc porté ici, au point d'écriture, en attendant.
//
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
  /** Entrées REÇUES de la source, avant déduplication. */
  recordsFetched: number;
  /**
   * NULL = INCONNU, pas zéro.
   *
   * `INSERT … ON CONFLICT` ne permet pas de distinguer proprement une ligne
   * insérée d'une ligne mise à jour : le seul procédé connu, `RETURNING
   * xmax = 0`, repose sur un détail d'implémentation non contractuel. Sur le
   * chemin bulk on ne devine donc pas — on publie NULL et on s'en tient à
   * `recordsAffected` / `recordsUnchanged`, qui sont mesurés.
   * Le chemin Prisma (< 500 lignes), lui, connaît la distinction : il rend des
   * chiffres.
   */
  recordsNew: number | null;
  recordsUpdated: number | null;
  recordsRemoved: number;
  /** Lignes réellement ÉCRITES par l'upsert d'observations (inserts + updates). */
  recordsAffected: number | null;
  /**
   * Lignes SOUMISES mais non écrites, écartées par la garde IS DISTINCT FROM.
   * Calculé sur la population soumise à l'upsert — donc APRÈS déduplication —
   * et jamais depuis `recordsFetched`, qui compte les entrées reçues avant
   * dédup : la soustraction confondrait sinon « inchangé » et « doublon ».
   */
  recordsUnchanged: number | null;
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
      recordsAffected: 0,
      recordsUnchanged: 0,
      error: `No fetcher for source: ${slug}`,
    };
  }

  let rows: SourceRaw[] = [];
  let recordsNew: number | null = 0;
  let recordsUpdated: number | null = 0;
  let recordsRemoved = 0;
  let recordsAffected: number | null = null;
  let recordsUnchanged: number | null = null;

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
      recordsAffected = result.recordsAffected;
      recordsUnchanged = result.recordsUnchanged;
    } else {
      const result = await prismaUpsert(unique, slug, now);
      recordsNew = result.recordsNew;
      recordsUpdated = result.recordsUpdated;
      recordsAffected = result.recordsAffected;
      recordsUnchanged = result.recordsUnchanged;
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
          // NULL = inconnu sur le chemin bulk — voir IngestResult.recordsNew.
          new: recordsNew,
          updated: recordsUpdated,
          removed: recordsRemoved,
          affected: recordsAffected,
          unchanged: recordsUnchanged,
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
      recordsAffected,
      recordsUnchanged,
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
      recordsAffected,
      recordsUnchanged,
      error: errorMsg,
    };
  }
}

// ── Bulk upsert via raw SQL (for large sources like ScamSniffer) ────────────

// Taille de lot du chemin bulk. Chaque lot coûte DEUX allers-retours Neon
// (upsert entités + id, puis upsert observations) : à 275 000 lignes, 5 000
// donne 55 lots soit 110 allers-retours, contre 1 650 avec l'ancien lot de 500
// et ses trois requêtes. Dimensionnement vérifié sur la production par EXPLAIN
// (sans ANALYZE, donc sans exécution) : à 5 000, l'instruction fait 0,48 Mo et
// se planifie en ~112 ms. 10 000 et 20 000 planifient aussi, mais le coût
// d'analyse croît plus vite que le gain (300 ms à 20 000) et l'instruction
// dépasse 1 Mo. `statement_timeout` vaut 0 sur cet endpoint, `work_mem` 4 Mo.
const BULK_CHUNK_SIZE = 5000;

// ── Amplification d'écriture ────────────────────────────────────────────────
// Les deux `ON CONFLICT DO UPDATE` ci-dessous portent une garde
// `WHERE (…) IS DISTINCT FROM (EXCLUDED.…)` : sans elle, chaque run réécrit
// TOUTES les lignes reçues, même strictement identiques — ~340 000 UPDATE par
// cycle ScamSniffer pour, en régime stationnaire, aucun changement de contenu.
//
// `IS DISTINCT FROM` et non `<>` : `<>` rend NULL dès qu'un opérande est NULL,
// donc NULL → valeur et valeur → NULL ne déclencheraient PAS l'UPDATE.
//
// La garde ne compare QUE les colonnes de CONTENU. Les horodatages de
// battement — `lastSeenAt`, `updatedAt`, `lastVerifiedAt` — valent `now()` à
// chaque run : les inclure rendrait la garde toujours vraie et n'économiserait
// rien. Conséquence assumée : sur une ligne inchangée, ces horodatages ne sont
// plus rafraîchis. Aucune logique métier n'en dépend (vérifié : seuls
// l'affichage admin et un `orderBy lastSeenAt desc` les lisent), et le reaper
// les a explicitement REJETÉS comme sonde (reaper.ts:70). Ses sondes retenues
// — `recordsFetched`, `ingestedAt`, `createdAt` — ne sont écrites qu'à
// l'INSERT et ne sont pas touchées par cette garde.
//
// Le marquage stale, donc `recordsRemoved`, est indexé sur
// `entity.value NOT IN (livraison)` et JAMAIS sur un horodatage : sa
// sémantique est inchangée.
async function bulkUpsert(
  records: SourceRaw[],
  slug: string,
  nowISO: string,
  batchId: string
): Promise<{
  recordsNew: null;
  recordsUpdated: null;
  recordsAffected: number;
  recordsUnchanged: number;
}> {
  // `INSERT … ON CONFLICT` ne distingue pas proprement insert et update : on ne
  // devine pas. On mesure ce qui est mesurable — lignes soumises, lignes
  // écrites — et on laisse le reste à NULL.
  let obsSubmitted = 0;
  let obsAffected = 0;

  const chunksN = chunk(records, BULK_CHUNK_SIZE);
  let processed = 0;
  let chunkIndex = 0;

  for (const ch of chunksN) {
    // 1. Upsert des entités ET récupération des id, en UNE requête.
    //
    // Le `RETURNING` d'un `ON CONFLICT` ne rend QUE les lignes réellement
    // écrites — or la garde `IS DISTINCT FROM` en écarte la quasi-totalité en
    // régime stationnaire (mesuré le 2026-08-26 : 206 lignes écrites sur
    // 275 000 soumises, soit 0,07 %). Un `RETURNING` nu ferait donc perdre
    // 99,93 % des id, et les observations correspondantes seraient
    // silencieusement abandonnées.
    //
    // D'où le CTE : `ins` porte les lignes écrites, et l'`UNION ALL` y ajoute
    // les lignes déjà présentes que la garde a écartées. Le SELECT extérieur
    // lit l'instantané d'avant l'instruction : il ne peut pas voir les lignes
    // insérées par `ins`, d'où l'absence de doublon — et le `NOT EXISTS` écarte
    // celles qui y sont déjà.
    const vValues = ch.map((r) => {
      const dk = buildDedupKey(r.entityType, r.value);
      return `(${esc(dk)}, ${esc(r.entityType)}, ${esc(r.value)}, ${esc(r.chain ?? null)}, ${esc(r.riskClass)})`;
    });

    const entitySQL = `
      WITH v("dedupKey", type, value, chain, "riskClass") AS (
        VALUES ${vValues.join(",\n")}
      ),
      ins AS (
        INSERT INTO intel_canonical_entities
          (id, type, value, chain, "riskClass", "strongestSource", "sourceCount", "firstSeenAt", "lastSeenAt", "dedupKey", "displaySafety", "isActive", "createdAt", "updatedAt")
        SELECT gen_random_uuid()::text, v.type::"IntelEntityType", v.value::text,
               v.chain::text, v."riskClass"::"IntelRiskClass", ${esc(slug)}, 1,
               '${nowISO}'::timestamptz, '${nowISO}'::timestamptz, v."dedupKey"::text,
               'INTERNAL_ONLY', true, now(), now()
          FROM v
        ON CONFLICT ("dedupKey") DO UPDATE SET
          "lastSeenAt" = '${nowISO}'::timestamptz,
          "isActive" = true,
          "updatedAt" = now()
        WHERE (intel_canonical_entities."isActive")
                IS DISTINCT FROM (EXCLUDED."isActive")
        RETURNING id, "dedupKey"
      )
      SELECT id, "dedupKey" FROM ins
      UNION ALL
      SELECT e.id, e."dedupKey"
        FROM intel_canonical_entities e
       WHERE e."dedupKey" IN (SELECT "dedupKey"::text FROM v)
         AND NOT EXISTS (SELECT 1 FROM ins WHERE ins."dedupKey" = e."dedupKey")
    `;

    const entities = await prisma.$queryRawUnsafe<
      { id: string; dedupKey: string }[]
    >(entitySQL);
    // Appariement par dedupKey, JAMAIS par position : l'UNION ALL ne garantit
    // aucun ordre.
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
        WHERE (
                intel_source_observations."riskClass",
                intel_source_observations.label,
                intel_source_observations."matchBasis",
                intel_source_observations."externalUrl",
                intel_source_observations."listIsActive"
              ) IS DISTINCT FROM (
                EXCLUDED."riskClass",
                EXCLUDED.label,
                EXCLUDED."matchBasis",
                EXCLUDED."externalUrl",
                EXCLUDED."listIsActive"
              )
      `;

      // Retour de $executeRawUnsafe = lignes RÉELLEMENT écrites : inserts +
      // updates, hors lignes écartées par la garde IS DISTINCT FROM. C'est
      // exactement `recordsAffected` — et ce n'est PAS `recordsUpdated`, qui
      // exigerait de séparer les deux.
      obsAffected += await prisma.$executeRawUnsafe(obsSQL);
      obsSubmitted += obsValues.length;
    }

    processed += ch.length;
    chunkIndex++;

    // Jalon de progression. Il coûte un aller-retour : avec un lot de 5 000,
    // l'écrire à chaque lot annulerait un tiers du gain. On l'écrit donc au
    // PREMIER lot — le reaper s'appuie sur `recordsFetched > 0` pour prouver
    // qu'un run mort avait écrit (reaper.ts) et cette sonde doit se poser tôt —
    // puis tous les 10 lots.
    if (chunkIndex === 1 || chunkIndex % 10 === 0) {
      await prisma.intelIngestionBatch.update({
        where: { id: batchId },
        data: {
          recordsFetched: processed,
        },
      });
    }
  }

  return {
    recordsNew: null,
    recordsUpdated: null,
    recordsAffected: obsAffected,
    recordsUnchanged: obsSubmitted - obsAffected,
  };
}

// ── Prisma-based upsert (for small sources <500 records) ────────────────────

async function prismaUpsert(
  records: SourceRaw[],
  slug: string,
  now: Date
): Promise<{
  recordsNew: number;
  recordsUpdated: number;
  recordsAffected: number;
  recordsUnchanged: number;
}> {
  let recordsNew = 0;
  let recordsUpdated = 0;

  const chunks50 = chunk(records, 50);
  for (const ch of chunks50) {
    const dedupKeys = ch.map((r) => buildDedupKey(r.entityType, r.value));

    const existingEntities = await prisma.canonicalEntity.findMany({
      where: { dedupKey: { in: dedupKeys } },
      include: {
        observations: {
          // `listIsActive` est LU, pas filtré ici : les deux calculs qui suivent
          // n'ont pas le même besoin. Le risque courant ne doit voir que les
          // observations actives ; `alreadyHasSource`, lui, doit voir AUSSI les
          // radiées — sinon une source qui re-livre après radiation serait prise
          // pour une source nouvelle et ferait dériver `sourceCount` à la hausse,
          // alors que l'upsert d'observation (unique sur entityId+sourceSlug) ne
          // fait que réactiver la ligne existante.
          select: { riskClass: true, sourceSlug: true, listIsActive: true },
        },
      },
    });
    const entityMap = new Map(existingEntities.map((e) => [e.dedupKey, e]));

    const ops: any[] = [];

    for (const raw of ch) {
      const dedupKey = buildDedupKey(raw.entityType, raw.value);
      const existing = entityMap.get(dedupKey);

      if (existing) {
        // Le résumé décrit ce qui est VRAI AUJOURD'HUI. Une observation radiée
        // — listIsActive=false, cas normal d'une sortie de liste OFAC — décrit
        // le passé : elle ne doit plus peser. Sans ce filtre, une SANCTION
        // radiée tirait le résumé à perpétuité (0xa5b0edf6…01d41, mesuré le
        // 2026-08-26 : riskClass=SANCTION, ofac radiée le 2026-08-15, seule une
        // observation forta HIGH encore active).
        // La livraison du jour (`raw`) est active par définition : elle amorce
        // le pli.
        let strongest = raw.riskClass;
        for (const obs of existing.observations) {
          if (!obs.listIsActive) continue;
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

  // Ce chemin ne porte AUCUNE garde : toute ligne soumise est écrite. Le
  // nombre d'écartées est donc structurellement 0 — ce n'est pas une
  // approximation, c'est la propriété du chemin.
  return {
    recordsNew,
    recordsUpdated,
    recordsAffected: recordsNew + recordsUpdated,
    recordsUnchanged: 0,
  };
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
