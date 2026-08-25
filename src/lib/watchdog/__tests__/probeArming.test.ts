// ─── L'armement — et surtout : ce qu'il ne doit JAMAIS masquer ──────────────
//
// Un garde anti-faux-positif est dangereux par nature : mal borné, il devient
// le trou par lequel la vraie panne passe. Les tests qui comptent ici sont donc
// ceux qui vérifient que la garde REND LA MAIN — pas ceux qui vérifient qu'elle
// se déclenche.

import { describe, expect, it } from "vitest";

import { evaluateArming } from "../probeArming";
import {
  INGESTION_MODE,
  RUN_STATUS,
  SOURCE_WATCHER_V2,
  TRIGGER,
  type WatcherRunRecord,
} from "../watcherRunTypes";

const H = 3_600_000;
const CADENCE = 24 * H;
const NOW = new Date("2026-08-26T09:00:00Z");

function run(over: Partial<WatcherRunRecord> = {}): WatcherRunRecord {
  return {
    id: "r",
    source: SOURCE_WATCHER_V2,
    trigger: TRIGGER.MANUAL,
    ingestionMode: INGESTION_MODE.LIVE,
    status: RUN_STATUS.SUCCESS,
    scheduledAt: null,
    startedAt: null,
    collectionStartedAt: null,
    finishedAt: null,
    handlesAttempted: 50,
    handlesSucceeded: 50,
    tweetsFetched: 300,
    newPostsObserved: 80,
    candidatesProduced: 70,
    xApiErrors: 0,
    durationMs: 200_000,
    ...over,
  };
}

const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("evaluateArming — la sonde ne juge que quand elle a de quoi", () => {
  it("aucune ligne du tout → non armée (écrivain absent ou muet)", () => {
    const s = evaluateArming({ runs: [], liveCronRunCount: 0, now: NOW, cadenceMs: CADENCE });
    expect(s.armed).toBe(false);
    expect(s.armed === false && s.reason).toMatch(/non déployé, ou muet/);
  });

  it("écrivain neuf, uniquement des runs MANUELS → non armée", () => {
    // Le cas vécu en production le 2026-08-25 : un curl de vérification
    // quelques minutes après le déploiement, aucun rendez-vous cron passé.
    const s = evaluateArming({
      runs: [run({ startedAt: ago(0.2 * H) })],
      liveCronRunCount: 0,
      now: NOW,
      cadenceMs: CADENCE,
    });
    expect(s.armed).toBe(false);
    expect(s.armed === false && s.reason).toMatch(/en service depuis 0\.2 h/);
  });

  it("un seul run CRON suffit à armer, même tout frais", () => {
    const s = evaluateArming({
      runs: [run({ trigger: TRIGGER.CRON, startedAt: ago(0.1 * H) })],
      liveCronRunCount: 1,
      now: NOW,
      cadenceMs: CADENCE,
    });
    expect(s.armed).toBe(true);
  });
});

describe("ce que la garde ne doit JAMAIS masquer", () => {
  it("écrivain vieux d'UNE CADENCE sans un seul run cron → ARMÉE, la panne doit crier", () => {
    // La borne. À 24 h pile, un rendez-vous a forcément été manqué.
    const s = evaluateArming({
      runs: [run({ startedAt: ago(CADENCE) })],
      liveCronRunCount: 0,
      now: NOW,
      cadenceMs: CADENCE,
    });
    expect(s.armed).toBe(true);
  });

  it("écrivain vieux de 3 jours, que des runs manuels → ARMÉE", () => {
    // Le scénario méchant : quelqu'un maintient le pipeline à la main pendant
    // que le cron est mort. La garde ne doit pas couvrir ça une seconde de plus
    // qu'une cadence.
    const s = evaluateArming({
      runs: [run({ startedAt: ago(3 * CADENCE) }), run({ startedAt: ago(0.1 * H) })],
      liveCronRunCount: 0,
      now: NOW,
      cadenceMs: CADENCE,
    });
    expect(s.armed).toBe(true);
  });

  it("l'âge se mesure sur la ligne la PLUS ANCIENNE, pas la plus récente", () => {
    // Sinon un run manuel quotidien rajeunirait l'écrivain indéfiniment et la
    // garde deviendrait permanente — le trou par lequel la panne passe.
    const jeune = run({ startedAt: ago(0.1 * H) });
    const vieux = run({ startedAt: ago(5 * CADENCE) });
    expect(
      evaluateArming({ runs: [jeune, vieux], liveCronRunCount: 0, now: NOW, cadenceMs: CADENCE })
        .armed,
    ).toBe(true);
    expect(
      evaluateArming({ runs: [vieux, jeune], liveCronRunCount: 0, now: NOW, cadenceMs: CADENCE })
        .armed,
    ).toBe(true);
  });

  it("un backfill ancien arme aussi la sonde — il prouve que l'écrivain existait", () => {
    const s = evaluateArming({
      runs: [
        run({
          trigger: TRIGGER.BACKFILL,
          ingestionMode: INGESTION_MODE.BACKFILL,
          startedAt: ago(2 * CADENCE),
        }),
      ],
      liveCronRunCount: 0,
      now: NOW,
      cadenceMs: CADENCE,
    });
    expect(s.armed).toBe(true);
  });

  it("des lignes sans aucun horodatage exploitable → ARMÉE (dans le doute, on juge)", () => {
    const s = evaluateArming({
      runs: [run({ startedAt: null, scheduledAt: null, finishedAt: null })],
      liveCronRunCount: 0,
      now: NOW,
      cadenceMs: CADENCE,
    });
    expect(s.armed).toBe(true);
  });

  it("se rabat sur scheduledAt puis finishedAt quand startedAt manque", () => {
    expect(
      evaluateArming({
        runs: [run({ startedAt: null, scheduledAt: ago(3 * CADENCE) })],
        liveCronRunCount: 0,
        now: NOW,
        cadenceMs: CADENCE,
      }).armed,
    ).toBe(true);
    expect(
      evaluateArming({
        runs: [run({ startedAt: null, scheduledAt: null, finishedAt: ago(0.1 * H) })],
        liveCronRunCount: 0,
        now: NOW,
        cadenceMs: CADENCE,
      }).armed,
    ).toBe(false);
  });
});
