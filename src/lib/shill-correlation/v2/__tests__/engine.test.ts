// --- Invariants du moteur : doctrine, journal, nature ---------------------

import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { findInconsistencies, baselineStateAfterFetch, observedStateAfterFetch, notCollected } from "../journal";
import { buildInferenceEnvelope, ENGINE_POLICY_VERSION, InferenceOnlyViolation } from "../nature";
import { DEFAULT_ENGINE_POLICY, AWAITING_RATIFICATION, RATIFIED, type EnginePolicy } from "../policy";
import {
  baselineCollected,
  baselineCollectedEmpty,
  baselineBuy,
  buy,
  occasion,
  record,
} from "../__fixtures__/corpus";

const P = DEFAULT_ENGINE_POLICY;

const corpus = () =>
  Array.from({ length: 8 }, (_, i) =>
    record(occasion(`o${i}`, "kol_a", i * 120), {
      observations: [buy("W1", "pre_tweet", -100, `s${i}`), buy("W2", "post_tweet", 300, `t${i}`)],
      baseline:
        i < 4
          ? baselineCollected([baselineBuy("W1", -100, `b${i}`), baselineBuy("W2", -50, `c${i}`)])
          : baselineCollectedEmpty(),
    }),
  );

describe("doctrine", () => {
  it("reviewStatus vaut toujours 'draft'", () => {
    for (const c of runEngine(corpus(), P).candidates) expect(c.reviewStatus).toBe("draft");
  });

  it("la nature de sortie est toujours INFERENCE", () => {
    for (const c of runEngine(corpus(), P).candidates) {
      expect(c._nature.nature).toBe("INFERENCE");
      expect(c._nature.basis.inputNatures).toContain("PRIMARY_OBSERVATION");
      expect(c._nature.policyVersion).toBe(ENGINE_POLICY_VERSION);
    }
  });

  it("desarmer outputIsInferenceOnly leve, ne degrade pas", () => {
    const bad: EnginePolicy = { ...P, outputIsInferenceOnly: false };
    expect(() => buildInferenceEnvelope([], bad)).toThrow(InferenceOnlyViolation);
  });

  it("l'enveloppe distingue le volume observe du volume temoin", () => {
    const c = runEngine(corpus(), P).candidates[0];
    expect(c._nature.basisRefs.observationCount).toBeGreaterThan(0);
    expect(c._nature.basisRefs.occasionIds.length).toBeGreaterThan(0);
  });

  it("la politique declare encore ce qui n'est pas ratifie", () => {
    expect(AWAITING_RATIFICATION).toContain("minBaselineBuys");
    expect(AWAITING_RATIFICATION).toContain("minObservedBuys");
  });

  it("unmeasuredLiftCapsClassification est REVERSE le 2026-09-03, avec sa trace", () => {
    // Ratifie `true` le 2026-08-30 (fondateur), reverse a `false` le
    // 2026-09-03 (architecte) sur preuve de la sonde M1. La decision anterieure
    // n'est pas effacee : elle est SUPERSEDEE. Une ratification qui disparait
    // sans trace laisse croire qu'elle n'a jamais eu lieu.
    expect(AWAITING_RATIFICATION).not.toContain("unmeasuredLiftCapsClassification");
    const r = RATIFIED.find((x) => x.key === "unmeasuredLiftCapsClassification");
    expect(r).toBeDefined();
    expect(r!.value).toBe(false);
    expect(r!.on).toBe("2026-09-03");
    expect(r!.by).toBe("architecte");
    expect(r!.note).toContain("sonde M1");
    expect(r!.supersedes).toEqual({ value: true, on: "2026-08-30", by: "fondateur" });
    expect(DEFAULT_ENGINE_POLICY.unmeasuredLiftCapsClassification).toBe(false);
  });
});

describe("journal", () => {
  it("un corpus coherent ne produit aucune incoherence", () => {
    const r = runEngine(corpus(), P);
    expect(r.telemetry.inconsistencies).toEqual([]);
  });

  it("les occasions ayant contribue passent a 'scored'", () => {
    const r = runEngine(corpus(), P);
    expect(r.records.every((x) => x.observedState === "scored")).toBe(true);
  });

  it("un temoin 'collected_empty' portant des achats est signale", () => {
    const bad = corpus().map((r) => ({
      ...r,
      baselineState: "collected_empty" as const,
      baselineBuys: [baselineBuy("W1", -100, "x")],
    }));
    expect(findInconsistencies(bad, []).join(" ")).toContain("'collected_empty' portent pourtant des achats");
  });

  it("des achats temoin sous un etat non collecte sont signales", () => {
    const bad = corpus().map((r) => ({
      ...r,
      baselineState: "not_collected" as const,
      baselineBuys: [baselineBuy("W1", -100, "x")],
    }));
    expect(findInconsistencies(bad, []).join(" ")).toContain("ne comptent nulle part");
  });

  it("les deriveurs d'etat distinguent vide-collecte et erreur", () => {
    expect(baselineStateAfterFetch([]).baselineState).toBe("collected_empty");
    expect(baselineStateAfterFetch([], "429").baselineState).toBe("collect_error");
    expect(baselineStateAfterFetch([1]).baselineState).toBe("collected_with_buys");
    expect(observedStateAfterFetch([]).observedState).toBe("fetched_empty");
    expect(notCollected().baselineState).toBe("not_collected");
    expect(notCollected().observedState).toBe("not_fetched");
  });
});

describe("correctif #1 - l'unite reste l'OCCASION", () => {
  it("deux collectes du meme achat dans une occasion ne comptent qu'une fois", () => {
    const o = occasion("dup", "kol_dup", 0);
    const r = record(o, {
      observations: [
        buy("W1", "pre_tweet", -100, "SIG-UNIQUE"),
        buy("W1", "pre_tweet", -100, "SIG-UNIQUE"),
      ],
      baseline: baselineCollectedEmpty(),
    });
    const res = runEngine([r], P);
    const c = res.candidates.find((x) => x.wallet === "W1")!;
    expect(c.features.preTweetCount).toBe(1);
    expect(c.features.observedTally.buys.value).toBe(1);
  });
});

describe("correctif #2 - le plancher de n", () => {
  it("une occasion unique ne credite pas le ratio", () => {
    const r = record(occasion("solo", "kol_solo", 0), {
      observations: [buy("W1", "pre_tweet", -100, "s")],
      baseline: baselineCollectedEmpty(),
    });
    const c = runEngine([r], P).candidates[0];
    expect(c.features.ratioObserved).toBe(1);
    expect(c.scores.ratioCredited).toBe(false);
    expect(c.scores.classification).toBe("watch");
  });
});
