// ─────────────────────────────────────────────────────────────────────────────
// LE REAPER — clôture des batches d'ingestion restés « running ».
//
// LE DÉFAUT QU'IL CORRIGE
// -----------------------
// `ingestSource()` ouvre un batch en `running` (ingest.ts l.81), le passe à
// `success` (l.164) ou, sur exception, à `partial`/`failed` (l.206). Il n'y a
// AUCUN `finally`. Or la route porte `maxDuration = 300` : passé 300 s, la
// fonction serverless est TUÉE. Un kill n'est pas une exception JavaScript —
// ni le `success`, ni le `catch` ne s'exécutent. Le batch reste `running`
// pour toujours. Mesuré en production le 2026-08-21 : 10 batches zombies,
// dont 7 accumulés à raison d'un par jour depuis le 2026-08-15.
//
// CE QUE LE REAPER NE FAIT PAS
// ----------------------------
// Il ne prétend JAMAIS qu'un run s'est terminé proprement. Un batch tué à
// 300 s a laissé couler du contenu en base (entités + observations écrites
// chunk par chunk, chacun committé) mais son bookkeeping — `recordsFetched`,
// `recordsNew`, `recordsRemoved` — est incomplet ou absent. Le marquer
// `success` serait un mensonge ; le marquer `failed` en serait un autre,
// parce que les données, elles, sont bien passées.
//
// LA DISTINCTION CENTRALE — ET SA LIMITE HONNÊTE
// ----------------------------------------------
// Le reaper sépare deux cas :
//
//   `timed_out_with_writes`    — PREUVE POSITIVE que le run a écrit avant de
//                                mourir. Le contenu est en base, le compte ne
//                                l'est pas.
//   `timed_out_unknown_writes` — AUCUNE preuve positive d'écriture. Ce n'est
//                                PAS « il n'a rien écrit ». On ne peut pas
//                                prouver l'absence d'écriture : un run qui
//                                n'aurait fait que des UPDATE sur des lignes
//                                existantes, et serait mort avant le premier
//                                jalon de progression, ne laisse aucune trace
//                                durable. L'absence de preuve n'est pas la
//                                preuve de l'absence, et le statut le dit.
//
// C'est pourquoi il n'existe pas de statut `timed_out_no_writes` ici. Le
// nommer ainsi affirmerait un fait que les données ne portent pas.
//
// LES SONDES, ET POURQUOI CELLES-LÀ
// ---------------------------------
// Une sonde n'est retenue que si sa trace est DURABLE — non réécrite par les
// runs suivants. C'est le piège principal de ce diagnostic :
//
//   RETENUE  `recordsFetched > 0` — le compteur de progression (ingest.ts
//            l.309) n'est écrit qu'APRÈS le commit d'un chunk. S'il est
//            posé, des lignes sont passées. Immuable une fois le run mort.
//
//   RETENUE  `intel_source_observations.ingestedAt` dans la fenêtre — posé
//            par DEFAULT now() à l'INSERT, jamais touché par le
//            `ON CONFLICT DO UPDATE` (ingest.ts l.290-297). Durable.
//
//   RETENUE  `intel_canonical_entities.createdAt` dans la fenêtre — même
//            raison : le `ON CONFLICT` ne met à jour que `lastSeenAt`,
//            `isActive` et `updatedAt` (ingest.ts l.256-260). Durable.
//
//   REJETÉE  `lastSeenAt` / `updatedAt` / `lastVerifiedAt` — réécrits par
//            CHAQUE run ultérieur de la même source. Mesuré : le zombie du
//            08-20 ne « portait » plus que 3 612 entités le 08-21, le run
//            suivant ayant repris les 260 000 autres. Une sonde qui s'efface
//            transforme un zombie ayant écrit en zombie « sans écriture »
//            avec le temps. Elle ferait MENTIR le reaper.
//
// LE PIÈGE `recordsFetched IS NULL`
// ---------------------------------
// `recordsFetched` NE PEUT PAS servir seul de discriminant. Le jalon de
// progression ne se déclenche qu'à `processed % 5000 < 500` : une source de
// moins de 5 000 lignes ne l'atteint JAMAIS. Mesuré : les 2 zombies `ofac`
// d'avril (864 lignes) ont `recordsFetched = NULL` et ont pourtant écrit
// 225 et 372 observations. `NULL` y signifie « source trop petite pour le
// jalon », pas « rien écrit ». D'où les sondes B et C.
//
// LA FENÊTRE D'ATTRIBUTION
// ------------------------
// Les écritures ne sont comptées que jusqu'au démarrage du batch SUIVANT de
// la même source. Sans cette borne, un zombie s'attribuerait les écritures
// du run du lendemain — et tout batch deviendrait « with_writes ».
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";

/**
 * TTL — au-delà, un batch `running` est mort par construction.
 *
 * Justification, pas une intuition :
 *   - la route `/api/intelligence/ingest/[slug]` déclare `maxDuration = 300`.
 *     `startedAt` est posé À L'INTÉRIEUR de la fonction : le run dispose donc
 *     d'AU PLUS 300 s après `startedAt`. Un batch encore `running` bien après
 *     ne peut pas être vivant — son processus n'existe plus.
 *   - durées réelles des runs SAINS mesurées en production (2026-08-21) :
 *       ofac        : 10 s … 148 s   (8 runs, médiane ~10 s)
 *       scamsniffer : 184 s … 196 s  (2 runs, les seuls jamais terminés)
 *     Le plafond observé d'un run sain est donc ~196 s, sous les 300 s.
 *
 * 900 s = 3 × maxDuration. La borne de sûreté stricte serait 300 s ; le
 * facteur 3 absorbe le démarrage à froid, la mise en file et la dérive
 * d'horloge entre la fonction et Postgres, sans jamais risquer de faucher un
 * run vivant — il n'en existe pas au-delà de 300 s.
 */
export const REAPER_TTL_SECONDS = 900;

/** Marge ajoutée à maxDuration pour borner la fenêtre d'attribution. */
const ATTRIBUTION_WINDOW_SECONDS = 300 + 120;

export type ReapedStatus = "timed_out_with_writes" | "timed_out_unknown_writes";

export interface ReapVerdict {
  batchId: string;
  sourceSlug: string;
  startedAt: Date;
  ageSeconds: number;
  status: ReapedStatus;
  /** Sondes positives ayant établi la preuve d'écriture. Vide => unknown. */
  evidence: string[];
  entitiesCreated: number;
  observationsCreated: number;
  recordsFetched: number | null;
  /** `false` quand le calcul de recordsRemoved n'a jamais été tenté. */
  recordsRemovedWasComputable: boolean;
  errorMessage: string;
}

/**
 * Le calcul des retraits (`recordsRemoved`) est SAUTÉ par `ingestSource()`
 * pour toute source de 10 000 lignes ou plus (ingest.ts : `if (unique.length
 * < 10000)`). Pour ces sources, `recordsRemoved` n'a pas été « perdu par le
 * timeout » — il n'a jamais été calculé, même sur les runs `success`.
 * Vérifié : les 2 runs scamsniffer réussis d'avril portent `recordsRemoved = 0`.
 */
const STALE_MARKING_MAX_RECORDS = 10_000;

/** Sources dont le volume dépasse structurellement le seuil ci-dessus. */
const BULK_SOURCES = new Set(["scamsniffer"]);

export function recordsRemovedWasComputable(
  sourceSlug: string,
  recordsFetched: number | null
): boolean {
  if (BULK_SOURCES.has(sourceSlug)) return false;
  if (recordsFetched !== null && recordsFetched >= STALE_MARKING_MAX_RECORDS) {
    return false;
  }
  return true;
}

interface BatchRow {
  id: string;
  sourceSlug: string;
  startedAt: Date;
  recordsFetched: number | null;
}

/**
 * Borne haute de la fenêtre d'attribution : le démarrage du batch suivant de
 * la MÊME source, ou `startedAt + maxDuration + marge`, au plus tôt des deux.
 */
async function attributionWindowEnd(batch: BatchRow): Promise<Date> {
  const hardEnd = new Date(
    batch.startedAt.getTime() + ATTRIBUTION_WINDOW_SECONDS * 1000
  );

  const next = await prisma.intelIngestionBatch.findFirst({
    where: {
      sourceSlug: batch.sourceSlug,
      startedAt: { gt: batch.startedAt },
    },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });

  if (next && next.startedAt < hardEnd) return next.startedAt;
  return hardEnd;
}

/**
 * Établit, à partir de traces DURABLES uniquement, si le batch a écrit.
 * Ne renvoie jamais « n'a rien écrit » : seulement « prouvé » ou « non prouvé ».
 */
export async function collectWriteEvidence(batch: BatchRow): Promise<{
  evidence: string[];
  entitiesCreated: number;
  observationsCreated: number;
}> {
  const windowEnd = await attributionWindowEnd(batch);
  const range = { gte: batch.startedAt, lt: windowEnd };

  const [entitiesCreated, observationsCreated] = await Promise.all([
    prisma.canonicalEntity.count({ where: { createdAt: range } }),
    prisma.sourceObservation.count({
      where: { sourceSlug: batch.sourceSlug, ingestedAt: range },
    }),
  ]);

  const evidence: string[] = [];

  // Sonde A — compteur de progression, écrit après commit d'un chunk.
  if (batch.recordsFetched !== null && batch.recordsFetched > 0) {
    evidence.push(`recordsFetched=${batch.recordsFetched}`);
  }
  // Sonde B — observations insérées dans la fenêtre (ingestedAt immuable).
  if (observationsCreated > 0) {
    evidence.push(`observations_created=${observationsCreated}`);
  }
  // Sonde C — entités créées dans la fenêtre (createdAt immuable).
  if (entitiesCreated > 0) {
    evidence.push(`entities_created=${entitiesCreated}`);
  }

  return { evidence, entitiesCreated, observationsCreated };
}

/**
 * Établit le verdict d'un batch zombie SANS RIEN ÉCRIRE.
 * C'est la fonction que l'on veut pouvoir exécuter en dry-run.
 */
export async function judgeBatch(
  batch: BatchRow,
  now: Date
): Promise<ReapVerdict> {
  const ageSeconds = Math.floor(
    (now.getTime() - batch.startedAt.getTime()) / 1000
  );
  const { evidence, entitiesCreated, observationsCreated } =
    await collectWriteEvidence(batch);

  const hasWrites = evidence.length > 0;
  const status: ReapedStatus = hasWrites
    ? "timed_out_with_writes"
    : "timed_out_unknown_writes";

  const computable = recordsRemovedWasComputable(
    batch.sourceSlug,
    batch.recordsFetched
  );

  const errorMessage = hasWrites
    ? `Reaper: run tué hors fenêtre serverless (maxDuration=300s) après ${ageSeconds}s en 'running'. ` +
      `Écritures PROUVÉES (${evidence.join(", ")}) : le contenu a coulé, le bookkeeping est incomplet. ` +
      `Ingestion probablement TRONQUÉE — ce batch n'a jamais atteint sa finalisation. ` +
      (computable
        ? `recordsRemoved: UNKNOWN (perdu avec le run).`
        : `recordsRemoved: NON APPLICABLE (marquage stale sauté pour source >=${STALE_MARKING_MAX_RECORDS} lignes).`)
    : `Reaper: run tué hors fenêtre serverless (maxDuration=300s) après ${ageSeconds}s en 'running'. ` +
      `AUCUNE preuve d'écriture durable — absence de preuve, PAS preuve d'absence. ` +
      `Un run n'ayant fait que des UPDATE avant sa mort ne laisse aucune trace attribuable.`;

  return {
    batchId: batch.id,
    sourceSlug: batch.sourceSlug,
    startedAt: batch.startedAt,
    ageSeconds,
    status,
    evidence,
    entitiesCreated,
    observationsCreated,
    recordsFetched: batch.recordsFetched,
    recordsRemovedWasComputable: computable,
    errorMessage,
  };
}

export interface ReapOptions {
  /** Par défaut TRUE : le reaper n'écrit RIEN sans qu'on le lui demande. */
  dryRun?: boolean;
  ttlSeconds?: number;
  now?: Date;
}

export interface ReapReport {
  scanned: number;
  reaped: number;
  dryRun: boolean;
  ttlSeconds: number;
  verdicts: ReapVerdict[];
}

/**
 * Passe les batches `running` plus vieux que le TTL en statut terminal explicite.
 *
 * `dryRun` vaut TRUE par défaut — appeler `reapZombieBatches()` sans argument
 * n'écrit rien. L'écriture doit être demandée, jamais subie.
 */
export async function reapZombieBatches(
  opts: ReapOptions = {}
): Promise<ReapReport> {
  const dryRun = opts.dryRun ?? true;
  const ttlSeconds = opts.ttlSeconds ?? REAPER_TTL_SECONDS;
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - ttlSeconds * 1000);

  const zombies = await prisma.intelIngestionBatch.findMany({
    where: { status: "running", startedAt: { lt: cutoff } },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      sourceSlug: true,
      startedAt: true,
      recordsFetched: true,
    },
  });

  const verdicts: ReapVerdict[] = [];
  for (const z of zombies) {
    verdicts.push(await judgeBatch(z, now));
  }

  if (dryRun) {
    return { scanned: zombies.length, reaped: 0, dryRun, ttlSeconds, verdicts };
  }

  let reaped = 0;
  for (const v of verdicts) {
    // `completedAt` n'est PAS posé à now() : le run ne s'est pas terminé
    // maintenant, il est mort il y a longtemps. On l'ancre à la seule borne
    // que les données garantissent — la fin de la fenêtre serverless.
    const diedAt = new Date(v.startedAt.getTime() + 300 * 1000);
    await prisma.intelIngestionBatch.update({
      where: { id: v.batchId },
      data: {
        status: v.status,
        completedAt: diedAt,
        errorMessage: v.errorMessage.slice(0, 500),
      },
    });
    reaped += 1;
  }

  return { scanned: zombies.length, reaped, dryRun, ttlSeconds, verdicts };
}
