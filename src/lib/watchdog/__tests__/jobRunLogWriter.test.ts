// ─── L'écrivain `JobRunLog` — chaque statut sur son chemin, prouvé ───────────
//
// Le blackout d'août n'a pas été causé par une sonde qui calculait mal : il a
// été causé par un chemin de sortie qui n'écrivait RIEN. Ces tests vérifient
// donc d'abord une chose bête et centrale : qu'aucun chemin ne se tait.
//
// La table de décision est testée par MUTATION comme les invariants C4 : on
// part d'un run sain et on bascule UN seul champ, pour vérifier que c'est bien
// ce champ-là qui déplace le statut — et pas un effet de bord de l'ordre des
// tests.

import { describe, expect, it, vi } from "vitest";

import {
  WATCHER_V2_JOB_NAME,
  closeWatcherRun,
  decideTerminalStatus,
  markCollectionStarted,
  openWatcherRun,
  resolveTrigger,
  type ScanOutcome,
  type WatcherRunWriterDb,
} from "../jobRunLogWriter";
import { INGESTION_MODE, RUN_STATUS, SOURCE_WATCHER_V2, TRIGGER } from "../watcherRunTypes";

// ── Un run nominal : tout s'est bien passé ──────────────────────────────────
const HEALTHY: ScanOutcome = {
  usageUnavailable: false,
  capReachedBeforeScan: false,
  spendCapped: false,
  cappedMidScan: false,
  threw: false,
  handlesAttempted: 50,
  handlesSucceeded: 50,
  tweetsFetched: 320,
  candidatesProduced: 62,
};

const outcome = (over: Partial<ScanOutcome> = {}): ScanOutcome => ({ ...HEALTHY, ...over });

// ── Faux client DB : enregistre les requêtes, ne parle à rien ───────────────
type FakeDb = WatcherRunWriterDb & { calls: Array<{ sql: string; params: unknown[] }> };

function fakeDb(opts: { failOn?: RegExp; returnId?: string | null } = {}): FakeDb {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  return {
    calls,
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: unknown[]) => {
      calls.push({ sql, params });
      if (opts.failOn && opts.failOn.test(sql)) throw new Error("DB indisponible");
      if (/INSERT INTO "JobRunLog"/.test(sql)) {
        const id = opts.returnId === undefined ? "run-abc" : opts.returnId;
        return id == null ? [] : [{ id }];
      }
      return [];
    }),
  } as unknown as FakeDb;
}

describe("decideTerminalStatus — chaque chemin de sortie a son statut", () => {
  it("run nominal avec candidats → success", () => {
    expect(decideTerminalStatus(HEALTHY)).toBe(RUN_STATUS.SUCCESS);
  });

  it("zéro candidat mais collecte réelle → success_zero_candidates", () => {
    expect(decideTerminalStatus(outcome({ candidatesProduced: 0 }))).toBe(
      RUN_STATUS.SUCCESS_ZERO_CANDIDATES,
    );
  });

  it("plafond POSTS atteint avant la boucle → capped", () => {
    expect(
      decideTerminalStatus(
        outcome({
          capReachedBeforeScan: true,
          handlesAttempted: 0,
          handlesSucceeded: 0,
          tweetsFetched: 0,
          candidatesProduced: 0,
        }),
      ),
    ).toBe(RUN_STATUS.CAPPED);
  });

  it("spend cap X (403 masqué) → capped", () => {
    expect(
      decideTerminalStatus(
        outcome({
          spendCapped: true,
          handlesAttempted: 0,
          handlesSucceeded: 0,
          tweetsFetched: 0,
          candidatesProduced: 0,
        }),
      ),
    ).toBe(RUN_STATUS.CAPPED);
  });

  it("plafond franchi EN COURS de boucle → partial, pas capped", () => {
    // Le run a réellement collecté avant de s'arrêter : l'appeler `capped`
    // effacerait ce travail, et ferait monter la sonde Budget pour un run qui
    // a produit du signal.
    const s = decideTerminalStatus(outcome({ cappedMidScan: true, handlesSucceeded: 12 }));
    expect(s).toBe(RUN_STATUS.PARTIAL);
    expect(s).not.toBe(RUN_STATUS.CAPPED);
  });

  it("exception traversante → failed", () => {
    expect(decideTerminalStatus(outcome({ threw: true }))).toBe(RUN_STATUS.FAILED);
  });

  it("usage X illisible → failed, et JAMAIS capped", () => {
    // Le choix qui compte : le budget est INCONNU, pas épuisé. `capped`
    // enverrait David dans la console de facturation X pour un incident réseau.
    const s = decideTerminalStatus(
      outcome({
        usageUnavailable: true,
        handlesAttempted: 0,
        handlesSucceeded: 0,
        tweetsFetched: 0,
        candidatesProduced: 0,
      }),
    );
    expect(s).toBe(RUN_STATUS.FAILED);
    expect(s).not.toBe(RUN_STATUS.CAPPED);
  });

  it("des handles tentés, aucun abouti → failed (pas « zéro candidat »)", () => {
    expect(
      decideTerminalStatus(
        outcome({
          handlesAttempted: 50,
          handlesSucceeded: 0,
          tweetsFetched: 0,
          candidatesProduced: 0,
        }),
      ),
    ).toBe(RUN_STATUS.FAILED);
  });

  it("zéro candidat ET zéro tweet reste success_zero_candidates — c'est la sonde qui refusera de le dire sain", () => {
    // L'écrivain ne maquille pas : il rapporte le statut ET les métriques nues.
    // `isHealthyRun` exige tweetsFetched > 0, donc ce run ne portera pas
    // `successfulFreshness`. La prudence appartient à la sonde, pas à l'écrivain.
    expect(
      decideTerminalStatus(
        outcome({ handlesSucceeded: 50, tweetsFetched: 0, candidatesProduced: 0 }),
      ),
    ).toBe(RUN_STATUS.SUCCESS_ZERO_CANDIDATES);
  });

  it("la priorité est celle de la cause, pas de la conséquence", () => {
    // Un run à la fois capé-en-cours ET sans candidat : `partial` gagne, parce
    // que « il s'est arrêté court » explique « il n'a rien produit ».
    expect(
      decideTerminalStatus(outcome({ cappedMidScan: true, candidatesProduced: 0 })),
    ).toBe(RUN_STATUS.PARTIAL);
    // Une exception prime même sur un plafond : on ne sait pas ce qui a été écrit.
    expect(
      decideTerminalStatus(outcome({ threw: true, capReachedBeforeScan: true })),
    ).toBe(RUN_STATUS.FAILED);
  });

  it("les 7 statuts sortants sont tous des valeurs connues de la sonde", () => {
    const known = new Set(Object.values(RUN_STATUS));
    const cases: ScanOutcome[] = [
      HEALTHY,
      outcome({ candidatesProduced: 0 }),
      outcome({ capReachedBeforeScan: true }),
      outcome({ spendCapped: true }),
      outcome({ cappedMidScan: true }),
      outcome({ threw: true }),
      outcome({ usageUnavailable: true }),
      outcome({ handlesSucceeded: 0 }),
    ];
    for (const c of cases) expect(known.has(decideTerminalStatus(c))).toBe(true);
  });
});

describe("resolveTrigger — on ne marque CRON que sur preuve positive", () => {
  const ev = (over: Partial<Parameters<typeof resolveTrigger>[0]> = {}) => ({
    userAgent: null,
    vercelCronHeader: null,
    explicitTrigger: null,
    ...over,
  });

  it("user-agent vercel-cron → CRON", () => {
    expect(resolveTrigger(ev({ userAgent: "vercel-cron/1.0" }))).toBe(TRIGGER.CRON);
  });

  it("en-tête x-vercel-cron → CRON", () => {
    expect(resolveTrigger(ev({ vercelCronHeader: "1" }))).toBe(TRIGGER.CRON);
  });

  it("aucune preuve → MANUAL, jamais CRON", () => {
    // Le défaut qui compte. Un curl manuel ne doit pas remettre l'ordonnanceur
    // au vert (invariant C4-6). Se tromper ici en faveur de CRON reproduit
    // exactement le mode de panne du blackout : silencieux et faux.
    expect(resolveTrigger(ev())).toBe(TRIGGER.MANUAL);
    expect(resolveTrigger(ev({ userAgent: "curl/8.4.0" }))).toBe(TRIGGER.MANUAL);
    expect(resolveTrigger(ev({ userAgent: "Mozilla/5.0" }))).toBe(TRIGGER.MANUAL);
  });

  it("un user-agent qui CONTIENT vercel-cron sans commencer par lui ne suffit pas", () => {
    expect(resolveTrigger(ev({ userAgent: "evil/1.0 vercel-cron/1.0" }))).toBe(TRIGGER.MANUAL);
  });

  it("forçage explicite accepté, casse indifférente", () => {
    expect(resolveTrigger(ev({ explicitTrigger: "manual", vercelCronHeader: "1" }))).toBe(
      TRIGGER.MANUAL,
    );
    expect(resolveTrigger(ev({ explicitTrigger: "BACKFILL" }))).toBe(TRIGGER.BACKFILL);
  });

  it("un forçage inconnu est ignoré et retombe sur la détection", () => {
    expect(resolveTrigger(ev({ explicitTrigger: "hacked", userAgent: "vercel-cron/1.0" }))).toBe(
      TRIGGER.CRON,
    );
    expect(resolveTrigger(ev({ explicitTrigger: "hacked" }))).toBe(TRIGGER.MANUAL);
  });
});

describe("openWatcherRun — la ligne existe dès le départ", () => {
  it("écrit source / trigger / ingestionMode et rend l'id", async () => {
    const db = fakeDb();
    const id = await openWatcherRun(db, {
      trigger: TRIGGER.CRON,
      now: new Date("2026-08-26T06:00:30Z"),
    });
    expect(id).toBe("run-abc");
    const { sql, params } = db.calls[0];
    expect(sql).toMatch(/INSERT INTO "JobRunLog"/);
    expect(params[0]).toBe(WATCHER_V2_JOB_NAME);
    expect(params[1]).toBe("running");
    expect(params[2]).toBe(SOURCE_WATCHER_V2);
    expect(params[3]).toBe(TRIGGER.CRON);
    expect(params[4]).toBe(INGESTION_MODE.LIVE);
  });

  it("ancre scheduledAt sur le créneau cron le plus récent échu", async () => {
    const db = fakeDb();
    // 06:00:30 UTC → le rendez-vous du jour même.
    await openWatcherRun(db, { trigger: TRIGGER.CRON, now: new Date("2026-08-26T06:00:30Z") });
    expect(db.calls[0].params[5]).toBe("2026-08-26T06:00:00.000Z");

    // 05:00 UTC → le rendez-vous n'est pas encore dû : c'est celui de la VEILLE.
    const db2 = fakeDb();
    await openWatcherRun(db2, { trigger: TRIGGER.CRON, now: new Date("2026-08-26T05:00:00Z") });
    expect(db2.calls[0].params[5]).toBe("2026-08-25T06:00:00.000Z");
  });

  it("écrit les horodatages en UTC explicite, jamais en heure de session", async () => {
    const db = fakeDb();
    await openWatcherRun(db, { trigger: TRIGGER.CRON });
    const { sql } = db.calls[0];
    // C'est la garantie qui survit à un changement de TimeZone de session.
    expect(sql).toMatch(/now\(\) AT TIME ZONE 'UTC'/);
    expect(sql).toMatch(/\$6::timestamptz AT TIME ZONE 'UTC'/);
    expect(sql).not.toMatch(/VALUES[^)]*\bnow\(\)(?! AT TIME ZONE)/);
  });

  it("une panne d'écriture rend null et ne casse JAMAIS le scan", async () => {
    // Une sonde qui tue le collecteur qu'elle surveille est un mauvais échange.
    const db = fakeDb({ failOn: /INSERT/ });
    await expect(openWatcherRun(db, { trigger: TRIGGER.CRON })).resolves.toBeNull();
  });
});

describe("markCollectionStarted — la signature du bail budgétaire", () => {
  it("pose collectionStartedAt en UTC, une seule fois", async () => {
    const db = fakeDb();
    await markCollectionStarted(db, "run-abc");
    const { sql, params } = db.calls[0];
    expect(sql).toMatch(/"collectionStartedAt" = \(now\(\) AT TIME ZONE 'UTC'\)/);
    // L'idempotence compte : un second appel ne doit pas repousser l'instant.
    expect(sql).toMatch(/"collectionStartedAt" IS NULL/);
    expect(params[0]).toBe("run-abc");
  });

  it("sans id (ouverture ratée), ne touche pas la base", async () => {
    const db = fakeDb();
    await markCollectionStarted(db, null);
    expect(db.calls).toHaveLength(0);
  });

  it("une panne d'écriture ne casse pas le scan", async () => {
    const db = fakeDb({ failOn: /UPDATE/ });
    await expect(markCollectionStarted(db, "run-abc")).resolves.toBeUndefined();
  });
});

describe("closeWatcherRun — statut terminal et 7 métriques", () => {
  const metrics = {
    handlesAttempted: 50,
    handlesSucceeded: 48,
    tweetsFetched: 320,
    newPostsObserved: 91,
    candidatesProduced: 62,
    xApiErrors: 2,
    durationMs: 184_000,
    exitReason: "scan terminé",
  };

  it("écrit le statut, finishedAt UTC et les 7 métriques", async () => {
    const db = fakeDb();
    await closeWatcherRun(db, "run-abc", RUN_STATUS.SUCCESS, metrics);
    const { sql, params } = db.calls[0];
    expect(sql).toMatch(/"finishedAt" = \(now\(\) AT TIME ZONE 'UTC'\)/);
    expect(params[1]).toBe(RUN_STATUS.SUCCESS);
    expect(params.slice(2, 9)).toEqual([50, 48, 320, 91, 62, 2, 184_000]);
  });

  it("conserve le motif de sortie dans summaryJson — le `capped` d'août redevient diagnosticable", async () => {
    const db = fakeDb();
    await closeWatcherRun(db, "run-abc", RUN_STATUS.CAPPED, {
      ...metrics,
      exitReason: "X API posts cap reached: 23990/24000",
      summary: { xApiUsagePosts: 23_990 },
    });
    const json = JSON.parse(String(db.calls[0].params[9]));
    expect(json.exitReason).toMatch(/posts cap reached/);
    expect(json.xApiUsagePosts).toBe(23_990);
  });

  it("sans id, ne touche pas la base", async () => {
    const db = fakeDb();
    await closeWatcherRun(db, null, RUN_STATUS.SUCCESS, metrics);
    expect(db.calls).toHaveLength(0);
  });

  it("une panne d'écriture ne casse pas le scan", async () => {
    const db = fakeDb({ failOn: /UPDATE/ });
    await expect(
      closeWatcherRun(db, "run-abc", RUN_STATUS.SUCCESS, metrics),
    ).resolves.toBeUndefined();
  });
});
