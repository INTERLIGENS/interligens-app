// ─── L'écrivain `JobRunLog` du Watcher V2 ────────────────────────────────────
//
// CE FICHIER EXISTE POUR UNE RAISON PRÉCISE. Du 17 au 24 août 2026 le Watcher
// est resté muet huit jours sans laisser UNE SEULE LIGNE en base. La sortie sur
// `capReached` faisait `return { ok: true, capReached: true }` — un JSON dans
// une réponse HTTP que personne ne lit, et rien d'autre. Le bridge, lui, avait
// déjà le bon motif : il écrit `JobRunLog status='disabled'` quand son kill
// switch est fermé, « visible dans l'audit, jamais un skip silencieux ».
//
// Ce module donne le même motif au watcher-v2, pour TOUS ses chemins de sortie.
//
// ── POURQUOI LA LOGIQUE EST ICI ET PAS DANS LA ROUTE ──────────────────────
//
// `src/app/api/` est un chemin GELÉ (scripts/guard-offline.sh). Tout ce qui peut
// être décidé et testé hors de la route l'est ici, dans `src/lib/watchdog/` qui
// ne l'est pas. La route ne garde que des appels — le patch sur le fichier gelé
// reste petit, relisible d'un coup d'œil, et la table de décision des statuts
// est testable sans monter une route Next.

import { expectedRunAtFor, DEFAULT_C4_CONFIG, type WatcherHealthConfig } from "./watcherHealthProbe";
import { RUN_STATUS, SOURCE_WATCHER_V2, TRIGGER, INGESTION_MODE, type RunStatus } from "./watcherRunTypes";

/**
 * `jobName` des lignes du watcher-v2.
 *
 * DISTINCT de `watcher_bridge_promote` : le bridge de 06:30 n'est pas le
 * collecteur de 06:00, et les confondre reviendrait à faire passer un job
 * vivant pour la preuve qu'un autre l'est. Cette valeur alimente aussi l'index
 * préexistant ("jobName","startedAt" DESC) — rien à ajouter pour l'utiliser.
 */
export const WATCHER_V2_JOB_NAME = "watcher_v2_scan";

/** Un handle de base minimal — PrismaClient le satisfait, un mock de test aussi. */
export interface WatcherRunWriterDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

// ─── Le trigger : pourquoi on suppose MANUAL et pas CRON ────────────────────
//
// L'invariant C4-6 dit qu'un run MANUEL réussi ne doit PAS remettre
// l'ordonnanceur au vert. Il ne tient que si `trigger` est juste. Les deux
// erreurs possibles ne coûtent pas la même chose :
//
//   • défaut CRON + détection ratée → un run manuel passe pour un run cron. La
//     sonde croit l'ordonnanceur vivant alors qu'il est mort. SILENCIEUX, faux,
//     et c'est EXACTEMENT le mode de panne du blackout d'août.
//   • défaut MANUAL + détection ratée → les runs cron passent pour manuels, la
//     sonde ne voit plus aucun run CRON+LIVE et crie CRITICAL. BRUYANT, faux,
//     mais visible en une nuit et corrigeable.
//
// Une sonde doit échouer fort, pas en silence. On ne marque donc `CRON` que sur
// PREUVE POSITIVE, et l'en-tête brut est conservé dans `summaryJson` pour qu'un
// échec de détection se diagnostique en une requête au lieu d'une enquête.
const VERCEL_CRON_UA = /^vercel-cron\//i;

export interface TriggerEvidence {
  readonly userAgent: string | null;
  /** En-tête `x-vercel-cron` si Vercel le pose. Preuve positive supplémentaire. */
  readonly vercelCronHeader: string | null;
  /** Forçage explicite (`?trigger=manual`), pour un appel de test délibéré. */
  readonly explicitTrigger: string | null;
}

export function resolveTrigger(ev: TriggerEvidence): string {
  const explicit = (ev.explicitTrigger ?? "").trim().toUpperCase();
  if (explicit === TRIGGER.CRON || explicit === TRIGGER.MANUAL || explicit === TRIGGER.BACKFILL) {
    return explicit;
  }
  if (ev.vercelCronHeader != null && ev.vercelCronHeader !== "") return TRIGGER.CRON;
  if (ev.userAgent != null && VERCEL_CRON_UA.test(ev.userAgent.trim())) return TRIGGER.CRON;
  return TRIGGER.MANUAL;
}

// ─── La table de décision des statuts ───────────────────────────────────────

/**
 * Ce que le run a réellement fait. Miroir exact des compteurs `stats` de la
 * route — aucun champ dérivé, aucune interprétation : l'interprétation est le
 * travail de `decideTerminalStatus`, et c'est elle qu'on teste.
 */
export interface ScanOutcome {
  /** L'usage X (`/2/usage/tweets`) est resté illisible après les retries. */
  readonly usageUnavailable: boolean;
  /** Plafond POSTS atteint AVANT la boucle — aucun handle traité. */
  readonly capReachedBeforeScan: boolean;
  /** Latch spend-cap X (403 masqué en « not found ») sur la sonde d'entrée. */
  readonly spendCapped: boolean;
  /** Plafond POSTS franchi PENDANT la boucle — des handles ont déjà été traités. */
  readonly cappedMidScan: boolean;
  /** Une exception a traversé `scanAll`. */
  readonly threw: boolean;

  readonly handlesAttempted: number;
  readonly handlesSucceeded: number;
  readonly tweetsFetched: number;
  readonly candidatesProduced: number;
}

/**
 * Le statut terminal, et rien d'autre.
 *
 * L'ORDRE DES TESTS EST LA SPÉCIFICATION. Un run peut satisfaire plusieurs
 * conditions à la fois (capé en cours de route ET zéro candidat) ; c'est le
 * premier test qui gagne, et il est choisi pour que le statut nomme la CAUSE la
 * plus actionnable, pas la conséquence la plus visible.
 */
export function decideTerminalStatus(o: ScanOutcome): RunStatus {
  // 1. Une exception prime sur tout : on ne sait pas ce qui a été écrit.
  if (o.threw) return RUN_STATUS.FAILED;

  // 2. Usage X illisible → `failed`, PAS `capped`. Ce choix est délibéré.
  //
  //    Le run s'arrête ici par fail-closed : le budget est INCONNU, pas épuisé.
  //    L'étiqueter `capped` ferait monter la sonde Budget (1 run → WARNING,
  //    2 → CRITICAL) et enverrait David dans la console de facturation X pour
  //    un incident RÉSEAU. `failed` nomme ce qui s'est passé — une dépendance
  //    externe injoignable — et alimente `consecutiveFailedRuns`, qui est le
  //    bon compteur. Le motif exact reste dans `summaryJson.exitReason`.
  if (o.usageUnavailable) return RUN_STATUS.FAILED;

  // 3. Les deux vraies sorties budgétaires, AVANT toute collecte.
  //    `collectionStartedAt` reste NULL sur ces chemins : c'est ce qui fait
  //    passer la sonde Collecteur en WARNING et rend l'invariant C4-2 vrai.
  if (o.spendCapped) return RUN_STATUS.CAPPED;
  if (o.capReachedBeforeScan) return RUN_STATUS.CAPPED;

  // 4. Plafond franchi EN COURS de boucle : le run a réellement collecté, puis
  //    s'est arrêté court. Ce n'est pas `capped` (il a produit du signal, et
  //    l'appeler `capped` effacerait ce travail), ce n'est pas un succès non
  //    plus (la watchlist n'a pas été parcourue). `partial` dit les deux.
  if (o.cappedMidScan) return RUN_STATUS.PARTIAL;

  // 5. Des handles ont été tentés et AUCUN n'a abouti : ce n'est pas un run
  //    « sans résultat », c'est un run qui n'a pas fonctionné.
  if (o.handlesAttempted > 0 && o.handlesSucceeded === 0) return RUN_STATUS.FAILED;

  // 6. Du signal produit → succès franc.
  if (o.candidatesProduced > 0) return RUN_STATUS.SUCCESS;

  // 7. Zéro candidat. Le statut le dit, et les métriques décideront s'il est
  //    SAIN : `isHealthyRun` exige tweetsFetched > 0 ET handlesAttempted > 0.
  //    On écrit donc le statut honnêtement même quand tweetsFetched vaut 0 —
  //    c'est la sonde, pas l'écrivain, qui refuse alors de le compter comme
  //    sain. Un écrivain qui maquillerait ce cas en `success` rejouerait le
  //    mensonge d'août : « zéro candidat » ne veut pas dire « rien à signaler »
  //    tant qu'on n'a pas prouvé que quelque chose a été regardé.
  return RUN_STATUS.SUCCESS_ZERO_CANDIDATES;
}

// ─── Écritures ──────────────────────────────────────────────────────────────
//
// TOUTES les valeurs temporelles passent par `$n::timestamptz AT TIME ZONE 'UTC'`
// (ou `now() AT TIME ZONE 'UTC'`), jamais par un `Date` laissé au driver ni par
// un `now()` nu.
//
// POURQUOI : les colonnes sont `timestamp without time zone`. Un `now()` nu rend
// l'heure de la SESSION ; une `Date` sérialisée par le driver dépend du driver.
// Les deux marchent tant que la session est en UTC — c'est-à-dire jusqu'au jour
// où elle ne l'est plus, et ce jour-là toutes les fraîcheurs de la sonde sont
// décalées sans que rien ne le signale. La forme explicite ci-dessous donne la
// même valeur quel que soit le `TimeZone` de la session.
//
// C'est le pendant, côté écriture, du `AT TIME ZONE 'UTC'` de l'adaptateur de
// lecture — et du défaut mesuré en production le 2026-08-25, où la même colonne
// se lisait 07:06 en base et 05:06 depuis Paris.

/** Horodatage UTC explicite, ou NULL. */
function utcParam(d: Date | null): string | null {
  return d == null ? null : d.toISOString();
}

export interface OpenRunOptions {
  readonly trigger: string;
  readonly ingestionMode?: string;
  /** Le rendez-vous que ce run honore. Par défaut : le créneau cron le plus récent échu. */
  readonly scheduledAt?: Date | null;
  readonly now?: Date;
  readonly config?: WatcherHealthConfig;
}

/**
 * Ouvre la ligne du run et rend son id.
 *
 * Rend `null` si l'écriture échoue — et ne relance JAMAIS. Le journal de run
 * est de l'observabilité : s'il tombe, le scan doit continuer. L'inverse
 * (une panne de sonde qui tue le collecteur qu'elle surveille) serait un très
 * mauvais échange. L'échec est logué, et l'absence de ligne est elle-même le
 * signal que la sonde remontera.
 */
export async function openWatcherRun(
  db: WatcherRunWriterDb,
  opts: OpenRunOptions,
): Promise<string | null> {
  const cfg = opts.config ?? DEFAULT_C4_CONFIG;
  const now = opts.now ?? new Date();
  const scheduledAt =
    opts.scheduledAt !== undefined ? opts.scheduledAt : expectedRunAtFor(now, cfg);
  try {
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "JobRunLog"
         ("jobName","dryRun","status","startedAt",
          "source","trigger","ingestionMode","scheduledAt")
       VALUES ($1, false, $2,
               (now() AT TIME ZONE 'UTC'),
               $3, $4, $5,
               ($6::timestamptz AT TIME ZONE 'UTC'))
       RETURNING id`,
      WATCHER_V2_JOB_NAME,
      "running",
      SOURCE_WATCHER_V2,
      opts.trigger,
      opts.ingestionMode ?? INGESTION_MODE.LIVE,
      utcParam(scheduledAt),
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error(
      "[watcher-v2] JobRunLog open failed (scan unaffected):",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Marque le début RÉEL de la collecte X.
 *
 * À n'appeler qu'au moment où la boucle sur les handles commence — PAS sur la
 * sonde d'entrée du spend-cap, qui est un contrôle et non une collecte. C'est
 * cette distinction qui donne à la sonde Collecteur sa signature de bail
 * budgétaire (`startedAt` non nul, `collectionStartedAt` nul) et qui rend
 * l'invariant C4-2 vrai. L'appeler trop tôt rendrait la sonde B aveugle.
 */
export async function markCollectionStarted(
  db: WatcherRunWriterDb,
  runId: string | null,
): Promise<void> {
  if (!runId) return;
  try {
    await db.$queryRawUnsafe(
      `UPDATE "JobRunLog"
          SET "collectionStartedAt" = (now() AT TIME ZONE 'UTC')
        WHERE id = $1 AND "collectionStartedAt" IS NULL`,
      runId,
    );
  } catch (err) {
    console.error(
      "[watcher-v2] JobRunLog collectionStartedAt failed (scan unaffected):",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export interface CloseRunMetrics {
  readonly handlesAttempted: number;
  readonly handlesSucceeded: number;
  readonly tweetsFetched: number;
  readonly newPostsObserved: number;
  readonly candidatesProduced: number;
  readonly xApiErrors: number;
  readonly durationMs: number;
  /** Le motif exact de la sortie, conservé pour l'audit. */
  readonly exitReason: string;
  /** Détail libre (les compteurs `stats` du run). */
  readonly summary?: Record<string, unknown>;
}

/** Ferme la ligne du run : statut terminal, `finishedAt`, et les 7 métriques. */
export async function closeWatcherRun(
  db: WatcherRunWriterDb,
  runId: string | null,
  status: RunStatus,
  m: CloseRunMetrics,
): Promise<void> {
  if (!runId) return;
  try {
    await db.$queryRawUnsafe(
      `UPDATE "JobRunLog"
          SET "status" = $2,
              "finishedAt" = (now() AT TIME ZONE 'UTC'),
              "handlesAttempted"   = $3,
              "handlesSucceeded"   = $4,
              "tweetsFetched"      = $5,
              "newPostsObserved"   = $6,
              "candidatesProduced" = $7,
              "xApiErrors"         = $8,
              "durationMs"         = $9,
              -- Colonnes historiques de la table, tenues cohérentes pour que
              -- les lectures génériques (processed, errors) ne mentent pas.
              "processed" = $4,
              "errors"    = $8,
              "summaryJson" = $10::jsonb
        WHERE id = $1`,
      runId,
      status,
      m.handlesAttempted,
      m.handlesSucceeded,
      m.tweetsFetched,
      m.newPostsObserved,
      m.candidatesProduced,
      m.xApiErrors,
      m.durationMs,
      JSON.stringify({ exitReason: m.exitReason, ...(m.summary ?? {}) }),
    );
  } catch (err) {
    console.error(
      "[watcher-v2] JobRunLog close failed (scan unaffected):",
      err instanceof Error ? err.message : String(err),
    );
  }
}
