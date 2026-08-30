// --- A - les deux fenetres sont deux objets distincts ---------------------

import { describe, expect, it } from "vitest";
import { ANALYSIS_WINDOW } from "../../types";
import {
  WINDOW_WIDTH_SECONDS,
  baselineIsDisjoint,
  baselineWindow,
  observedWindow,
  windowsOverlap,
  zoneForDelta,
} from "../windows";
import { DEFAULT_ENGINE_POLICY, type EnginePolicy } from "../policy";
import { computeFeatures } from "../features";
import {
  baselineCollected,
  baselineBuy,
  buy,
  occasion,
  record,
} from "../__fixtures__/corpus";
import { isMeasured } from "../../measurement";

const P = DEFAULT_ENGINE_POLICY;
const AT = new Date("2026-08-01T12:00:00.000Z");

describe("A - fenetres", () => {
  it("les deux fenetres ont la meme largeur et des ancres differentes", () => {
    const o = observedWindow(AT);
    const b = baselineWindow(AT, P);
    expect(o.kind).toBe("observed");
    expect(b.kind).toBe("baseline");
    expect(o.endMs - o.startMs).toBe(b.endMs - b.startMs);
    expect(o.endMs - o.startMs).toBe(WINDOW_WIDTH_SECONDS * 1000);
    expect(o.anchorMs - b.anchorMs).toBe(P.baselineOffsetSeconds * 1000);
  });

  it("la fenetre d'observation reprend EXACTEMENT les bornes de v1", () => {
    const o = observedWindow(AT);
    expect(o.startMs).toBe(AT.getTime() - ANALYSIS_WINDOW.preSeconds * 1000);
    expect(o.endMs).toBe(AT.getTime() + ANALYSIS_WINDOW.postSeconds * 1000);
  });

  it("au decalage par defaut, les deux fenetres sont disjointes", () => {
    expect(baselineIsDisjoint(P)).toBe(true);
    expect(windowsOverlap(observedWindow(AT), baselineWindow(AT, P))).toBe(false);
  });

  it("un decalage <= largeur fait se recouvrir les fenetres", () => {
    const bad: EnginePolicy = { ...P, baselineOffsetSeconds: WINDOW_WIDTH_SECONDS };
    expect(baselineIsDisjoint(bad)).toBe(false);
    expect(windowsOverlap(observedWindow(AT), baselineWindow(AT, bad))).toBe(true);
  });

  it("un temoin recouvrant refuse le lift AVANT tout calcul", () => {
    const bad: EnginePolicy = { ...P, baselineOffsetSeconds: 600 };
    const records = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`o${i}`, "kol_a", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `sig-o-${i}`)],
        baseline: baselineCollected([baselineBuy("W1", -100, `sig-b-${i}`)]),
      }),
    );
    const [f] = computeFeatures(records, bad);
    expect(isMeasured(f.lift)).toBe(false);
    expect(f.liftUnmeasurableReason).toBe("BASELINE_WINDOW_OVERLAPS_OBSERVED");

    // Le meme corpus, avec un decalage valide, se mesure.
    const [g] = computeFeatures(records, P);
    expect(isMeasured(g.lift)).toBe(true);
  });

  it("les zones de v1 sont reprises sans derive", () => {
    expect(zoneForDelta(-601)).toBeNull();
    expect(zoneForDelta(901)).toBeNull();
    expect(zoneForDelta(-100)?.type).toBe("pre_tweet");
    expect(zoneForDelta(-30)?.type).toBe("near_tweet");
    expect(zoneForDelta(90)?.type).toBe("near_tweet");
    expect(zoneForDelta(91)?.type).toBe("post_tweet");
  });
});

describe("A - les deux etats de collecte sont deux axes", () => {
  it("un temoin collecte et vide n'est PAS un temoin absent", () => {
    // 8 occasions : temoin collecte partout, vide sur 6, fourni sur 2 (6 achats).
    const records = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`o${i}`, "kol_a", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `sig-o-${i}`)],
        baseline:
          i < 2
            ? baselineCollected(
                Array.from({ length: 3 }, (_, j) => baselineBuy("W1", -100, `sig-b-${i}-${j}`)),
              )
            : { state: "collected_empty" as const },
      }),
    );

    const [f] = computeFeatures(records, P);
    // Le denominateur du taux temoin compte les 8 occasions mesurees, pas les 2
    // qui portent des achats : un temoin vide est une mesure.
    expect(f.baselineMeasuredOccasions).toBe(8);
    expect(f.baselineOccurrences).toBe(2);
    expect(f.baselineRate.value).toBeCloseTo(2 / 8, 6);
    expect(isMeasured(f.lift)).toBe(true);
    // observedRate = 8/8 = 1 ; baselineRate = 0,25 ; lift = 4.
    expect(f.lift.value).toBeCloseTo(4, 6);
  });

  it("le meme corpus sans collecte temoin ne produit AUCUN taux temoin", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`o${i}`, "kol_a", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `sig-o-${i}`)],
      }),
    );
    const [f] = computeFeatures(records, P);
    expect(f.baselineMeasuredOccasions).toBe(0);
    expect(isMeasured(f.baselineRate)).toBe(false);
    expect(f.liftUnmeasurableReason).toBe("BASELINE_NOT_COLLECTED");
  });

  it("une erreur de collecte temoin n'est jamais lue comme un temoin vide", () => {
    const records = Array.from({ length: 8 }, (_, i) => {
      const r = record(occasion(`o${i}`, "kol_a", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `sig-o-${i}`)],
      });
      return { ...r, baselineState: "collect_error" as const, baselineStateDetail: "429 Helius" };
    });
    const [f] = computeFeatures(records, P);
    expect(f.baselineMeasuredOccasions).toBe(0);
    expect(f.liftUnmeasurableReason).toBe("BASELINE_NOT_COLLECTED");
  });
});
