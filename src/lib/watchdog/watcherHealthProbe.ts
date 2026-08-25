// ─── Sonde C4 — la santé du Watcher se juge sur des RUNS, pas sur des lignes ──
//
// CE FICHIER NE PARLE PAS À LA BASE. Il prend une fenêtre de `WatcherRunRecord`
// (forme CIBLE de `JobRunLog`, cf. watcherRunTypes.ts) et rend un verdict
// structuré. Le câblage SQL viendra après la migration ; la logique, elle, se
// prouve dès maintenant sur fixtures — c'est tout l'objet des tests C4.
//
// ── CE QUE CETTE SONDE CORRIGE ────────────────────────────────────────────
//
// L'ancienne sonde (src/scripts/watchdog/watcher-health.mjs, check n°1) lit
// `MAX("discoveredAtUtc")` sur `social_post_candidates`. C'est une mesure
// d'ÉCRITURE, et une écriture ne prouve rien sur qui l'a produite : le
// 2026-08-21, 261 lignes insérées à la main depuis un poste local ont repoussé
// ce maximum de trois jours et éteint l'alerte alors que le collecteur était
// mort depuis le 17. Une sonde falsifiable par un backfill n'est pas une sonde.
//
// Deux conséquences de conception, non négociables :
//
//   1. La fraîcheur se lit sur un run dont on peut PROUVER qu'il était LIVE et
//      déclenché par le cron (`trigger=CRON`, `ingestionMode=LIVE`,
//      `source=WATCHER_V2`). Un backfill est structurellement absent du calcul
//      — pas filtré après coup, absent : il ne franchit jamais l'entrée.
//
//   2. « Vivant » et « sain » sont deux questions distinctes, avec deux
//      réponses distinctes. Un run `capped` prouve que l'ordonnanceur tourne
//      ET que rien n'a été collecté. Les confondre — dans un sens ou dans
//      l'autre — reproduit la panne : soit on crie « Watcher down » alors que
//      le cron va bien, soit on se tait alors que la collecte est morte.
//
// ── POURQUOI DES CRÉNEAUX ET PAS UN COMPTEUR FLOTTANT ─────────────────────
//
// Le Watcher a une cadence : un run attendu par jour à 06:00 UTC. Un compteur
// « heures depuis le dernier succès » facturerait la cadence elle-même comme un
// retard (12h après un succès de 06:05, il est 18:05 et le run suivant n'est
// même pas dû). Les sondes raisonnent donc en CRÉNEAUX ATTENDUS : chaque 06:00
// UTC est un rendez-vous, on regarde lequel a été honoré, et le retard se
// compte depuis le plus ancien rendez-vous manqué.

import {
  HEALTHY_STATUSES,
  RUN_STATUS,
  isCronLiveWatcherRun,
  isHealthyRun,
  isInconsistentZeroCandidateRun,
  normalizeLabel,
  type WatcherRunRecord,
} from "./watcherRunTypes";

const HOUR_MS = 3_600_000;

/** Niveau d'une sonde élémentaire. */
export type ProbeLevel = "HEALTHY" | "WARNING" | "CRITICAL";

/** Synthèse globale. `DEGRADED` n'est PAS `DOWN` — cf. spec §4. */
export type OverallLevel = "HEALTHY" | "DEGRADED" | "CRITICAL";

export interface ProbeResult {
  readonly level: ProbeLevel;
  /** Phrase lisible par un humain réveillé à 3h du matin. Vide si HEALTHY. */
  readonly reason: string;
}

export interface WatcherHealthConfig {
  /** Heure UTC du rendez-vous quotidien (cron `0 6 * * *`). */
  readonly scheduleUtcHour: number;
  readonly scheduleUtcMinute: number;
  /** Cadence entre deux rendez-vous. */
  readonly cadenceMs: number;

  /** Sonde A — retard de l'ordonnanceur. */
  readonly schedulerWarnAfterMs: number;
  readonly schedulerCriticalAfterMs: number;

  /** Sonde C — ancienneté du dernier créneau honoré par un run sain. */
  readonly successWarnAfterMs: number;
  readonly successCriticalAfterMs: number;

  /** Sonde D — runs `capped` consécutifs. */
  readonly cappedWarnRuns: number;
  readonly cappedCriticalRuns: number;

  /** Rendement — p10 historique des candidats par run (spec §4). */
  readonly lowVolumeCandidates: number;

  /** Garde-fou d'itération : jamais plus de N créneaux remontés. */
  readonly maxSlotLookback: number;
}

export const DEFAULT_C4_CONFIG: WatcherHealthConfig = {
  scheduleUtcHour: 6,
  scheduleUtcMinute: 0,
  cadenceMs: 24 * HOUR_MS,

  schedulerWarnAfterMs: 1 * HOUR_MS,
  schedulerCriticalAfterMs: 3 * HOUR_MS,

  successWarnAfterMs: 12 * HOUR_MS,
  successCriticalAfterMs: 24 * HOUR_MS,

  cappedWarnRuns: 1,
  cappedCriticalRuns: 2,

  // p10 historique mesuré sur les runs d'août avant le blackout (62→85
  // candidats/jour du 11 au 16). 45 est le plancher sous lequel un run mérite
  // un regard — PAS une alerte de panne : le rendement est une sonde séparée.
  lowVolumeCandidates: 45,

  maxSlotLookback: 60,
};

/** Métriques de rendement d'un run (spec §4). Jamais une cause de `DOWN`. */
export interface YieldMetrics {
  readonly handlesAttempted: number | null;
  readonly handlesSucceeded: number | null;
  readonly tweetsFetched: number | null;
  readonly newPostsObserved: number | null;
  readonly candidatesProduced: number | null;
  readonly xApiErrors: number | null;
  readonly durationMs: number | null;
  /** `handlesSucceeded / handlesAttempted` — null si indécidable. */
  readonly collectionYield: number | null;
  /** `candidatesProduced / tweetsFetched` — null si indécidable. */
  readonly detectionYield: number | null;
  /** Vrai si `candidatesProduced < lowVolumeCandidates` sur un run qui a collecté. */
  readonly lowVolume: boolean;
}

export interface WatcherHealthReport {
  /** Instant de la mesure. */
  readonly now: Date;
  /** Le rendez-vous le plus récent déjà échu. */
  readonly expectedRunAt: Date;

  // ── Les trois fraîcheurs, jamais fusionnées (spec §1) ──
  readonly schedulerFreshness: Date | null;
  readonly collectorFreshness: Date | null;
  readonly successfulFreshness: Date | null;

  // ── Les cinq composants (spec §5) ──
  readonly scheduler: ProbeResult;
  readonly collector: ProbeResult;
  readonly persistence: ProbeResult;
  readonly detection: ProbeResult;
  readonly budget: ProbeResult;

  readonly consecutiveCappedRuns: number;
  readonly consecutiveFailedRuns: number;

  readonly overall: OverallLevel;
  readonly reasons: readonly string[];

  /** Rendement du dernier run LIVE cron qui a réellement collecté. */
  readonly yieldMetrics: YieldMetrics | null;

  /** Nombre de runs retenus après filtrage CRON+LIVE+WATCHER_V2. */
  readonly liveCronRunCount: number;
  /** Runs écartés parce que non CRON+LIVE — exposé pour l'audit, jamais compté. */
  readonly ignoredRunCount: number;
}

// ── Horodatage d'ancrage d'un run ────────────────────────────────────────────
//
// `scheduledAt` d'abord : c'est le rendez-vous auquel le run se rattache, et
// c'est le seul champ qui survit à un run parti en retard. On retombe sur
// `startedAt` puis `finishedAt` pour les lignes écrites par un écrivain qui ne
// remplit pas encore `scheduledAt` — la sonde ne doit pas devenir aveugle
// pendant la période de transition de la migration.
function runAnchor(run: WatcherRunRecord): Date | null {
  return run.scheduledAt ?? run.startedAt ?? run.finishedAt ?? null;
}

function ms(d: Date | null | undefined): number | null {
  return d == null ? null : d.getTime();
}

function maxDate(dates: readonly (Date | null)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (d == null) continue;
    if (best == null || d.getTime() > best.getTime()) best = d;
  }
  return best;
}

function fmtAge(deltaMs: number): string {
  const h = deltaMs / HOUR_MS;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}j`;
}

function fmtUtc(d: Date | null): string {
  return d == null ? "jamais" : d.toISOString().replace(".000Z", "Z");
}

/**
 * Le rendez-vous le plus récent déjà échu, à `now` inclus.
 *
 * Calculé en UTC pur (`setUTCHours`) : le serveur de la sonde peut vivre en
 * Asia/Makassar, le cron Vercel, lui, est en UTC. Un créneau calculé en heure
 * locale décalerait toutes les fenêtres de 8h — et une fenêtre décalée, c'est
 * une alerte qui part au mauvais moment ou pas du tout.
 */
export function expectedRunAtFor(now: Date, cfg: WatcherHealthConfig = DEFAULT_C4_CONFIG): Date {
  const slot = new Date(now.getTime());
  slot.setUTCHours(cfg.scheduleUtcHour, cfg.scheduleUtcMinute, 0, 0);
  if (slot.getTime() > now.getTime()) slot.setTime(slot.getTime() - cfg.cadenceMs);
  return slot;
}

/**
 * Ne garde que les runs CRON + LIVE + WATCHER_V2.
 *
 * C'EST LA PORTE D'ENTRÉE DE TOUTE LA SONDE. Un backfill
 * (`trigger=BACKFILL/MANUAL`, `ingestionMode=BACKFILL`) et un run manuel LIVE
 * n'entrent pas : ils ne sont pas « écartés du score », ils n'existent pas pour
 * la sonde. C'est ce qui rend l'invariant C4-1 structurel plutôt que
 * conditionnel.
 */
export function selectLiveCronRuns(runs: readonly WatcherRunRecord[]): WatcherRunRecord[] {
  return runs.filter(isCronLiveWatcherRun);
}

/** Trie du plus récent au plus ancien, sur l'ancre. Les runs sans ancre finissent derrière. */
function sortByAnchorDesc(runs: readonly WatcherRunRecord[]): WatcherRunRecord[] {
  return [...runs].sort((a, b) => (ms(runAnchor(b)) ?? -Infinity) - (ms(runAnchor(a)) ?? -Infinity));
}

/** Les runs rattachés au créneau `[slot, slot + cadence)`. */
function runsInSlot(
  runs: readonly WatcherRunRecord[],
  slot: Date,
  cfg: WatcherHealthConfig
): WatcherRunRecord[] {
  const from = slot.getTime();
  const to = from + cfg.cadenceMs;
  return runs.filter((r) => {
    const a = ms(runAnchor(r));
    return a != null && a >= from && a < to;
  });
}

/**
 * Le plus ANCIEN rendez-vous non honoré, en remontant depuis `expectedRunAt`.
 *
 * « Honoré » est fourni par l'appelant (`satisfies`) : l'ordonnanceur a démarré
 * pour la sonde A, un run sain a fini pour la sonde C. Le retard se compte
 * depuis ce créneau-là, ce qui fait qu'une panne de trois jours pèse trois
 * jours et non « depuis ce matin ».
 *
 * La remontée est bornée par le run le plus ancien de la fenêtre reçue : sans
 * cette borne, une base neuve (ou une fenêtre courte) verrait des créneaux
 * « manqués » avant même l'existence du Watcher, et la sonde crierait au feu le
 * jour de son installation.
 */
function oldestUnsatisfiedSlot(
  liveRuns: readonly WatcherRunRecord[],
  now: Date,
  cfg: WatcherHealthConfig,
  satisfies: (runsOfSlot: readonly WatcherRunRecord[]) => boolean
): Date | null {
  if (liveRuns.length === 0) return null;

  const anchors = liveRuns.map((r) => ms(runAnchor(r))).filter((v): v is number => v != null);
  if (anchors.length === 0) return null;
  const earliest = Math.min(...anchors);

  const expected = expectedRunAtFor(now, cfg);
  let oldest: Date | null = null;

  for (let i = 0; i < cfg.maxSlotLookback; i++) {
    const slot = new Date(expected.getTime() - i * cfg.cadenceMs);
    // On ne juge pas un créneau antérieur à la fenêtre de données reçue.
    if (slot.getTime() + cfg.cadenceMs <= earliest) break;
    if (!satisfies(runsInSlot(liveRuns, slot, cfg))) oldest = slot;
    else break; // dès qu'un créneau est honoré, la série de manqués s'arrête.
  }
  return oldest;
}

/** Compte les runs consécutifs (du plus récent vers le passé) satisfaisant `pred`. */
function countConsecutive(
  runsDesc: readonly WatcherRunRecord[],
  pred: (r: WatcherRunRecord) => boolean
): number {
  let n = 0;
  for (const r of runsDesc) {
    if (!pred(r)) break;
    n++;
  }
  return n;
}

const FAILURE_STATUSES: readonly string[] = [
  RUN_STATUS.FAILED,
  RUN_STATUS.PARTIAL,
  RUN_STATUS.TIMED_OUT_WITH_WRITES,
  RUN_STATUS.TIMED_OUT_UNKNOWN_WRITES,
];

function isCapped(run: WatcherRunRecord): boolean {
  return normalizeLabel(run.status) === RUN_STATUS.CAPPED;
}

function isFailure(run: WatcherRunRecord): boolean {
  return FAILURE_STATUSES.includes(normalizeLabel(run.status));
}

/** Le run est-il allé jusqu'à la première lecture X ? */
function hasCollected(run: WatcherRunRecord): boolean {
  return run.collectionStartedAt != null;
}

function computeYield(run: WatcherRunRecord | null, cfg: WatcherHealthConfig): YieldMetrics | null {
  if (run == null) return null;
  const attempted = run.handlesAttempted;
  const succeeded = run.handlesSucceeded;
  const tweets = run.tweetsFetched;
  const candidates = run.candidatesProduced;

  const collectionYield =
    attempted != null && attempted > 0 && succeeded != null ? succeeded / attempted : null;
  const detectionYield =
    tweets != null && tweets > 0 && candidates != null ? candidates / tweets : null;

  return {
    handlesAttempted: attempted,
    handlesSucceeded: succeeded,
    tweetsFetched: tweets,
    newPostsObserved: run.newPostsObserved,
    candidatesProduced: candidates,
    xApiErrors: run.xApiErrors,
    durationMs: run.durationMs,
    collectionYield,
    detectionYield,
    // Un run qui n'a jamais collecté n'a pas un « rendement faible », il n'a
    // pas de rendement du tout. Le confondre ferait passer une panne de
    // collecte pour un problème de qualité de signal — l'erreur exacte que le
    // diagnostic du 24 août a dû écarter à la main.
    lowVolume: hasCollected(run) && candidates != null && candidates < cfg.lowVolumeCandidates,
  };
}

const OK: ProbeResult = { level: "HEALTHY", reason: "" };

/**
 * Le verdict complet.
 *
 * `runs` est une fenêtre de lignes `JobRunLog` (toutes sources, tous triggers —
 * la sonde fait le tri elle-même, c'est plus sûr que de faire confiance au
 * `WHERE` de l'appelant).
 */
export function evaluateWatcherHealth(
  runs: readonly WatcherRunRecord[],
  now: Date,
  config: Partial<WatcherHealthConfig> = {}
): WatcherHealthReport {
  const cfg: WatcherHealthConfig = { ...DEFAULT_C4_CONFIG, ...config };
  const expectedRunAt = expectedRunAtFor(now, cfg);

  const liveRuns = selectLiveCronRuns(runs);
  const liveDesc = sortByAnchorDesc(liveRuns);
  const healthyRuns = liveRuns.filter(isHealthyRun);

  // ── Les trois fraîcheurs (spec §1) ────────────────────────────────────────
  const schedulerFreshness = maxDate(liveRuns.map((r) => r.startedAt));
  const collectorFreshness = maxDate(liveRuns.map((r) => r.collectionStartedAt));
  // `capped` est ABSENT de HEALTHY_STATUSES : un run capé ne peut structurellement
  // pas porter `successfulFreshness`. C'est la règle qui manquait en août.
  const successfulFreshness = maxDate(
    healthyRuns.map((r) => r.finishedAt ?? r.collectionStartedAt ?? r.startedAt)
  );

  const reasons: string[] = [];

  // ── SONDE A — Ordonnanceur ────────────────────────────────────────────────
  let scheduler: ProbeResult = OK;
  if (liveRuns.length === 0) {
    scheduler = {
      level: "CRITICAL",
      reason:
        `Aucun run CRON+LIVE de WATCHER_V2 dans la fenêtre observée. ` +
        `Le rendez-vous de ${fmtUtc(expectedRunAt)} n'a laissé aucune trace.`,
    };
  } else {
    const missed = oldestUnsatisfiedSlot(liveRuns, now, cfg, (rs) =>
      rs.some((r) => r.startedAt != null)
    );
    if (missed != null) {
      const late = now.getTime() - missed.getTime();
      const level: ProbeLevel =
        late >= cfg.schedulerCriticalAfterMs
          ? "CRITICAL"
          : late >= cfg.schedulerWarnAfterMs
            ? "WARNING"
            : "HEALTHY";
      if (level !== "HEALTHY") {
        scheduler = {
          level,
          reason:
            `Ordonnanceur : aucun run cron démarré pour le rendez-vous de ` +
            `${fmtUtc(missed)} (retard ${fmtAge(late)}).`,
        };
      }
    }
  }

  // ── SONDE B — Collecteur ──────────────────────────────────────────────────
  //
  // La signature d'un bail budgétaire : `startedAt` non nul, `collectionStartedAt`
  // nul. Aucune sonde à un seul horodatage ne peut voir cet état — c'est
  // précisément pour ça qu'il y en a quatre.
  let collector: ProbeResult = OK;
  const expectedSlotRuns = sortByAnchorDesc(runsInSlot(liveRuns, expectedRunAt, cfg));
  const expectedSlotRun = expectedSlotRuns[0] ?? null;
  if (expectedSlotRun == null) {
    collector = {
      level: "WARNING",
      reason:
        `Collecteur : aucun run cron pour le rendez-vous de ${fmtUtc(expectedRunAt)}, ` +
        `donc aucune collecte X n'a pu avoir lieu (conséquence de la sonde Ordonnanceur).`,
    };
  } else if (expectedSlotRun.startedAt != null && !hasCollected(expectedSlotRun)) {
    const capped = isCapped(expectedSlotRun);
    collector = {
      level: "WARNING",
      reason: capped
        ? `Collecteur : le run de ${fmtUtc(expectedRunAt)} a démarré puis s'est arrêté sur le ` +
          `plafond X API — aucune lecture X n'a commencé (statut ${normalizeLabel(expectedSlotRun.status)}).`
        : `Collecteur : le run de ${fmtUtc(expectedRunAt)} a démarré mais n'a jamais commencé à ` +
          `collecter (collectionStartedAt absent, statut ${normalizeLabel(expectedSlotRun.status)}).`,
    };
  }

  // ── SONDE C — Dernier run réellement sain ────────────────────────────────
  let persistence: ProbeResult = OK;
  if (healthyRuns.length === 0) {
    persistence = {
      level: "CRITICAL",
      reason:
        `Aucun run CRON+LIVE sain (${HEALTHY_STATUSES.join(" / ")}) dans la fenêtre observée. ` +
        `Dernière collecte tentée : ${fmtUtc(collectorFreshness)}.`,
    };
  } else {
    const missed = oldestUnsatisfiedSlot(liveRuns, now, cfg, (rs) => rs.some(isHealthyRun));
    if (missed != null) {
      const stale = now.getTime() - missed.getTime();
      const level: ProbeLevel =
        stale >= cfg.successCriticalAfterMs
          ? "CRITICAL"
          : stale >= cfg.successWarnAfterMs
            ? "WARNING"
            : "HEALTHY";
      if (level !== "HEALTHY") {
        persistence = {
          level,
          reason:
            `Aucun run sain depuis le rendez-vous de ${fmtUtc(missed)} (${fmtAge(stale)}). ` +
            `Dernier succès LIVE : ${fmtUtc(successfulFreshness)}.`,
        };
      }
    }
  }

  // ── SONDE D — Plafond X API (agressive) ──────────────────────────────────
  const consecutiveCappedRuns = countConsecutive(liveDesc, isCapped);
  const consecutiveFailedRuns = countConsecutive(liveDesc, isFailure);

  let budget: ProbeResult = OK;
  if (consecutiveCappedRuns >= cfg.cappedCriticalRuns) {
    budget = {
      level: "CRITICAL",
      reason:
        `Watcher scheduler is alive, but LIVE collection is blocked by X API cap ` +
        `(${consecutiveCappedRuns} runs capés consécutifs).`,
    };
  } else if (consecutiveCappedRuns >= cfg.cappedWarnRuns) {
    budget = {
      level: "WARNING",
      reason:
        `Watcher scheduler is alive, but LIVE collection is blocked by X API cap ` +
        `(${consecutiveCappedRuns} run capé).`,
    };
  }

  // ── RENDEMENT — sonde SÉPARÉE, jamais `WATCHER_DOWN` (spec §4) ───────────
  const lastCollectingRun = liveDesc.find(hasCollected) ?? null;
  const yieldMetrics = computeYield(lastCollectingRun, cfg);

  // Deux défauts distincts peuvent coexister ici, et le second ne doit JAMAIS
  // être masqué par le premier : un rendement bas est une question de qualité
  // de signal, une métrique incohérente est un écrivain défectueux. Les
  // agréger en « un seul motif, le premier trouvé » recréerait à petite échelle
  // l'erreur de la sonde d'août — un symptôme qui en cache un autre.
  const detectionReasons: string[] = [];
  if (yieldMetrics?.lowVolume) {
    detectionReasons.push(
      `LOW_VOLUME_WARNING : ${yieldMetrics.candidatesProduced} candidat(s) sur le dernier run ` +
        `ayant collecté (plancher ${cfg.lowVolumeCandidates}). ` +
        `Le collecteur fonctionne — c'est le rendement qui est bas, pas le Watcher qui est mort.`
    );
  }
  // Un écrivain qui pose `success_zero_candidates` sans métriques ment sans le
  // savoir. On le dit, plutôt que de compter ce run comme sain en silence.
  const inconsistent = liveRuns.filter(isInconsistentZeroCandidateRun);
  if (inconsistent.length > 0) {
    detectionReasons.push(
      `${inconsistent.length} run(s) étiqueté(s) ${RUN_STATUS.SUCCESS_ZERO_CANDIDATES} sans ` +
        `tweetsFetched>0 ET handlesAttempted>0 : « zéro candidat » n'y prouve pas « rien à signaler », ` +
        `mais « rien n'a été regardé ».`
    );
  }
  const detection: ProbeResult =
    detectionReasons.length === 0
      ? OK
      : { level: "WARNING", reason: detectionReasons.join(" ") };

  // ── SYNTHÈSE ──────────────────────────────────────────────────────────────
  const components: readonly ProbeResult[] = [scheduler, collector, persistence, detection, budget];
  for (const c of components) if (c.level !== "HEALTHY" && c.reason) reasons.push(c.reason);

  const overall: OverallLevel = components.some((c) => c.level === "CRITICAL")
    ? "CRITICAL"
    : components.some((c) => c.level === "WARNING")
      ? "DEGRADED"
      : "HEALTHY";

  return {
    now,
    expectedRunAt,
    schedulerFreshness,
    collectorFreshness,
    successfulFreshness,
    scheduler,
    collector,
    persistence,
    detection,
    budget,
    consecutiveCappedRuns,
    consecutiveFailedRuns,
    overall,
    reasons,
    yieldMetrics,
    liveCronRunCount: liveRuns.length,
    ignoredRunCount: runs.length - liveRuns.length,
  };
}

/** Rendu texte du rapport — destiné au message Telegram du watchdog. */
export function formatWatcherHealthReport(r: WatcherHealthReport): string {
  const icon = (l: ProbeLevel) => (l === "CRITICAL" ? "🔴" : l === "WARNING" ? "🟠" : "🟢");
  const head =
    r.overall === "CRITICAL" ? "🔴 WATCHER" : r.overall === "DEGRADED" ? "🟠 WATCHER" : "🟢 WATCHER";
  const lines = [
    `${head} — ${r.overall} (rendez-vous ${fmtUtc(r.expectedRunAt)})`,
    "",
    `${icon(r.scheduler.level)} Scheduler   — dernier cron démarré : ${fmtUtc(r.schedulerFreshness)}`,
    `${icon(r.collector.level)} Collector   — dernière collecte X  : ${fmtUtc(r.collectorFreshness)}`,
    `${icon(r.persistence.level)} Persistence — dernier run sain    : ${fmtUtc(r.successfulFreshness)}`,
    `${icon(r.detection.level)} Detection   — candidats dernier run : ${r.yieldMetrics?.candidatesProduced ?? "n/a"}`,
    `${icon(r.budget.level)} Budget      — runs capés consécutifs : ${r.consecutiveCappedRuns}`,
    "",
    `Runs LIVE+CRON retenus : ${r.liveCronRunCount} (écartés : ${r.ignoredRunCount})`,
    `Runs en échec consécutifs : ${r.consecutiveFailedRuns}`,
  ];
  if (r.reasons.length > 0) lines.push("", "— Raisons —", ...r.reasons.map((x) => `• ${x}`));
  return lines.join("\n");
}
