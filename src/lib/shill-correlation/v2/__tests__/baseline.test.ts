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
import {
  AWAITING_RATIFICATION,
  DEFAULT_ENGINE_POLICY,
  RATIFIED,
  SHADOW_RATIFIED,
  SHILL_M1_DOCTRINE,
  TEMPORARILY_UNVALIDATED,
  type EnginePolicy,
} from "../policy";
import { baselineWindow } from "../windows";
import { onChainAnchorFromUtc } from "../anchor";
import { incrementalSpanSeconds } from "../cost";
import { buildBaselineSide, assessBaselineFloor } from "../tally";
import { computeLift } from "../features";
import { UNMEASURED, exactMeasurement } from "../../measurement";
import {
  ACTIVITY_LIFT_RESERVATIONS,
  ALL_BASELINE_STATES,
  ALL_OBSERVED_STATES,
  LIFT_UNMEASURABLE_REASONS,
  type OccasionRecord,
} from "../types";
import { runEngine } from "../engine";
import { buildAggregateInferenceEnvelope } from "../nature";
import { buildCandidateNatureWrite } from "../persistence";

// Fixtures deja en UTC vrai : on MARQUE l'ancre, on ne la convertit pas.
const OBSERVED_AT = onChainAnchorFromUtc(new Date("2026-06-03T18:57:00Z"));
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

// ═══ INVARIANT SHILL-M1 — INTEGRITE DU TEMOIN ══════════════════════════════
//
// Les trois clauses, chacune tenue par un test qui echoue si on la retire.

describe("SHILL-M1 §1 - separation temporelle", () => {
  it("un temoin qui recouvre la fenetre comportementale ne mesure RIEN", () => {
    const overlapping: EnginePolicy = { ...P, baselineOffsetSeconds: 1200 };
    const r = computeLift({
      policy: overlapping,
      observedRate: exactMeasurement(0.5),
      baselineRate: exactMeasurement(0.1),
      baselineOccurrences: 4,
      baselineFloor: { tally: { occasions: 3, buys: exactMeasurement(9), truncatedBy: [] }, verdict: "above" },
      observedFloor: { tally: { occasions: 3, buys: exactMeasurement(9), truncatedBy: [] }, verdict: "above" },
    });
    expect(r.lift).toBe(UNMEASURED);
    expect(r.reason).toBe("BASELINE_WINDOW_OVERLAPS_OBSERVED");
  });

  it("la separation est jugee SUR LA POLICY, pas sur les donnees collectees", () => {
    // Un temoin riche ne rachete pas un dispositif invalide : le refus tombe
    // avant tout examen du volume.
    const overlapping: EnginePolicy = { ...P, baselineOffsetSeconds: 100 };
    const r = computeLift({
      policy: overlapping,
      observedRate: exactMeasurement(0.9),
      baselineRate: exactMeasurement(0.9),
      baselineOccurrences: 999,
      baselineFloor: { tally: { occasions: 99, buys: exactMeasurement(999), truncatedBy: [] }, verdict: "above" },
      observedFloor: { tally: { occasions: 99, buys: exactMeasurement(999), truncatedBy: [] }, verdict: "above" },
    });
    expect(r.reason).toBe("BASELINE_WINDOW_OVERLAPS_OBSERVED");
  });
});

describe("SHILL-M1 §2 - integralite dans les bornes autorisees", () => {
  it("hors des bornes -> NOT_MEASURABLE, JAMAIS extrapole", async () => {
    const r = await collectBaselineWindow(target(), P, {
      fetchPage: async () => [txNewer(40_000, "s")],
      budget: createCallBudget(999),
      maxPagesPerOccasion: 2,
    });
    // Ni complete, ni extrapole : le comptage reste ce qui a ete VU, et il est
    // marque comme un plancher.
    expect(r.baselineTruncatedBy).toBe(PAGE_TRUNCATION_REASON);
    expect(r.baselineBuys).toHaveLength(0);
    expect(r.windowCovered).toBe(false);
    expect(r.baselineState).toBe("budget_exhausted");
  });

  it("le plafond vient de la POLICY, pas d'une constante enterree", async () => {
    // Un seuil a effet produit invisible est un seuil qu'on ne peut pas
    // ratifier. Changer la policy DOIT changer le comportement.
    const serre: EnginePolicy = { ...P, baselineMaxPagesPerOccasion: 1 };
    let calls = 0;
    const r = await collectBaselineWindow(target(), serre, {
      fetchPage: async () => {
        calls++;
        return [txNewer(40_000, `s${calls}`)];
      },
      budget: createCallBudget(999),
    });
    expect(calls).toBe(1);
    expect(r.baselineTruncatedBy).toBe(PAGE_TRUNCATION_REASON);
  });

  it("86 400 REVOQUE, 7 200 TEMPORAIREMENT NON VALIDE — la trace le montre", () => {
    // T3, 2026-09-04 : 7 200 etait SHADOW_RATIFIED sur une mesure faite avec
    // des ancres decalees de 2 h. La valeur ne change pas, son STATUT si.
    const revoque = RATIFIED.find(
      (x) => x.key === "baselineOffsetSeconds" && "status" in x && x.status === "REVOKED",
    );
    expect(revoque!.value).toBe(86_400);

    // Plus aucune valeur de shadow ratifiee : la liste existe et est vide.
    expect(SHADOW_RATIFIED).toHaveLength(0);

    const attente = TEMPORARILY_UNVALIDATED.find((x) => x.key === "baselineOffsetSeconds");
    expect(attente, "7 200 doit etre trace comme a reconfirmer").toBeDefined();
    expect(attente!.value).toBe(7_200);
    expect(attente!.requiresRevalidation).toBe(true);
    expect(attente!.finalDoctrine).toBe(false);
    // Ni REVOKED (rien ne dit qu'elle est fausse), ni ratifiee.
    expect(attente!.why).toContain("ancres decalees");
    expect(attente!.supersedes.status).toBe("SHADOW_RATIFIED");

    // La valeur qui TOURNE reste celle-la — on ne remet pas 86 400.
    expect(P.baselineOffsetSeconds).toBe(7_200);
    expect(P.baselineOffsetSeconds).toBeGreaterThan(1_500);
    expect(P.baselineMaxPagesPerOccasion).toBe(300);
    expect(RATIFIED.find((x) => x.key === "baselineMaxPagesPerOccasion")!.value).toBe(300);
  });
});

describe("SHILL-M1 §3 - existence de l'objet mesure", () => {
  it("un temoin anterieur a la 1re tx du token est CONSTATE, historique epuise", async () => {
    // Le cas mesure le 2026-09-03 : token pump.fun cree 31 min avant le tweet.
    let page = 0;
    const r = await collectBaselineWindow(target(), P, {
      fetchPage: async () => {
        page++;
        // Une seule tx, POSTERIEURE a la fenetre temoin, puis fin d'historique.
        return page === 1 ? [txNewer(90_000, "s1")] : [];
      },
      budget: createCallBudget(10),
    });
    expect(r.windowCovered).toBe(true);
    expect(r.baselinePrecedesTokenExistence).toBe(true);
  });

  it("sans historique epuise, l'anteriorite n'est PAS un constat", async () => {
    const r = await collectBaselineWindow(target(), P, {
      fetchPage: async () => [txNewer(90_000, "s")],
      budget: createCallBudget(2),
    });
    // On a arrete de regarder : « rien de plus ancien » ne veut rien dire.
    expect(r.baselinePrecedesTokenExistence).toBeNull();
  });

  it("le motif prime sur le jugement de VOLUME du temoin", () => {
    // Sans §3, ce cas ressortait BELOW_FLOOR - « pas assez d'achats temoin » -
    // ce qui envoie baisser un plancher au lieu de changer de dispositif.
    const r = computeLift({
      policy: P,
      observedRate: exactMeasurement(0.5),
      baselineRate: UNMEASURED,
      baselineOccurrences: 0,
      baselinePrecedesTokenExistence: true,
      baselineFloor: { tally: { occasions: 1, buys: exactMeasurement(0), truncatedBy: [] }, verdict: "below" },
      observedFloor: { tally: { occasions: 3, buys: exactMeasurement(9), truncatedBy: [] }, verdict: "above" },
    });
    expect(r.lift).toBe(UNMEASURED);
    expect(r.reason).toBe("BASELINE_PRECEDES_TOKEN_EXISTENCE");
  });
});

describe("SHILL-M1 - la reserve voyage avec l'inference", () => {
  it("l'enveloppe porte les quatre reserves, en base et pas en commentaire", () => {
    const env = buildAggregateInferenceEnvelope(
      { occasionIds: ["o1"], observationCount: 5, baselineBuyCount: 0, tokenResolutionWasInferred: false },
      P,
    );
    expect(env.basis.reservations).toEqual(ACTIVITY_LIFT_RESERVATIONS);
    expect(env.basis.reservations).toContain("proxy_minimum_not_exhaustive_buyer_count");
    expect(env.basis.reservations).toContain("observed_and_baseline_bias_equality_undemonstrated");
    expect(env.basis.reservations).toContain("correlation_feature_never_standalone_proof_of_coordination");
  });

  it("le fragment ecrit en base les porte dans natureBasis", () => {
    const env = buildAggregateInferenceEnvelope(
      { occasionIds: ["o1"], observationCount: 5, baselineBuyCount: 0, tokenResolutionWasInferred: false },
      P,
    );
    const w = buildCandidateNatureWrite({ kolHandle: "k", wallet: "w", chain: "solana", _nature: env });
    expect(w.natureBasis.reservations).toEqual(ACTIVITY_LIFT_RESERVATIONS);
  });
});


describe("SHILL-M1 - la doctrine est lue par un test, pas seulement ecrite", () => {
  it("les cinq clauses non conflictuelles sont posees", () => {
    expect(SHILL_M1_DOCTRINE.validPrehistory).toBe("MEASURABLE");
    expect(SHILL_M1_DOCTRINE.tokenTooYoung).toContain("BASELINE_PRECEDES_TOKEN_EXISTENCE");
    expect(SHILL_M1_DOCTRINE.paginationInsufficient).toContain("BASELINE_CENSORED");
    expect(SHILL_M1_DOCTRINE.partialBaselineNeverExtrapolated).toBe(true);
    expect(SHILL_M1_DOCTRINE.neverStandaloneProof).toBe(true);
  });

  it("le conflit avec unmeasuredLiftCapsClassification est TRANCHE", () => {
    // Ce test disait « DECLARE et NON tranche » jusqu'au 2026-09-03. Le
    // trancher l'a fait rougir - c'est ainsi qu'une doctrine change : par un
    // test qui tombe, jamais par un comportement qui glisse.
    expect(SHILL_M1_DOCTRINE.m1IsAdditionalConditional).toBe(true);
    expect(SHILL_M1_DOCTRINE.conflictResolved).toBe(true);
    expect(SHILL_M1_DOCTRINE.measuredM1Contributes).toBe(true);
    expect(SHILL_M1_DOCTRINE.unmeasuredM1NeitherRewardsNorPenalizes).toBe(true);
    expect(SHILL_M1_DOCTRINE.scoringIgnoresUnmeasurableReason).toBe(true);
    expect(SHILL_M1_DOCTRINE.reasonsPreservedInObservability).toBe(true);
  });

  it("le reverse est DATE et garde la decision anterieure", () => {
    const r = RATIFIED.find((x) => x.key === "unmeasuredLiftCapsClassification");
    expect(r!.value).toBe(false);
    expect(r!.supersedes).toEqual({ value: true, on: "2026-08-30", by: "fondateur" });
    expect(P.unmeasuredLiftCapsClassification).toBe(false);
  });
});

describe("SHILL-M1 - observabilite : aucun etat n'est invisible", () => {
  it("la telemetrie compte TOUS les etats declares, sans liste tenue a la main", () => {
    // Le trou reel du 2026-09-03 : `budget_exhausted` a ete ajoute au type et
    // journal.ts tenait sa propre liste. Le compteur incrementait `undefined`.
    // L'etat existait et etait invisible - T1 une couche plus bas.
    const t = runEngine([]).telemetry;
    for (const s of ALL_BASELINE_STATES) {
      expect(t.byBaselineState, `etat ${s} absent de la telemetrie`).toHaveProperty(s);
      expect(Number.isFinite(t.byBaselineState[s])).toBe(true);
    }
    for (const s of ALL_OBSERVED_STATES) {
      expect(t.byObservedState).toHaveProperty(s);
    }
  });

  it("fetched_empty et not_fetched restent DEUX compteurs distincts", () => {
    // Le defaut fondateur de v1 : 77 collectes rendant zero acheteur etaient
    // indiscernables d'un evenement jamais traite.
    const t = runEngine([]).telemetry;
    expect(t.byObservedState).toHaveProperty("fetched_empty");
    expect(t.byObservedState).toHaveProperty("not_fetched");
    expect(ALL_OBSERVED_STATES.filter((s) => s === "fetched_empty" || s === "not_fetched")).toHaveLength(2);
  });

  it("un budget epuise est COMPTE, pas seulement refuse", () => {
    const recs = [
      {
        occasion: { occasionId: "o1", kolHandle: "k", eventIds: ["e1"], tokenMint: "MintAAA", observedAt: OBSERVED_AT },
        resolved: null,
        observedState: "fetched_with_buyers",
        observations: [],
        observedStateDetail: null,
        observedTruncatedBy: null,
        baselineState: "budget_exhausted",
        baselineBuys: [],
        baselineStateDetail: null,
        baselineTruncatedBy: BUDGET_TRUNCATION_REASON,
      },
    ] as unknown as OccasionRecord[];
    const t = runEngine(recs).telemetry;
    expect(t.byBaselineState.budget_exhausted).toBe(1);
  });

  it("toute non-mesurabilite du lift porte un motif comptable", () => {
    const t = runEngine([]).telemetry;
    for (const reason of LIFT_UNMEASURABLE_REASONS) {
      expect(t.liftUnmeasurable).toHaveProperty(reason);
    }
    // Le motif neuf de SHILL-M1 §3 est compte comme les autres.
    expect(t.liftUnmeasurable).toHaveProperty("BASELINE_PRECEDES_TOKEN_EXISTENCE");
  });
});

describe("SHILL-M1 §3 - le motif est SUR LE CHEMIN, pas seulement dans le code", () => {
  // Le défaut trouvé au dry-run du 2026-09-03 : le collecteur produisait
  // `baselinePrecedesTokenExistence`, `computeLift` savait le lire, et RIEN ne
  // les reliait. `computeFeatures` ne le passait pas. Les tests §3 existants
  // appelaient `computeLift` DIRECTEMENT - ils ne pouvaient donc pas le voir.
  // Ceux-ci passent par `runEngine`, le vrai chemin.
  const rec = (id: string, opts: Partial<OccasionRecord>): OccasionRecord =>
    ({
      occasion: { occasionId: id, kolHandle: "kol_a", eventIds: [id], tokenMint: "MintAAA", observedAt: OBSERVED_AT },
      resolved: null,
      observedState: "fetched_with_buyers",
      observations: [
        { wallet: "W1", chain: "solana", behaviorType: "pre_tweet", deltaSecondsFromTweet: -100,
          txSignature: `sig-${id}`, exitDeltaSeconds: null },
      ],
      observedStateDetail: null,
      observedTruncatedBy: null,
      baselineState: "collected_empty",
      baselineBuys: [],
      baselineStateDetail: null,
      baselineTruncatedBy: null,
      ...opts,
    }) as unknown as OccasionRecord;

  it("via runEngine : un témoin antérieur au token rend le motif dédié", () => {
    const recs = [
      rec("o1", { baselinePrecedesTokenExistence: true }),
      rec("o2", { baselinePrecedesTokenExistence: true }),
      rec("o3", { baselinePrecedesTokenExistence: true }),
    ];
    const c = runEngine(recs, P).candidates.find((x) => x.wallet === "W1")!;
    expect(c.features.liftUnmeasurableReason).toBe("BASELINE_PRECEDES_TOKEN_EXISTENCE");
  });

  it("une seule occasion RÉELLEMENT mesurée suffit à écarter le motif", () => {
    // Refuser alors qu'on tient un dénominateur reviendrait à jeter une mesure.
    const recs = [
      rec("o1", { baselinePrecedesTokenExistence: true }),
      rec("o2", {
        baselinePrecedesTokenExistence: false,
        baselineState: "collected_with_buys",
        baselineBuys: [
          { wallet: "W9", chain: "solana", deltaSecondsFromBaselineAnchor: -10,
            firstBuyTxSignature: "b1", entryAmountUsd: null },
        ],
      }),
    ];
    const c = runEngine(recs, P).candidates.find((x) => x.wallet === "W1")!;
    expect(c.features.liftUnmeasurableReason).not.toBe("BASELINE_PRECEDES_TOKEN_EXISTENCE");
  });

  it("le motif est compté en télémétrie, pas seulement porté par le candidat", () => {
    const recs = [rec("o1", { baselinePrecedesTokenExistence: true })];
    const t = runEngine(recs, P).telemetry;
    expect(t.liftUnmeasurable.BASELINE_PRECEDES_TOKEN_EXISTENCE).toBeGreaterThan(0);
  });
});
