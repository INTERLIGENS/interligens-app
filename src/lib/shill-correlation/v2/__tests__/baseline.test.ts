// --- D/M1 - le collecteur temoin, et la regle du budget -------------------
//
// Ce que ces tests tiennent : quand le budget est atteint, le systeme REFUSE
// de mesurer et le dit. Il ne rend jamais un temoin partiel qu'un lecteur
// pourrait prendre pour comparable.
//
// Le cas qui compte le plus est le moins intuitif : ZERO ACHAT SUR UNE FENETRE
// TRONQUEE N'EST PAS ZERO ACHAT. C'est « zero dans ce qu'on a regarde ». Un
// temoin vide est le denominateur le plus favorable possible - le confondre
// avec une mesure produirait le lift le plus faux dans la direction qui
// flatte le produit.

import { describe, it, expect } from "vitest";
import {
  BUDGET_TRUNCATION_REASON,
  PAGE_TRUNCATION_REASON,
  collectBaselineWindow,
  createCallBudget,
  extractBaselineBuys,
  type BaselineTx,
} from "../baseline";
import { DEFAULT_ENGINE_POLICY, type EnginePolicy } from "../policy";
import { baselineWindow } from "../windows";
import { incrementalSpanSeconds } from "../cost";
import { buildBaselineSide, assessBaselineFloor } from "../tally";
import { computeLift } from "../features";
import { UNMEASURED, exactMeasurement } from "../../measurement";
import type { OccasionRecord } from "../types";

const OBSERVED_AT = new Date("2026-06-03T18:57:00Z");
const P = DEFAULT_ENGINE_POLICY;

const target = (mint: string | null = "MintAAA") => ({
  occasionId: "occ-1",
  kolHandle: "empire_sol1",
  mint,
  chain: "solana",
  observedAt: OBSERVED_AT,
});

/** Une transaction dans la fenetre temoin, a `delta` secondes de son ancre. */
function txInBaseline(delta: number, wallet: string, sig: string): BaselineTx {
  const anchor = Math.floor(baselineWindow(OBSERVED_AT, P).anchorMs / 1000);
  return {
    signature: sig,
    timestamp: anchor + delta,
    type: "SWAP",
    tokenTransfers: [{ toUserAccount: wallet, mint: "MintAAA", tokenAmount: 10 }],
  };
}

/** Une transaction PLUS RECENTE que la fenetre - le prix du seek absent. */
function txNewer(secondsAfterAnchor: number, sig: string): BaselineTx {
  const anchor = Math.floor(baselineWindow(OBSERVED_AT, P).anchorMs / 1000);
  return { signature: sig, timestamp: anchor + secondsAfterAnchor, type: "SWAP", tokenTransfers: [] };
}

describe("D/M1 - le budget refuse, et le dit", () => {
  it("budget epuise AVANT la premiere page : budget_exhausted, pas not_collected", async () => {
    // La distinction est tout l'objet de l'etat : « on a demande, le budget a
    // refuse » n'est pas « personne n'a demande ». Le second enverrait
    // chercher un collecteur manquant au lieu d'un budget trop bas.
    const r = await collectBaselineWindow(target(), P, {
      fetchPage: async () => {
        throw new Error("le fetch ne doit JAMAIS etre appele budget a zero");
      },
      budget: createCallBudget(0),
    });

    expect(r.baselineState).toBe("budget_exhausted");
    expect(r.baselineTruncatedBy).toBe(BUDGET_TRUNCATION_REASON);
    expect(r.callsSpent).toBe(0);
  });

  it("budget epuise EN COURS : la troncature est nommee, jamais tue", async () => {
    const budget = createCallBudget(2);
    let calls = 0;
    const r = await collectBaselineWindow(target(), P, {
      fetchPage: async () => {
        calls++;
        // Des pages toujours plus recentes que la fenetre : on ne l'atteint
        // jamais, exactement le cas du token actif et de l'evenement ancien.
        return [txNewer(50_000 - calls * 10, `s${calls}`)];
      },
      budget,
    });

    expect(calls).toBe(2);
    expect(budget.remaining()).toBe(0);
    expect(r.baselineTruncatedBy).toBe(BUDGET_TRUNCATION_REASON);
    expect(r.windowCovered).toBe(false);
  });

  it("ZERO achat sur une fenetre TRONQUEE n'est pas `collected_empty`", async () => {
    // Le test qui compte. `collected_empty` est declare « une MESURE » par
    // types.ts, et compte au denominateur du taux temoin. Le poser sur une
    // fenetre jamais atteinte fabriquerait un temoin vide - le denominateur le
    // plus favorable qui soit - a partir d'un budget epuise.
    const r = await collectBaselineWindow(target(), P, {
      fetchPage: async () => [txNewer(40_000, "s1")],
      budget: createCallBudget(1),
    });

    expect(r.baselineBuys).toHaveLength(0);
    expect(r.baselineState).not.toBe("collected_empty");
    expect(r.baselineState).toBe("budget_exhausted");
  });

  it("un vide EST une mesure quand la fenetre a ete vue en entier", async () => {
    const r = await collectBaselineWindow(target(), P, {
      fetchPage: async () => [],
      budget: createCallBudget(4),
    });
    expect(r.baselineState).toBe("collected_empty");
    expect(r.baselineTruncatedBy).toBeNull();
    expect(r.windowCovered).toBe(true);
  });

  it("le plafond de pages par occasion tronque aussi, sous son propre nom", async () => {
    const r = await collectBaselineWindow(target(), P, {
      fetchPage: async () => [txNewer(40_000, "s")],
      budget: createCallBudget(999),
      maxPagesPerOccasion: 3,
    });
    expect(r.baselineTruncatedBy).toBe(PAGE_TRUNCATION_REASON);
    expect(r.callsSpent).toBe(3);
  });

  it("un echec de fetch est un echec, jamais un vide", async () => {
    const r = await collectBaselineWindow(target(), P, {
      fetchPage: async () => {
        throw new Error("helius 503");
      },
      budget: createCallBudget(4),
    });
    expect(r.baselineState).toBe("collect_error");
    expect(r.baselineStateDetail).toContain("503");
  });
});

describe("D/M1 - rien n'est depense pour un chiffre qui ne mesurerait rien", () => {
  it("un temoin qui recouvre l'observation n'engage AUCUN appel", async () => {
    // baselineOffsetSeconds <= largeur : les deux fenetres se recouvrent, le
    // temoin se comparerait a lui-meme. Payer pour ca serait payer pour rien.
    const overlapping: EnginePolicy = { ...P, baselineOffsetSeconds: 600 };
    let called = false;
    const r = await collectBaselineWindow(target(), overlapping, {
      fetchPage: async () => {
        called = true;
        return [];
      },
      budget: createCallBudget(10),
    });
    expect(called).toBe(false);
    expect(r.callsSpent).toBe(0);
    expect(r.baselineState).toBe("not_collected");
  });

  it("un ticker non resolu n'engage AUCUN appel", async () => {
    let called = false;
    const r = await collectBaselineWindow(target(null), P, {
      fetchPage: async () => {
        called = true;
        return [];
      },
      budget: createCallBudget(10),
    });
    expect(called).toBe(false);
    expect(r.baselineStateDetail).toContain("mint non resolu");
  });
});

describe("D/M1 - l'ancre du temoin est la sienne, pas celle du tweet", () => {
  it("les achats temoin sont dates contre l'ancre DECALEE", async () => {
    // Le piege : classer un achat temoin contre le tweet reel donne un delta
    // de -24 h, donc hors fenetre, donc un temoin systematiquement vide. Le
    // dispositif s'annulerait sans qu'aucun test ne tombe.
    const anchor = Math.floor(baselineWindow(OBSERVED_AT, P).anchorMs / 1000);
    const buys = extractBaselineBuys(
      [txInBaseline(-120, "W1", "s1"), txInBaseline(300, "W2", "s2")],
      "MintAAA",
      anchor,
      "solana",
    );
    expect(buys).toHaveLength(2);
    expect(buys[0].deltaSecondsFromBaselineAnchor).toBe(-120);
    expect(buys[0].firstBuyTxSignature).toBe("s1");
  });

  it("un achat hors fenetre presente dans la page n'entre pas", async () => {
    const anchor = Math.floor(baselineWindow(OBSERVED_AT, P).anchorMs / 1000);
    const buys = extractBaselineBuys([txInBaseline(99_999, "W9", "s9")], "MintAAA", anchor, "solana");
    expect(buys).toHaveLength(0);
  });

  it("le collecteur trouve les acheteurs quand la fenetre est atteinte", async () => {
    let page = 0;
    const r = await collectBaselineWindow(target(), P, {
      fetchPage: async () => {
        page++;
        if (page === 1) return [txInBaseline(300, "W1", "s1"), txInBaseline(-100, "W2", "s2")];
        return []; // historique epuise
      },
      budget: createCallBudget(5),
    });
    expect(r.baselineState).toBe("collected_with_buys");
    expect(r.baselineBuys.map((b) => b.wallet).sort()).toEqual(["W1", "W2"]);
    expect(r.baselineTruncatedBy).toBeNull();
  });
});

describe("D/M1 - la troncature remonte jusqu'au motif de non-mesurabilite", () => {
  const record = (
    baselineState: OccasionRecord["baselineState"],
    baselineTruncatedBy: string | null,
  ): OccasionRecord =>
    ({
      occasion: {
        occasionId: "occ-1",
        kolHandle: "empire_sol1",
        tokenMint: "MintAAA",
        chain: "solana",
        observedAt: OBSERVED_AT,
      },
      resolved: null,
      observedState: "fetched_with_buyers",
      observations: [],
      observedStateDetail: null,
      observedTruncatedBy: null,
      baselineState,
      baselineBuys: [],
      baselineStateDetail: null,
      baselineTruncatedBy,
    }) as unknown as OccasionRecord;

  const liftFor = (recs: OccasionRecord[]) => {
    // `assessBaselineFloor` prend un BaselineSide, jamais un tally : sa
    // signature etroite est le dispositif anti-addition de tally.ts.
    return computeLift({
      policy: P,
      observedRate: exactMeasurement(0.5),
      baselineRate: UNMEASURED,
      baselineOccurrences: 1,
      baselineFloor: assessBaselineFloor(buildBaselineSide(recs), P),
      observedFloor: { tally: { occasions: 3, buys: exactMeasurement(9), truncatedBy: [] }, verdict: "above" },
    });
  };

  it("budget epuise -> BASELINE_CENSORED, PAS BASELINE_NOT_COLLECTED", () => {
    // Le trou ferme par ce build : sans le relevement de la troncature, une
    // occasion `budget_exhausted` etait sautee, la tally rendait 0 occasion,
    // et le motif devenait « jamais collecte » - un diagnostic faux qui
    // envoie corriger au mauvais endroit.
    const r = liftFor([record("budget_exhausted", BUDGET_TRUNCATION_REASON)]);
    expect(r.lift).toBe(UNMEASURED);
    expect(r.reason).toBe("BASELINE_CENSORED");
  });

  it("temoin reellement jamais demande -> BASELINE_NOT_COLLECTED, motif distinct", () => {
    const r = liftFor([record("not_collected", null)]);
    expect(r.reason).toBe("BASELINE_NOT_COLLECTED");
  });

  it("un seul temoin tronque suffit a censurer le cote entier", () => {
    // Melanger un temoin complet et un temoin tronque ne rend PAS le total
    // exploitable : le comptage global reste un plancher.
    const r = liftFor([
      record("collected_empty", null),
      record("budget_exhausted", BUDGET_TRUNCATION_REASON),
    ]);
    expect(r.reason).toBe("BASELINE_CENSORED");
  });
});

describe("D/M1 - l'algebre du cout", () => {
  it("l'increment imputable vaut EXACTEMENT le decalage du temoin", () => {
    // C'est le resultat qui fait du decalage un levier de cout et non un
    // reglage sans consequence : 24 h de decalage = 24 h d'historique en plus.
    for (const offset of [7200, 14400, 86400, 172800]) {
      expect(incrementalSpanSeconds(offset)).toBe(offset);
    }
  });

  it("l'increment ne compte PAS deux fetchs - l'observation est deja payee", () => {
    // L'erreur naturelle serait de compter la fenetre observee deux fois.
    // Un increment egal a `offset + largeur` la compterait ; il vaut `offset`.
    expect(incrementalSpanSeconds(86400)).toBeLessThan(86400 + 1500);
  });
});
