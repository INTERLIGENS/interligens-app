// ─── L'adaptateur de lecture — et le piège des timestamps naïfs ──────────────
//
// Le test central de ce fichier est celui sur `AT TIME ZONE 'UTC'`. Ce n'est pas
// une préférence de style : mesuré sur la production le 2026-08-25, la même
// ligne se lit `07:06:32` en base et `05:06:32Z` depuis un process en
// Europe/Paris. Depuis Lombok, l'écart serait de 8 h. Une sonde de fraîcheur
// qui se trompe de 8 h sur ses propres mesures ne vaut pas mieux que celle
// qu'elle remplace.

import { describe, expect, it, vi } from "vitest";

import {
  __RUN_WINDOW_SQL_FOR_TESTS as SQL,
  fromPgClient,
  fromPrisma,
  loadWatcherRuns,
  mapRowToRunRecord,
} from "../jobRunLogAdapter";
import { evaluateWatcherHealth } from "../watcherHealthProbe";
import { INGESTION_MODE, RUN_STATUS, SOURCE_WATCHER_V2, TRIGGER } from "../watcherRunTypes";

describe("la requête désamorce le piège des timestamps naïfs", () => {
  it("les 4 colonnes temporelles passent TOUTES par AT TIME ZONE 'UTC'", () => {
    for (const col of ["scheduledAt", "startedAt", "collectionStartedAt", "finishedAt"]) {
      expect(SQL).toMatch(
        new RegExp(`"${col}"\\s+AT TIME ZONE 'UTC'\\s+AS\\s+"${col}"`),
      );
    }
  });

  it("aucune colonne temporelle n'est sélectionnée nue", () => {
    // Le mode de régression le plus probable : quelqu'un ajoute une colonne
    // temporelle en la copiant sur les colonnes entières, et la sonde recommence
    // à se décaler du fuseau du process — sans que rien ne le signale.
    const selectClause = SQL.slice(SQL.indexOf("SELECT"), SQL.indexOf("FROM"));
    for (const col of ["scheduledAt", "startedAt", "collectionStartedAt", "finishedAt"]) {
      // Chaque occurrence doit être soit la SOURCE (`"col" AT TIME ZONE 'UTC'`),
      // soit l'ALIAS (`AS "col"`). Toute troisième forme est une colonne nue.
      const occurrences = [...selectClause.matchAll(new RegExp(`(AS\\s+)?"${col}"(\\s+AT TIME ZONE)?`, "g"))];
      expect(occurrences.length).toBe(2);
      for (const m of occurrences) {
        const isSource = m[2] != null;
        const isAlias = m[1] != null;
        expect(isSource || isAlias).toBe(true);
      }
    }
  });

  it("la fenêtre elle-même est bornée en UTC, pas en heure de session", () => {
    expect(SQL).toMatch(/\(now\(\) AT TIME ZONE 'UTC'\) - make_interval/);
  });

  it("filtre sur source, et laisse trigger/ingestionMode à la sonde", () => {
    // C'est ce qui garde `ignoredRunCount` vivant en production : si le SQL
    // écartait déjà les backfills, l'invariant C4-1 resterait vrai sur fixtures
    // et deviendrait indémontrable sur le réel.
    expect(SQL).toMatch(/WHERE "source" = \$1/);
    expect(SQL).not.toMatch(/"trigger"\s*=/);
    expect(SQL).not.toMatch(/"ingestionMode"\s*=/);
  });
});

describe("mapRowToRunRecord — défensif sur chaque champ", () => {
  const row = {
    id: "run-1",
    source: SOURCE_WATCHER_V2,
    trigger: TRIGGER.CRON,
    ingestionMode: INGESTION_MODE.LIVE,
    status: RUN_STATUS.SUCCESS,
    scheduledAt: new Date("2026-08-26T06:00:00Z"),
    startedAt: new Date("2026-08-26T06:00:12Z"),
    collectionStartedAt: new Date("2026-08-26T06:00:14Z"),
    finishedAt: new Date("2026-08-26T06:03:20Z"),
    handlesAttempted: 50,
    handlesSucceeded: 48,
    tweetsFetched: 320,
    newPostsObserved: 91,
    candidatesProduced: 62,
    xApiErrors: 2,
    durationMs: 188_000,
  };

  it("convertit une ligne complète sans perte", () => {
    const r = mapRowToRunRecord(row);
    expect(r.id).toBe("run-1");
    expect(r.startedAt?.toISOString()).toBe("2026-08-26T06:00:12.000Z");
    expect(r.candidatesProduced).toBe(62);
  });

  it("les colonnes vides d'une ligne pré-migration deviennent null, pas 0", () => {
    // La nuance compte : `handlesAttempted = 0` signifie « rien tenté »,
    // `null` signifie « on ne sait pas ». `isHealthyRun` les traite pareil ici,
    // mais `collectionYield` doit rendre null et pas NaN.
    const r = mapRowToRunRecord({ id: "vide", status: "disabled" });
    expect(r.source).toBe("");
    expect(r.startedAt).toBeNull();
    expect(r.handlesAttempted).toBeNull();
    expect(r.candidatesProduced).toBeNull();
  });

  it("absorbe les entiers rendus en chaîne ou en bigint par le driver", () => {
    const r = mapRowToRunRecord({ ...row, tweetsFetched: "320", durationMs: BigInt(188_000) });
    expect(r.tweetsFetched).toBe(320);
    expect(r.durationMs).toBe(188_000);
  });

  it("une date illisible devient null plutôt qu'un Invalid Date contagieux", () => {
    const r = mapRowToRunRecord({ ...row, finishedAt: "pas-une-date" });
    expect(r.finishedAt).toBeNull();
  });

  it("accepte une date rendue en chaîne ISO", () => {
    const r = mapRowToRunRecord({ ...row, startedAt: "2026-08-26T06:00:12.000Z" });
    expect(r.startedAt?.toISOString()).toBe("2026-08-26T06:00:12.000Z");
  });
});

describe("les deux bridges parlent la même langue", () => {
  it("fromPrisma étale les paramètres en varargs", async () => {
    const db = { $queryRawUnsafe: vi.fn(async () => []) } as unknown as Parameters<typeof fromPrisma>[0];
    await fromPrisma(db)("SELECT 1", ["a", 2]);
    expect(db.$queryRawUnsafe).toHaveBeenCalledWith("SELECT 1", "a", 2);
  });

  it("fromPgClient passe le tableau et déballe .rows", async () => {
    const client = { query: vi.fn(async () => ({ rows: [{ id: "x" }] })) };
    const rows = await fromPgClient(client)("SELECT 1", ["a", 2]);
    expect(client.query).toHaveBeenCalledWith("SELECT 1", ["a", 2]);
    expect(rows).toEqual([{ id: "x" }]);
  });
});

describe("loadWatcherRuns — bout en bout jusqu'au verdict", () => {
  it("passe source, fenêtre et limite dans cet ordre", async () => {
    const seen: Array<readonly unknown[]> = [];
    const run = async (sql: string, params: readonly unknown[]) => {
      expect(sql).toMatch(/FROM "JobRunLog"/);
      seen.push(params);
      return [] as unknown[];
    };
    await loadWatcherRuns(run);
    expect(seen[0]).toEqual([SOURCE_WATCHER_V2, 14, 200]);
    await loadWatcherRuns(run, { windowDays: 3, limit: 10, source: "AUTRE" });
    expect(seen[1]).toEqual(["AUTRE", 3, 10]);
  });

  it("des lignes réelles traversent l'adaptateur et rendent un verdict SAIN", async () => {
    const rows = [
      {
        id: "r1",
        source: SOURCE_WATCHER_V2,
        trigger: TRIGGER.CRON,
        ingestionMode: INGESTION_MODE.LIVE,
        status: RUN_STATUS.SUCCESS,
        scheduledAt: new Date("2026-08-26T06:00:00Z"),
        startedAt: new Date("2026-08-26T06:00:12Z"),
        collectionStartedAt: new Date("2026-08-26T06:00:14Z"),
        finishedAt: new Date("2026-08-26T06:03:20Z"),
        handlesAttempted: 50,
        handlesSucceeded: 50,
        tweetsFetched: 320,
        newPostsObserved: 91,
        candidatesProduced: 62,
        xApiErrors: 0,
        durationMs: 188_000,
      },
    ];
    const runs = await loadWatcherRuns(async () => rows);
    const report = evaluateWatcherHealth(runs, new Date("2026-08-26T09:00:00Z"));
    expect(report.overall).toBe("HEALTHY");
    expect(report.liveCronRunCount).toBe(1);
  });

  it("C4-1 tient à travers l'adaptateur : un backfill frais ne rafraîchit rien", async () => {
    // Le test qui compte. Les lignes viennent de la « base », pas d'une fixture
    // construite pour plaire : elles portent les colonnes brutes et le mapping.
    const rows = [
      {
        id: "live-vieux",
        source: SOURCE_WATCHER_V2,
        trigger: TRIGGER.CRON,
        ingestionMode: INGESTION_MODE.LIVE,
        status: RUN_STATUS.SUCCESS,
        scheduledAt: new Date("2026-08-22T06:00:00Z"),
        startedAt: new Date("2026-08-22T06:00:11Z"),
        collectionStartedAt: new Date("2026-08-22T06:00:13Z"),
        finishedAt: new Date("2026-08-22T06:04:52Z"),
        handlesAttempted: 50,
        handlesSucceeded: 50,
        tweetsFetched: 300,
        newPostsObserved: 80,
        candidatesProduced: 71,
        xApiErrors: 0,
        durationMs: 281_000,
      },
      {
        id: "backfill-maintenant",
        source: SOURCE_WATCHER_V2,
        trigger: TRIGGER.BACKFILL,
        ingestionMode: INGESTION_MODE.BACKFILL,
        status: RUN_STATUS.SUCCESS,
        scheduledAt: null,
        startedAt: new Date("2026-08-25T11:00:00Z"),
        collectionStartedAt: new Date("2026-08-25T11:00:01Z"),
        finishedAt: new Date("2026-08-25T11:02:00Z"),
        handlesAttempted: 0,
        handlesSucceeded: 0,
        tweetsFetched: 0,
        newPostsObserved: 261,
        candidatesProduced: 261,
        xApiErrors: 0,
        durationMs: 120_000,
      },
    ];
    const runs = await loadWatcherRuns(async () => rows);
    const report = evaluateWatcherHealth(runs, new Date("2026-08-25T12:00:00Z"));

    expect(report.overall).toBe("CRITICAL");
    // La fraîcheur n'a pas bougé d'une seconde malgré les 261 candidats.
    expect(report.successfulFreshness?.toISOString()).toBe("2026-08-22T06:04:52.000Z");
    // Invisible dans le verdict, visible dans l'audit — c'est la moitié de
    // l'invariant qu'un filtre SQL trop zélé aurait effacée.
    expect(report.ignoredRunCount).toBe(1);
  });
});
