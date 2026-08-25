// ─── Invariants C4 — prouvés par MUTATION, pas par assertion de confort ──────
//
// Chaque invariant se prouve de la même façon : on construit un monde, on y
// injecte la ligne qui aurait dû tromper la sonde, et on vérifie que le verdict
// ne bouge pas. C'est le seul protocole qui aurait attrapé le blackout du
// 17→24 août : la sonde de l'époque passait tous les tests « la fraîcheur est
// bien calculée » — elle échouait uniquement au test « et si un humain écrivait
// 261 lignes à la main ? », que personne n'avait écrit.
//
// Aucune base n'est touchée. Les fixtures décrivent la forme CIBLE de
// `JobRunLog` ; le câblage SQL viendra après la migration.

import { describe, expect, it } from "vitest";

import {
  DEFAULT_C4_CONFIG,
  evaluateWatcherHealth,
  expectedRunAtFor,
  formatWatcherHealthReport,
  selectLiveCronRuns,
} from "../watcherHealthProbe";
import {
  INGESTION_MODE,
  RUN_STATUS,
  SOURCE_WATCHER_V2,
  TRIGGER,
  type WatcherRunRecord,
} from "../watcherRunTypes";

// ── Fabrique de fixtures ────────────────────────────────────────────────────

const D = (iso: string) => new Date(iso);

let seq = 0;
function makeRun(over: Partial<WatcherRunRecord> = {}): WatcherRunRecord {
  seq += 1;
  return {
    id: `run-${seq}`,
    source: SOURCE_WATCHER_V2,
    trigger: TRIGGER.CRON,
    ingestionMode: INGESTION_MODE.LIVE,
    status: RUN_STATUS.SUCCESS,
    scheduledAt: null,
    startedAt: null,
    collectionStartedAt: null,
    finishedAt: null,
    handlesAttempted: null,
    handlesSucceeded: null,
    tweetsFetched: null,
    newPostsObserved: null,
    candidatesProduced: null,
    xApiErrors: null,
    durationMs: null,
    ...over,
  };
}

/** Un run cron LIVE nominal sur le rendez-vous de `day` à 06:00 UTC. */
function healthyCronRun(day: string, candidates = 70): WatcherRunRecord {
  return makeRun({
    status: RUN_STATUS.SUCCESS,
    scheduledAt: D(`${day}T06:00:00Z`),
    startedAt: D(`${day}T06:00:08Z`),
    collectionStartedAt: D(`${day}T06:00:31Z`),
    finishedAt: D(`${day}T06:04:52Z`),
    handlesAttempted: 20,
    handlesSucceeded: 20,
    tweetsFetched: 157,
    newPostsObserved: 143,
    candidatesProduced: candidates,
    xApiErrors: 0,
    durationMs: 292_000,
  });
}

/**
 * Un run capé : l'ordonnanceur a démarré, la collecte n'a JAMAIS commencé.
 * C'est la forme exacte de la sortie `capReached` du 17→24 août — celle qui
 * ne laissait aucune trace en base à l'époque.
 */
function cappedCronRun(day: string): WatcherRunRecord {
  return makeRun({
    status: RUN_STATUS.CAPPED,
    scheduledAt: D(`${day}T06:00:00Z`),
    startedAt: D(`${day}T06:00:06Z`),
    collectionStartedAt: null,
    finishedAt: D(`${day}T06:00:09Z`),
    handlesAttempted: 0,
    handlesSucceeded: 0,
    tweetsFetched: 0,
    newPostsObserved: 0,
    candidatesProduced: 0,
    xApiErrors: 0,
    durationMs: 3_000,
  });
}

// ── C4-1 ────────────────────────────────────────────────────────────────────

describe("C4-1 — un backfill ne ressuscite pas un Watcher mort", () => {
  const now = D("2026-08-25T06:05:00Z");
  // Dernier run cron LIVE sain : 72h avant `now`.
  const stale = [
    healthyCronRun("2026-08-20"),
    healthyCronRun("2026-08-21"),
    healthyCronRun("2026-08-22"),
  ];

  // La ligne qui a menti en août : 261 candidats écrits à la main, MAINTENANT.
  const backfillNow = makeRun({
    trigger: TRIGGER.BACKFILL,
    ingestionMode: INGESTION_MODE.BACKFILL,
    status: RUN_STATUS.SUCCESS,
    scheduledAt: D("2026-08-25T05:58:00Z"),
    startedAt: D("2026-08-25T05:58:00Z"),
    collectionStartedAt: D("2026-08-25T05:58:04Z"),
    finishedAt: D("2026-08-25T06:04:00Z"),
    handlesAttempted: 50,
    handlesSucceeded: 50,
    tweetsFetched: 750,
    newPostsObserved: 700,
    candidatesProduced: 261,
    xApiErrors: 0,
    durationMs: 360_000,
  });

  it("est CRITICAL sans le backfill", () => {
    const r = evaluateWatcherHealth(stale, now);
    expect(r.overall).toBe("CRITICAL");
  });

  it("MUTATION : reste CRITICAL, à l'identique, avec le backfill", () => {
    const before = evaluateWatcherHealth(stale, now);
    const after = evaluateWatcherHealth([...stale, backfillNow], now);

    expect(after.overall).toBe("CRITICAL");
    expect(after.scheduler.level).toBe(before.scheduler.level);
    expect(after.persistence.level).toBe(before.persistence.level);
    // La fraîcheur ne bouge PAS d'une seconde : le backfill n'entre pas.
    expect(after.successfulFreshness).toEqual(before.successfulFreshness);
    expect(after.successfulFreshness).toEqual(D("2026-08-22T06:04:52Z"));
    expect(after.collectorFreshness).toEqual(before.collectorFreshness);
  });

  it("le backfill est compté comme ÉCARTÉ, pas comme absent — traçabilité", () => {
    const r = evaluateWatcherHealth([...stale, backfillNow], now);
    expect(r.liveCronRunCount).toBe(3);
    expect(r.ignoredRunCount).toBe(1);
    expect(selectLiveCronRuns([backfillNow])).toHaveLength(0);
  });

  it("le retard se compte depuis le plus ancien rendez-vous manqué, pas depuis ce matin", () => {
    const r = evaluateWatcherHealth([...stale, backfillNow], now);
    // 08-23 est le premier rendez-vous sans run sain -> ~48h de retard.
    expect(r.persistence.reason).toContain("2026-08-23T06:00:00Z");
    expect(r.reasons.join(" ")).not.toContain("261");
  });
});

// ── C4-2 ────────────────────────────────────────────────────────────────────

describe("C4-2 — un run capé : ordonnanceur frais, collecteur non sain", () => {
  const now = D("2026-08-25T07:00:00Z");
  const runs = [
    healthyCronRun("2026-08-22"),
    healthyCronRun("2026-08-23"),
    healthyCronRun("2026-08-24"),
    cappedCronRun("2026-08-25"),
  ];
  const r = evaluateWatcherHealth(runs, now);

  it("l'ordonnanceur est VERT — le cron s'est bien déclenché", () => {
    expect(r.scheduler.level).toBe("HEALTHY");
    expect(r.schedulerFreshness).toEqual(D("2026-08-25T06:00:06Z"));
  });

  it("le collecteur est en WARNING — aucune lecture X n'a commencé", () => {
    expect(r.collector.level).toBe("WARNING");
    expect(r.collectorFreshness).toEqual(D("2026-08-24T06:00:31Z"));
  });

  it("le run capé ne porte JAMAIS successfulFreshness", () => {
    expect(r.successfulFreshness).toEqual(D("2026-08-24T06:04:52Z"));
  });

  it("le budget alerte dès le premier run capé, et dit la bonne chose", () => {
    expect(r.budget.level).toBe("WARNING");
    expect(r.budget.reason).toContain(
      "Watcher scheduler is alive, but LIVE collection is blocked by X API cap"
    );
    expect(r.reasons.join(" ")).not.toContain("Watcher down");
  });

  it("synthèse : DEGRADED (le pendant global d'un WARNING), pas CRITICAL", () => {
    expect(r.overall).toBe("DEGRADED");
    expect(r.consecutiveCappedRuns).toBe(1);
  });

  it("MUTATION : renommer le statut en majuscules ne rend pas la sonde aveugle", () => {
    const shouty = [...runs.slice(0, 3), { ...cappedCronRun("2026-08-25"), status: "CAPPED" }];
    const s = evaluateWatcherHealth(shouty, now);
    expect(s.consecutiveCappedRuns).toBe(1);
    expect(s.budget.level).toBe("WARNING");
  });
});

// ── C4-3 ────────────────────────────────────────────────────────────────────

describe("C4-3 — deux runs capés consécutifs : CRITICAL", () => {
  const now = D("2026-08-25T07:00:00Z");
  const runs = [
    healthyCronRun("2026-08-22"),
    healthyCronRun("2026-08-23"),
    cappedCronRun("2026-08-24"),
    cappedCronRun("2026-08-25"),
  ];
  const r = evaluateWatcherHealth(runs, now);

  it("compte 2 runs capés consécutifs", () => {
    expect(r.consecutiveCappedRuns).toBe(2);
  });

  it("le budget passe CRITICAL et la synthèse suit", () => {
    expect(r.budget.level).toBe("CRITICAL");
    expect(r.overall).toBe("CRITICAL");
  });

  it("l'ordonnanceur reste VERT — on n'accuse pas la planification à tort", () => {
    expect(r.scheduler.level).toBe("HEALTHY");
  });

  it("MUTATION : un run sain intercalé casse la série, plus de CRITICAL budget", () => {
    const healed = [
      healthyCronRun("2026-08-22"),
      cappedCronRun("2026-08-23"),
      cappedCronRun("2026-08-24"),
      healthyCronRun("2026-08-25"),
    ];
    const h = evaluateWatcherHealth(healed, now);
    expect(h.consecutiveCappedRuns).toBe(0);
    expect(h.budget.level).toBe("HEALTHY");
  });
});

// ── C4-4 ────────────────────────────────────────────────────────────────────

describe("C4-4 — 50 handles, des tweets, zéro candidat : bas rendement, PAS une panne", () => {
  const now = D("2026-08-25T07:00:00Z");
  const zeroCandidates = makeRun({
    status: RUN_STATUS.SUCCESS_ZERO_CANDIDATES,
    scheduledAt: D("2026-08-25T06:00:00Z"),
    startedAt: D("2026-08-25T06:00:07Z"),
    collectionStartedAt: D("2026-08-25T06:00:29Z"),
    finishedAt: D("2026-08-25T06:06:10Z"),
    handlesAttempted: 50,
    handlesSucceeded: 50,
    tweetsFetched: 620,
    newPostsObserved: 580,
    candidatesProduced: 0,
    xApiErrors: 0,
    durationMs: 341_000,
  });
  const r = evaluateWatcherHealth(
    [healthyCronRun("2026-08-23"), healthyCronRun("2026-08-24"), zeroCandidates],
    now
  );

  it("les trois sondes de vie sont VERTES — le Watcher n'est pas down", () => {
    expect(r.scheduler.level).toBe("HEALTHY");
    expect(r.collector.level).toBe("HEALTHY");
    expect(r.persistence.level).toBe("HEALTHY");
    expect(r.budget.level).toBe("HEALTHY");
  });

  it("la fraîcheur LIVE est celle d'aujourd'hui", () => {
    expect(r.successfulFreshness).toEqual(D("2026-08-25T06:06:10Z"));
    expect(r.collectorFreshness).toEqual(D("2026-08-25T06:00:29Z"));
  });

  it("le rendement, lui, alerte séparément — et jamais avec le mot « down »", () => {
    expect(r.detection.level).toBe("WARNING");
    expect(r.detection.reason).toContain("LOW_VOLUME_WARNING");
    expect(r.overall).toBe("DEGRADED");
    expect(formatWatcherHealthReport(r)).not.toMatch(/down/i);
  });

  it("expose collectionYield et detectionYield", () => {
    expect(r.yieldMetrics?.collectionYield).toBe(1);
    expect(r.yieldMetrics?.detectionYield).toBe(0);
    expect(r.yieldMetrics?.handlesAttempted).toBe(50);
    expect(r.yieldMetrics?.tweetsFetched).toBe(620);
  });

  it("MUTATION : le même statut SANS métriques n'est plus sain — « rien regardé » ≠ « rien à signaler »", () => {
    const blind = { ...zeroCandidates, handlesAttempted: 0, tweetsFetched: 0 };
    const b = evaluateWatcherHealth(
      [healthyCronRun("2026-08-23"), healthyCronRun("2026-08-24"), blind],
      now
    );
    expect(b.successfulFreshness).toEqual(D("2026-08-24T06:04:52Z"));
    expect(b.detection.level).toBe("WARNING");
    expect(b.detection.reason).toContain("success_zero_candidates");
  });
});

// ── C4-5 ────────────────────────────────────────────────────────────────────

describe("C4-5 — aucun JobRunLog pour le rendez-vous attendu : ordonnanceur CRITICAL", () => {
  const now = D("2026-08-25T10:00:00Z"); // 4h après le rendez-vous de 06:00

  it("CRITICAL au-delà de 3h de retard", () => {
    const r = evaluateWatcherHealth(
      [healthyCronRun("2026-08-23"), healthyCronRun("2026-08-24")],
      now
    );
    expect(r.expectedRunAt).toEqual(D("2026-08-25T06:00:00Z"));
    expect(r.scheduler.level).toBe("CRITICAL");
    expect(r.overall).toBe("CRITICAL");
  });

  it("les paliers 1h / 3h se déclenchent au bon moment", () => {
    const base = [healthyCronRun("2026-08-23"), healthyCronRun("2026-08-24")];
    expect(evaluateWatcherHealth(base, D("2026-08-25T06:30:00Z")).scheduler.level).toBe("HEALTHY");
    expect(evaluateWatcherHealth(base, D("2026-08-25T07:05:00Z")).scheduler.level).toBe("WARNING");
    expect(evaluateWatcherHealth(base, D("2026-08-25T09:05:00Z")).scheduler.level).toBe("CRITICAL");
  });

  it("fenêtre entièrement vide : CRITICAL, jamais un silence rassurant", () => {
    const r = evaluateWatcherHealth([], now);
    expect(r.scheduler.level).toBe("CRITICAL");
    expect(r.persistence.level).toBe("CRITICAL");
    expect(r.overall).toBe("CRITICAL");
    expect(r.schedulerFreshness).toBeNull();
  });

  it("le collecteur signale la conséquence sans se faire passer pour la cause", () => {
    const r = evaluateWatcherHealth(
      [healthyCronRun("2026-08-23"), healthyCronRun("2026-08-24")],
      now
    );
    expect(r.collector.level).toBe("WARNING");
    expect(r.collector.reason).toContain("conséquence de la sonde Ordonnanceur");
  });
});

// ── C4-6 ────────────────────────────────────────────────────────────────────

describe("C4-6 — un run manuel LIVE réussi ne remet pas l'ordonnanceur au vert", () => {
  const now = D("2026-08-25T10:00:00Z");
  const base = [healthyCronRun("2026-08-23"), healthyCronRun("2026-08-24")];

  // Un vrai run LIVE, lancé à la main à 09:00, qui a vraiment collecté.
  const manualLive = makeRun({
    trigger: TRIGGER.MANUAL,
    ingestionMode: INGESTION_MODE.LIVE,
    status: RUN_STATUS.SUCCESS,
    scheduledAt: D("2026-08-25T09:00:00Z"),
    startedAt: D("2026-08-25T09:00:02Z"),
    collectionStartedAt: D("2026-08-25T09:00:25Z"),
    finishedAt: D("2026-08-25T09:05:00Z"),
    handlesAttempted: 50,
    handlesSucceeded: 50,
    tweetsFetched: 740,
    newPostsObserved: 700,
    candidatesProduced: 88,
    xApiErrors: 0,
    durationMs: 298_000,
  });

  it("MUTATION : le verdict est bit-à-bit identique avec et sans le run manuel", () => {
    const before = evaluateWatcherHealth(base, now);
    const after = evaluateWatcherHealth([...base, manualLive], now);

    expect(after.scheduler).toEqual(before.scheduler);
    expect(after.persistence).toEqual(before.persistence);
    expect(after.overall).toEqual(before.overall);
    expect(after.schedulerFreshness).toEqual(before.schedulerFreshness);
    expect(after.successfulFreshness).toEqual(before.successfulFreshness);
    expect(after.overall).toBe("CRITICAL");
  });

  it("le run manuel est visible comme écarté — pas effacé", () => {
    const r = evaluateWatcherHealth([...base, manualLive], now);
    expect(r.ignoredRunCount).toBe(1);
    expect(r.liveCronRunCount).toBe(2);
  });

  it("MUTATION inverse : le MÊME run, mais trigger=CRON, remet bien au vert", () => {
    const asCron = { ...manualLive, trigger: TRIGGER.CRON };
    const r = evaluateWatcherHealth([...base, asCron], now);
    expect(r.scheduler.level).toBe("HEALTHY");
    expect(r.persistence.level).toBe("HEALTHY");
    expect(r.overall).toBe("HEALTHY");
  });
});

// ── Garde-fous transverses ──────────────────────────────────────────────────

describe("garde-fous de la sonde", () => {
  it("le rendez-vous se calcule en UTC, pas en heure locale", () => {
    // 05:00 UTC : le rendez-vous du jour n'est pas encore échu.
    expect(expectedRunAtFor(D("2026-08-25T05:00:00Z"))).toEqual(D("2026-08-24T06:00:00Z"));
    expect(expectedRunAtFor(D("2026-08-25T06:00:00Z"))).toEqual(D("2026-08-25T06:00:00Z"));
    expect(expectedRunAtFor(D("2026-08-25T23:59:59Z"))).toEqual(D("2026-08-25T06:00:00Z"));
  });

  it("les trois fraîcheurs restent séparées et ne se contaminent pas", () => {
    const r = evaluateWatcherHealth(
      [healthyCronRun("2026-08-24"), cappedCronRun("2026-08-25")],
      D("2026-08-25T07:00:00Z")
    );
    expect(r.schedulerFreshness).toEqual(D("2026-08-25T06:00:06Z"));
    expect(r.collectorFreshness).toEqual(D("2026-08-24T06:00:31Z"));
    expect(r.successfulFreshness).toEqual(D("2026-08-24T06:04:52Z"));
  });

  it("une autre source ne pollue pas le verdict du Watcher", () => {
    const foreign = { ...healthyCronRun("2026-08-25"), source: "SCAMSNIFFER_CHUNKER" };
    const r = evaluateWatcherHealth(
      [healthyCronRun("2026-08-23"), healthyCronRun("2026-08-24"), foreign],
      D("2026-08-25T10:00:00Z")
    );
    expect(r.scheduler.level).toBe("CRITICAL");
    expect(r.ignoredRunCount).toBe(1);
  });

  it("les échecs consécutifs sont comptés séparément des runs capés", () => {
    const r = evaluateWatcherHealth(
      [
        healthyCronRun("2026-08-22"),
        makeRun({
          status: RUN_STATUS.TIMED_OUT_UNKNOWN_WRITES,
          scheduledAt: D("2026-08-23T06:00:00Z"),
          startedAt: D("2026-08-23T06:00:05Z"),
          collectionStartedAt: D("2026-08-23T06:00:28Z"),
        }),
        makeRun({
          status: RUN_STATUS.FAILED,
          scheduledAt: D("2026-08-24T06:00:00Z"),
          startedAt: D("2026-08-24T06:00:05Z"),
          collectionStartedAt: D("2026-08-24T06:00:28Z"),
        }),
        makeRun({
          status: RUN_STATUS.PARTIAL,
          scheduledAt: D("2026-08-25T06:00:00Z"),
          startedAt: D("2026-08-25T06:00:05Z"),
          collectionStartedAt: D("2026-08-25T06:00:28Z"),
        }),
      ],
      D("2026-08-25T07:00:00Z")
    );
    expect(r.consecutiveFailedRuns).toBe(3);
    expect(r.consecutiveCappedRuns).toBe(0);
    expect(r.persistence.level).toBe("CRITICAL");
  });

  it("un plancher de rendement configurable, et un défaut assumé à 45", () => {
    expect(DEFAULT_C4_CONFIG.lowVolumeCandidates).toBe(45);
    const r = evaluateWatcherHealth(
      [healthyCronRun("2026-08-24", 70), healthyCronRun("2026-08-25", 40)],
      D("2026-08-25T07:00:00Z")
    );
    expect(r.detection.level).toBe("WARNING");
    expect(evaluateWatcherHealth(
      [healthyCronRun("2026-08-24", 70), healthyCronRun("2026-08-25", 40)],
      D("2026-08-25T07:00:00Z"),
      { lowVolumeCandidates: 10 }
    ).detection.level).toBe("HEALTHY");
  });
});
