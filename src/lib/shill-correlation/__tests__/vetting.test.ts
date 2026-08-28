// --- Vetting comportemental + invariants SHILL-C1 / SHILL-C2 --------------
// Les tests de l'ancienne regle `high_frequency` ont ete REMPLACES : ils
// encodaient une doctrine invalidee le 2026-08-28 (seuil compare a une valeur
// plafonnee par le sampler). Ils sont conserves ici sous forme inversee - ce
// qu'ils exigeaient doit desormais etre impossible.

import { describe, it, expect } from "vitest";
import {
  classifyWalletProfile, CANDIDATE_RULES, DEFAULT_RULE, type VettingRule,
} from "../vetting";
import {
  compareToThreshold, censoredMeasurement, exactMeasurement, UNMEASURED,
  activityDensityPerDay, assertUsableAsCount, CensoredThresholdError,
} from "../measurement";
import type { WalletProfile } from "../wallet-profile";

const profile = (o: Partial<WalletProfile> = {}): WalletProfile => ({
  wallet: "W",
  txCount30d: 10,
  sampleSize: 10,
  sampleSaturated: false,
  sampleSpanDays: 30,
  distinctTokenAccounts: 5,
  infraHits: [],
  heliusCalls: 0,
  ...o,
});

describe("SHILL-C1 — une valeur censuree ne franchit jamais seule un seuil", () => {
  it("une mesure censuree rend `indeterminate`, jamais un booleen", () => {
    const m = censoredMeasurement(1000, "getSignaturesForAddress(limit=1000)");
    expect(compareToThreshold(m, 750)).toBe("indeterminate");
    expect(compareToThreshold(m, 5000)).toBe("indeterminate");
  });

  it("une mesure exacte tranche normalement", () => {
    expect(compareToThreshold(exactMeasurement(1000), 750)).toBe("above");
    expect(compareToThreshold(exactMeasurement(700), 750)).toBe("below");
  });

  it("une mesure absente rend `indeterminate`, jamais zero", () => {
    expect(compareToThreshold(UNMEASURED, 0)).toBe("indeterminate");
  });

  it("utiliser une valeur censuree comme comptage leve", () => {
    const m = censoredMeasurement(1000, "sampler");
    expect(() => assertUsableAsCount(m, "txCount30d")).toThrow(CensoredThresholdError);
    expect(assertUsableAsCount(exactMeasurement(42), "ok")).toBe(42);
  });

  it("LE CAS REEL : txCount30d=1000 sature n'exclut plus rien a lui seul", () => {
    // Les 20 wallets exclus portaient exactement cette valeur.
    const v = classifyWalletProfile(
      profile({ txCount30d: 1000, sampleSize: 1000, sampleSaturated: true, sampleSpanDays: 30, distinctTokenAccounts: 7 }),
      { distinctKolCount: 1 },
    );
    expect(v.excludedReason).toBeNull();
    expect(v.dimensionsMet).toEqual([]);
  });
});

describe("SHILL-C2 — l'etat de collecte n'est pas une affirmation comportementale", () => {
  it("sampleSaturated ne produit jamais d'exclusion par lui-meme", () => {
    const v = classifyWalletProfile(
      profile({ sampleSaturated: true, sampleSize: 1000, sampleSpanDays: 45, distinctTokenAccounts: 3 }),
      { distinctKolCount: 1 },
    );
    expect(v.collectionSaturated).toBe(true); // rapporte...
    expect(v.excludedReason).toBeNull();      // ... et sans effet
  });

  it("la saturation est rapportee pour l'audit, hors de toute decision", () => {
    const v = classifyWalletProfile(profile({ sampleSaturated: true }), { distinctKolCount: 1 });
    expect(v).toHaveProperty("collectionSaturated");
    expect(v.evidence.every((e) => e.dimension !== ("saturation" as never))).toBe(true);
  });

  it("`high_frequency` n'existe plus comme motif", () => {
    const reasons = new Set<string>();
    for (const toks of [0, 60, 500, 600000]) {
      for (const kols of [1, 3]) {
        const v = classifyWalletProfile(
          profile({ distinctTokenAccounts: toks, sampleSize: 1000, sampleSpanDays: 1, sampleSaturated: true }),
          { distinctKolCount: kols },
        );
        if (v.excludedReason) reasons.add(v.excludedReason);
      }
    }
    expect([...reasons]).not.toContain("high_frequency");
  });
});

describe("indiscriminate_activity — plusieurs dimensions independantes", () => {
  it("UNE seule dimension n'exclut jamais", () => {
    // Avoirs enormes, mais un seul KOL et densite faible.
    const v = classifyWalletProfile(
      profile({ distinctTokenAccounts: 567_495, sampleSize: 100, sampleSpanDays: 100 }),
      { distinctKolCount: 1 },
    );
    expect(v.dimensionsMet).toEqual(["holdings"]);
    expect(v.excludedReason).toBeNull();
  });

  it("deux dimensions suffisent", () => {
    const v = classifyWalletProfile(
      profile({ distinctTokenAccounts: 1784, sampleSize: 100, sampleSpanDays: 100 }),
      { distinctKolCount: 3 },
    );
    expect(v.dimensionsMet).toEqual(["holdings", "cross_kol"]);
    expect(v.excludedReason).toBe("indiscriminate_activity");
  });

  it("une regle a une seule dimension est structurellement refusee", () => {
    const bad: VettingRule = { ...DEFAULT_RULE, requiredDimensions: 1 };
    expect(() => classifyWalletProfile(profile(), {}, bad)).toThrow(/au moins deux/);
  });

  it("une dimension indeterminee ne contribue pas a l'exclusion", () => {
    // Pas de contexte KOL, pas de span -> seules les avoirs sont mesurees.
    const v = classifyWalletProfile(profile({ distinctTokenAccounts: 999, sampleSpanDays: null }), {});
    expect(v.dimensionsMet).toEqual(["holdings"]);
    expect(v.excludedReason).toBeNull();
  });

  it("bot_infra reste une preuve directe, independante des seuils", () => {
    const v = classifyWalletProfile(profile({ infraHits: ["jito"] }), { distinctKolCount: 1 });
    expect(v.flags).toContain("bot_infra");
    expect(v.excludedReason).toBe("bot_infra");
  });
});

describe("Densite — ce que la saturation ne detruit pas", () => {
  it("1000 signatures sur 3 jours font 333/jour, et c'est exact", () => {
    const m = activityDensityPerDay(1000, 3);
    expect(m.censored).toBe(false);
    expect(Math.round(m.value)).toBe(333);
  });

  it("1000 signatures sur 29 jours font ~34/jour - le meme plafond, un autre wallet", () => {
    expect(Math.round(activityDensityPerDay(1000, 29).value)).toBe(34);
  });

  it("sans fenetre connue, la densite est absente, pas nulle", () => {
    expect(compareToThreshold(activityDensityPerDay(1000, null), 1)).toBe("indeterminate");
  });

  it("la densite separe deux wallets que l'ancien seuil confondait", () => {
    const dense = classifyWalletProfile(
      profile({ sampleSize: 1000, sampleSaturated: true, sampleSpanDays: 2, distinctTokenAccounts: 300 }),
      { distinctKolCount: 1 },
    );
    const lent = classifyWalletProfile(
      profile({ sampleSize: 1000, sampleSaturated: true, sampleSpanDays: 29, distinctTokenAccounts: 300 }),
      { distinctKolCount: 1 },
    );
    expect(dense.dimensionsMet).toContain("density");
    expect(lent.dimensionsMet).not.toContain("density");
    expect(dense.excludedReason).toBe("indiscriminate_activity");
    expect(lent.excludedReason).toBeNull();
  });
});

describe("zone_a n'est pas une cause d'exclusion", () => {
  it("aucune dimension du vetting ne porte sur le timing des achats", () => {
    const dims = classifyWalletProfile(profile(), { distinctKolCount: 1 }).evidence.map((e) => e.dimension);
    expect(dims).toEqual(["holdings", "density", "cross_kol"]);
    expect(dims).not.toContain("zone_a" as never);
  });
});

describe("Regles candidates — aucune n'est ratifiee", () => {
  it("les trois variantes exigent >= 2 dimensions", () => {
    expect(CANDIDATE_RULES).toHaveLength(3);
    expect(CANDIDATE_RULES.every((r) => r.requiredDimensions >= 2)).toBe(true);
  });

  it("R1 n'a qu'une dimension exploitable : elle ne peut donc jamais exclure", () => {
    const r1 = CANDIDATE_RULES.find((r) => r.name === "R1-holdings-legacy")!;
    const v = classifyWalletProfile(
      profile({ distinctTokenAccounts: 567_495, sampleSize: 1000, sampleSpanDays: 1 }),
      { distinctKolCount: 3 }, r1,
    );
    expect(v.dimensionsMet).toEqual(["holdings"]);
    expect(v.excludedReason).toBeNull();
  });
});
