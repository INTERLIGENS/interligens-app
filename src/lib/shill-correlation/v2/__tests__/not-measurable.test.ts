// --- B - NOT_MEASURABLE : un seul vocabulaire, un motif, zero epsilon -----
//
// Le vocabulaire est celui de measurement.ts, deja en place sur main :
// `UNMEASURED` (valeur NaN) et `indeterminate` (verdict de seuil). Ce fichier
// verifie qu'aucune SECONDE grammaire n'a ete introduite - pas de `null`
// signifiant, pas de sentinelle numerique, pas de booleen maison.

import { describe, expect, it } from "vitest";
import {
  UNMEASURED,
  compareToThreshold,
  isMeasured,
  type Measurement,
} from "../../measurement";
import { computeFeatures, computeLift } from "../features";
import { scoreFeatures } from "../scoring";
import { runEngine } from "../engine";
import { DEFAULT_ENGINE_POLICY, type EnginePolicy } from "../policy";
import { LIFT_UNMEASURABLE_REASONS, type CorrelationFeatures } from "../types";
import {
  baselineCollected,
  baselineCollectedEmpty,
  baselineNotCollected,
  baselineBuy,
  buy,
  occasion,
  record,
} from "../__fixtures__/corpus";

const P = DEFAULT_ENGINE_POLICY;

const emptySide = { occasions: 0, buys: UNMEASURED, truncatedBy: [] as string[] };

describe("B - la grammaire est celle de measurement.ts, et il n'y en a qu'une", () => {
  it("un lift non mesure est UNMEASURED, pas null, pas 0, pas -1", () => {
    const { lift, reason } = computeLift({
      policy: P,
      observedRate: { value: 1, censored: false, censoredBy: null },
      baselineRate: UNMEASURED,
      baselineOccurrences: 0,
      baselineFloor: { tally: emptySide, verdict: "indeterminate" },
      observedFloor: { tally: { ...emptySide, buys: { value: 10, censored: false, censoredBy: null } }, verdict: "above" },
    });
    expect(lift).toBe(UNMEASURED);
    expect(Number.isNaN(lift.value)).toBe(true);
    expect(isMeasured(lift)).toBe(false);
    expect(reason).toBe("BASELINE_NOT_COLLECTED");
  });

  it("compareToThreshold sur un lift non mesure rend `indeterminate`", () => {
    expect(compareToThreshold(UNMEASURED, P.minLift)).toBe("indeterminate");
  });

  it("tout refus porte un motif : jamais un lift non mesure sans reason", () => {
    const corpora: Array<{ policy: EnginePolicy; records: ReturnType<typeof record>[] }> = [
      // temoin absent
      {
        policy: P,
        records: Array.from({ length: 6 }, (_, i) =>
          record(occasion(`a${i}`, "k", i * 120), {
            observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
            baseline: baselineNotCollected(),
          }),
        ),
      },
      // temoin sous plancher
      {
        policy: P,
        records: Array.from({ length: 6 }, (_, i) =>
          record(occasion(`b${i}`, "k", i * 120), {
            observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
            baseline: i < 2 ? baselineCollected([baselineBuy("W1", -100, `bb${i}`)]) : baselineCollectedEmpty(),
          }),
        ),
      },
      // fenetre recouvrante
      {
        policy: { ...P, baselineOffsetSeconds: 60 },
        records: Array.from({ length: 6 }, (_, i) =>
          record(occasion(`c${i}`, "k", i * 120), {
            observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
            baseline: baselineCollected([baselineBuy("W1", -100, `bb${i}`)]),
          }),
        ),
      },
    ];

    for (const { policy, records } of corpora) {
      for (const f of computeFeatures(records, policy)) {
        if (isMeasured(f.lift)) continue;
        expect(f.liftUnmeasurableReason).not.toBeNull();
        expect(LIFT_UNMEASURABLE_REASONS).toContain(f.liftUnmeasurableReason!);
      }
    }
  });

  it("un lift mesure ne porte JAMAIS de motif de non-mesurabilite", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`o${i}`, "k", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
        baseline:
          i < 4
            ? baselineCollected([baselineBuy("W1", -100, `bb${i}`), baselineBuy("WX", -100, `bx${i}`)])
            : baselineCollectedEmpty(),
      }),
    );
    const [f] = computeFeatures(records, P);
    expect(isMeasured(f.lift)).toBe(true);
    expect(f.liftUnmeasurableReason).toBeNull();
  });
});

describe("B - baselineOccurrences === 0 : NOT_MEASURABLE, zero epsilon", () => {
  it("le cas est refuse par son propre motif, distinct de l'absence de temoin", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`o${i}`, "k", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
        baseline: baselineCollected([baselineBuy("WAUTRE", -100, `bb${i}`)]),
      }),
    );
    const [f] = computeFeatures(records, P);
    expect(f.baselineOccurrences).toBe(0);
    expect(f.liftUnmeasurableReason).toBe("BASELINE_ZERO_OCCURRENCES");
    expect(isMeasured(f.lift)).toBe(false);
  });

  it("aucune valeur finie n'apparait pour ce cas, quelle que soit la politique", () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      record(occasion(`o${i}`, "k", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
        baseline: baselineCollected([baselineBuy("WAUTRE", -100, `bb${i}`)]),
      }),
    );
    for (const minLift of [0, 0.5, 1, 2, 10, 100]) {
      for (const minBaselineBuys of [1, 5, 10]) {
        const [f] = computeFeatures(records, { ...P, minLift, minBaselineBuys });
        expect(Number.isFinite(f.lift.value)).toBe(false);
      }
    }
  });
});

describe("B - SHILL-C1 : une collecte bornee ne fonde aucun lift", () => {
  it("un temoin tronque par un budget rend BASELINE_CENSORED", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`o${i}`, "k", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
        baseline: baselineCollected(
          [baselineBuy("W1", -100, `bb${i}`)],
          i === 0 ? "budget Helius atteint (page cap)" : null,
        ),
      }),
    );
    const [f] = computeFeatures(records, P);
    expect(f.baselineTally.buys.censored).toBe(true);
    expect(f.baselineTally.truncatedBy).toContain("budget Helius atteint (page cap)");
    expect(f.liftUnmeasurableReason).toBe("BASELINE_CENSORED");
    expect(isMeasured(f.lift)).toBe(false);
  });

  it("une observation tronquee rend OBSERVED_CENSORED, motif distinct", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`o${i}`, "k", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
        observedTruncatedBy: i === 0 ? "getSignaturesForAddress plafonne a 1000" : null,
        baseline: baselineCollected([baselineBuy("W1", -100, `bb${i}`)]),
      }),
    );
    const [f] = computeFeatures(records, P);
    expect(f.observedTally.buys.censored).toBe(true);
    expect(f.liftUnmeasurableReason).toBe("OBSERVED_CENSORED");
  });
});

describe("B - visible en observabilite", () => {
  it("la telemetrie compte les non-mesurabilites par motif", () => {
    const sansTemoin = Array.from({ length: 6 }, (_, i) =>
      record(occasion(`a${i}`, "k1", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
        baseline: baselineNotCollected(),
      }),
    );
    const absentDuTemoin = Array.from({ length: 8 }, (_, i) =>
      record(occasion(`b${i}`, "k2", i * 120), {
        observations: [buy("W2", "pre_tweet", -100, `t${i}`)],
        baseline: baselineCollected([baselineBuy("WX", -100, `bb${i}`)]),
      }),
    );

    const r = runEngine([...sansTemoin, ...absentDuTemoin], P);
    expect(r.telemetry.liftUnmeasurable.BASELINE_NOT_COLLECTED).toBe(1);
    expect(r.telemetry.liftUnmeasurable.BASELINE_ZERO_OCCURRENCES).toBe(1);
    expect(r.telemetry.liftMeasured).toBe(0);
    expect(r.telemetry.absentFromMeasuredBaseline).toBe(1);
    expect(r.telemetry.byBaselineState.not_collected).toBe(6);
    expect(r.telemetry.byBaselineState.collected_with_buys).toBe(8);

    // Somme invariante : chaque candidat est soit mesure, soit motive.
    const total = Object.values(r.telemetry.liftUnmeasurable).reduce((a, b) => a + b, 0);
    expect(total + r.telemetry.liftMeasured).toBe(r.telemetry.candidatesEmitted);
  });

  it("chaque candidat sans lift porte une limitation qui NOMME le motif", () => {
    const records = Array.from({ length: 6 }, (_, i) =>
      record(occasion(`a${i}`, "k", i * 120), {
        observations: [buy("W1", "pre_tweet", -100, `s${i}`)],
        baseline: baselineNotCollected(),
      }),
    );
    const r = runEngine(records, P);
    for (const c of r.candidates) {
      expect(c.scores.limitations.some((l) => l.includes("BASELINE_NOT_COLLECTED"))).toBe(true);
      expect(c.scores.compositeRenormalized).toBe(true);
    }
  });
});

describe("B - pas de degradation silencieuse du score", () => {
  const base: CorrelationFeatures = {
    kolHandle: "k", wallet: "W1", chain: "solana",
    observedOccasions: 5, analyzableOccasions: 5, ratioObserved: 1,
    observedRate: { value: 1, censored: false, censoredBy: null },
    preTweetCount: 5, nearTweetCount: 0, postTweetCount: 0, exitCount: 0, distinctKolCount: 1,
    baselineOccurrences: 0, baselineMeasuredOccasions: 0, baselineRate: UNMEASURED,
    observedTally: { occasions: 5, buys: { value: 5, censored: false, censoredBy: null }, truncatedBy: [] },
    baselineTally: { occasions: 0, buys: { value: 0, censored: false, censoredBy: null }, truncatedBy: [] },
    lift: UNMEASURED, liftUnmeasurableReason: "BASELINE_NOT_COLLECTED",
    absentFromMeasuredBaseline: false,
  };

  const measured = (v: number): CorrelationFeatures => ({
    ...base,
    baselineOccurrences: 2, baselineMeasuredOccasions: 8,
    baselineRate: { value: 0.25, censored: false, censoredBy: null },
    baselineTally: { occasions: 8, buys: { value: 8, censored: false, censoredBy: null }, truncatedBy: [] },
    lift: { value: v, censored: false, censoredBy: null } as Measurement,
    liftUnmeasurableReason: null,
  });

  it("un lift non mesure ne score pas comme un lift de zero", () => {
    const unmeasured = scoreFeatures(base, P);
    const liftZero = scoreFeatures(measured(0), P);
    expect(unmeasured.correlationScore).toBeGreaterThan(liftZero.correlationScore);
    expect(unmeasured.compositeRenormalized).toBe(true);
    expect(liftZero.compositeRenormalized).toBe(false);
  });

  it("un lift non mesure plafonne la classification a 'watch' (defaut conservateur)", () => {
    const s = scoreFeatures(base, P);
    expect(s.classification).toBe("watch");
    expect(s.confidence).toBe("low");
    expect(s.limitations.some((l) => l.includes("SHILL-C1"))).toBe(true);
  });

  it("le plafond est une POLITIQUE, pas un cablage : le desarmer se voit", () => {
    const permissif: EnginePolicy = { ...P, unmeasuredLiftCapsClassification: false };
    const s = scoreFeatures(base, permissif);
    expect(s.classification).not.toBe("watch");
    // Meme desarme, le motif reste dit.
    expect(s.limitations.some((l) => l.includes("lift NON MESURE"))).toBe(true);
  });

  it("M2 opposable : un lift mesure SOUS le seuil ramene a 'watch'", () => {
    const s = scoreFeatures(measured(0.83), P);
    expect(s.classification).toBe("watch");
    expect(s.limitations.some((l) => l.includes("0.83"))).toBe(true);
  });

  it("un lift mesure AU-DESSUS du seuil ne declenche aucun plafond", () => {
    const s = scoreFeatures(measured(4), P);
    expect(s.classification).not.toBe("watch");
    expect(s.liftCounted).toBe(true);
    expect(s.compositeRenormalized).toBe(false);
  });
});
