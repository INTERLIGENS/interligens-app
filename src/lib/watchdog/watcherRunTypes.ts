// ─── Sonde C4 — le vocabulaire d'un run du Watcher ──────────────────────────
//
// CE FICHIER NE PARLE PAS À LA BASE. Il décrit la forme CIBLE d'une ligne
// `JobRunLog` telle que la sonde C4 la lira, et rien d'autre. Le câblage réel
// viendra après la migration ; d'ici là, la logique se prouve sur fixtures.
//
// ── POURQUOI UNE FORME CIBLE ET PAS LA TABLE ACTUELLE ─────────────────────
//
// `JobRunLog` aujourd'hui (prisma/schema.prod.prisma) porte : jobName, dryRun,
// startedAt, finishedAt, status, limitN, processed, createdDrafts, ambiguous,
// conflicts, errors, summaryJson. Il lui manque TOUT ce qui distingue un run
// vivant d'une écriture : `trigger`, `ingestionMode`, `source`, `scheduledAt`,
// `collectionStartedAt`, et les 7 métriques de rendement. Les colonnes
// manquantes sont recensées dans docs/prep/BUILD_WATCHDOG_C4_2026-08-25.md.
//
// ── LA LEÇON DU BLACKOUT 17→24 AOÛT, EN UNE PHRASE ────────────────────────
//
// L'ancienne sonde mesurait `MAX("discoveredAtUtc")` sur les candidats : une
// MESURE D'ÉCRITURE. Un backfill manuel de 261 lignes l'a repoussée de trois
// jours et a éteint l'alerte alors que le collecteur était mort. La fraîcheur
// doit donc se lire sur un RUN, jamais sur une donnée — et sur un run dont on
// peut prouver qu'il était LIVE et déclenché par le cron.

/** La source dont la sonde C4 juge la santé. */
export const SOURCE_WATCHER_V2 = "WATCHER_V2";

/** Ce qui a déclenché le run. Seul `CRON` prouve que l'ordonnanceur vit. */
export const TRIGGER = {
  CRON: "CRON",
  MANUAL: "MANUAL",
  BACKFILL: "BACKFILL",
} as const;

/** Nature du run. Seul `LIVE` prouve qu'on est allé chercher chez X. */
export const INGESTION_MODE = {
  LIVE: "LIVE",
  BACKFILL: "BACKFILL",
} as const;

/**
 * Taxonomie de statut.
 *
 * ⚠️ MINUSCULES, ET CE N'EST PAS UN GOÛT. Mesuré le 2026-08-25 sur
 * `ep-square-band` : la colonne `JobRunLog.status` ne contient que `disabled`
 * (117 lignes) et `success` (10), et le code en produit cinq, tous minuscules
 * (`running`, `success`, `completed_with_errors`, `error`, `disabled`).
 * Introduire `SUCCESS` majuscule créerait deux casses dans la même colonne et
 * casserait tout filtre SQL déjà écrit. La spec C4 les nomme en majuscules ;
 * c'est la casse du DOCUMENT, pas celle de la colonne.
 */
export const RUN_STATUS = {
  /** Run LIVE terminé, candidats produits. */
  SUCCESS: "success",
  /** Run LIVE terminé, zéro candidat — sain SEULEMENT si la collecte a eu lieu. */
  SUCCESS_ZERO_CANDIDATES: "success_zero_candidates",
  /** Cap posts X atteint : l'ordonnanceur vit, la collecte est bloquée. */
  CAPPED: "capped",
  /** Run interrompu en cours de collecte, avec écritures partielles. */
  PARTIAL: "partial",
  /** Run en erreur. */
  FAILED: "failed",
  /** Fauché par le reaper, écritures PROUVÉES. */
  TIMED_OUT_WITH_WRITES: "timed_out_with_writes",
  /** Fauché par le reaper, écritures INCONNUES — jamais lu comme « rien écrit ». */
  TIMED_OUT_UNKNOWN_WRITES: "timed_out_unknown_writes",
} as const;

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];

/**
 * Les seuls statuts qui peuvent porter `successfulFreshness`.
 *
 * `capped` en est ABSENT, volontairement et explicitement : un run capé est
 * VIVANT (le cron s'est déclenché) mais n'est PAS SAIN (rien n'a été collecté).
 * Confondre les deux est exactement ce qui a rendu la panne invisible.
 */
export const HEALTHY_STATUSES: readonly string[] = [
  RUN_STATUS.SUCCESS,
  RUN_STATUS.SUCCESS_ZERO_CANDIDATES,
];

/**
 * Une ligne de run, réduite à ce dont la sonde a besoin.
 *
 * Les quatre horodatages sont distincts et aucun n'est déductible d'un autre :
 *   • `scheduledAt`         — l'heure à laquelle ce run AURAIT dû partir.
 *   • `startedAt`           — l'ordonnanceur a bien déclenché la route.
 *   • `collectionStartedAt` — la première lecture X a réellement commencé.
 *   • `finishedAt`          — le run s'est terminé (quel que soit son statut).
 *
 * L'écart `startedAt` non nul / `collectionStartedAt` nul est la SIGNATURE
 * d'un bail budgétaire : le cron a tourné, la collecte n'a jamais commencé.
 * Aucune sonde à un seul horodatage ne peut voir cet état.
 */
export interface WatcherRunRecord {
  readonly id: string;
  readonly source: string;
  readonly trigger: string;
  readonly ingestionMode: string;
  readonly status: string;

  readonly scheduledAt: Date | null;
  readonly startedAt: Date | null;
  readonly collectionStartedAt: Date | null;
  readonly finishedAt: Date | null;

  // ── Métriques de rendement (spec §4) ──
  readonly handlesAttempted: number | null;
  readonly handlesSucceeded: number | null;
  readonly tweetsFetched: number | null;
  readonly newPostsObserved: number | null;
  readonly candidatesProduced: number | null;
  readonly xApiErrors: number | null;
  readonly durationMs: number | null;
}

/**
 * Normalise une étiquette avant comparaison.
 *
 * Défensif à dessein : le jour où un écrivain pose `CAPPED` au lieu de
 * `capped`, la sonde doit le RECONNAÎTRE, pas le laisser tomber dans
 * « statut inconnu » et se taire. Une sonde qui devient aveugle sur une
 * différence de casse reproduit exactement la panne qu'elle surveille.
 */
export function normalizeLabel(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** Le run est-il un run CRON + LIVE de WATCHER_V2 ? */
export function isCronLiveWatcherRun(run: WatcherRunRecord): boolean {
  return (
    normalizeLabel(run.source) === normalizeLabel(SOURCE_WATCHER_V2) &&
    normalizeLabel(run.trigger) === normalizeLabel(TRIGGER.CRON) &&
    normalizeLabel(run.ingestionMode) === normalizeLabel(INGESTION_MODE.LIVE)
  );
}

/**
 * Le run est-il RÉELLEMENT sain ?
 *
 * L'étiquette ne suffit pas. La spec exige que `success_zero_candidates`
 * s'appuie sur `tweetsFetched > 0` ET `handlesAttempted > 0` : sans ces deux
 * nombres, « zéro candidat » ne veut pas dire « rien à signaler », il veut
 * dire « rien n'a été regardé ». C'est le même mensonge que le blackout, dit
 * autrement — et un statut ne se croit pas sur parole.
 */
export function isHealthyRun(run: WatcherRunRecord): boolean {
  const status = normalizeLabel(run.status);
  if (status === RUN_STATUS.SUCCESS) return true;
  if (status !== RUN_STATUS.SUCCESS_ZERO_CANDIDATES) return false;
  return (run.tweetsFetched ?? 0) > 0 && (run.handlesAttempted ?? 0) > 0;
}

/**
 * Le run prétend-il être sain sans que ses métriques ne le soutiennent ?
 * Cet état est rapporté explicitement — il révèle un écrivain défectueux.
 */
export function isInconsistentZeroCandidateRun(run: WatcherRunRecord): boolean {
  return (
    normalizeLabel(run.status) === RUN_STATUS.SUCCESS_ZERO_CANDIDATES &&
    !isHealthyRun(run)
  );
}
