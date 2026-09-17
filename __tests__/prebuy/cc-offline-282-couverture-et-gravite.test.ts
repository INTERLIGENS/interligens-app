// ─── CC-OFFLINE-282 — LA COUVERTURE EST UN PORTAIL, PAS UN RÉDUCTEUR ───────
//
// ██  LA COUVERTURE PEUT RESTREINDRE UNE PERMISSION.                       ██
// ██  LA COUVERTURE NE DOIT JAMAIS RÉDUIRE UNE GRAVITÉ ÉTABLIE.            ██
//
// Deux contrats déjà ratifiés se contredisaient dans l'ordre où ils étaient
// évalués :
//
//   1 · « un STOP reste un BLOCK » — écrit dans `projectPreBuy` pour le cas
//       jumeau de l'identité non résolue ;
//   2 · « une couverture requise insuffisante ne peut pas produire ALLOW ».
//
// Le portail `expectedMeasured === 0` passait AVANT les bornes de score : une
// gravité de 95 y perdait son STOP. Ces quatre cas APPARIÉS tiennent la
// composition corrigée, et le CAS 4 est le témoin critique.

import { describe, it, expect } from "vitest";
import { canonicalPreBuyDecision, SEUIL_CRITIQUE, SEUIL_ELEVE } from "@/lib/prebuy/canonicalDecision";
import { projectPreBuy } from "@/lib/prebuy/projection";
import type { FaitsDeMesure } from "@/lib/prebuy/canonicalDecision";

/** Identité résolue : on isole l'axe COUVERTURE, et lui seul. */
const IDENTITE = { resolved: true as const, authorities: ["market_pair"] };

const couverture = (mesurees: number): FaitsDeMesure => ({
  expected: 3,
  expectedMeasured: mesurees,
  missing: mesurees < 3
    ? [{ engine: "off_chain_claims", reason: "NOT_MEASURED" as const }]
    : [],
});

const decider = (score: number, mesurees: number) =>
  canonicalPreBuyDecision({ score, measurement: couverture(mesurees), identity: IDENTITE as never });

const niveau = (score: number, mesurees: number) => projectPreBuy(decider(score, mesurees)).level;

const SANS_RISQUE = 10;        // sous SEUIL_ELEVE
const GRAVITE_BLOCK = 95;      // au-dessus de SEUIL_CRITIQUE

// ═══ LES QUATRE CAS APPARIÉS ════════════════════════════════════════════════

describe("CC-OFFLINE-282 · les quatre cas appariés", () => {
  it("CAS 1 · aucune gravité BLOCK · couverture requise INSUFFISANTE → WARN", () => {
    const d = decider(SANS_RISQUE, 2);
    expect(d.expectedContractSatisfied).toBe(false);
    expect(niveau(SANS_RISQUE, 2)).toBe("WARN");
  });

  it("CAS 2 · MÊME entrée à risque faible · couverture SUFFISANTE → ALLOW reste atteignable", () => {
    const d = decider(SANS_RISQUE, 3);
    expect(d.expectedContractSatisfied).toBe(true);
    expect(d.degraded).toBe(false);
    expect(niveau(SANS_RISQUE, 3)).toBe("ALLOW");
  });

  it("CAS 3 · gravité BLOCK établie · couverture SUFFISANTE → BLOCK", () => {
    expect(decider(GRAVITE_BLOCK, 3).verdict).toBe("STOP");
    expect(niveau(GRAVITE_BLOCK, 3)).toBe("BLOCK");
  });

  // ─── LE TÉMOIN CRITIQUE ─────────────────────────────────────────────────
  it("CAS 4 · MÊME gravité BLOCK · couverture INSUFFISANTE ou NULLE → BLOCK", () => {
    // Deux paliers d'ignorance, et aucun ne relâche la gravité.
    for (const mesurees of [2, 1, 0]) {
      const d = decider(GRAVITE_BLOCK, mesurees);
      expect(d.verdict, `couverture ${mesurees}/3`).toBe("STOP");
      expect(d.verdictSource, `couverture ${mesurees}/3`).toBe("LEGACY_SCORE");
      expect(niveau(GRAVITE_BLOCK, mesurees), `couverture ${mesurees}/3`).toBe("BLOCK");
    }
  });

  it("LA MATRICE COMPLÈTE — couverture × gravité, et rien d'autre ne bouge", () => {
    expect({
      "risque faible · couvert": niveau(SANS_RISQUE, 3),
      "risque faible · partiel": niveau(SANS_RISQUE, 2),
      "risque faible · nul": niveau(SANS_RISQUE, 0),
      "risque élevé · couvert": niveau(SEUIL_ELEVE, 3),
      "risque élevé · nul": niveau(SEUIL_ELEVE, 0),
      "gravité BLOCK · couvert": niveau(GRAVITE_BLOCK, 3),
      "gravité BLOCK · nul": niveau(GRAVITE_BLOCK, 0),
    }).toEqual({
      "risque faible · couvert": "ALLOW",
      "risque faible · partiel": "WARN",
      "risque faible · nul": "WARN",
      "risque élevé · couvert": "WARN",
      "risque élevé · nul": "WARN",
      "gravité BLOCK · couvert": "BLOCK",
      "gravité BLOCK · nul": "BLOCK",
    });
  });
});

// ═══ M8 · M9 — LES DEUX MUTANTS NOUVEAUX ════════════════════════════════════

describe("CC-OFFLINE-282 · M8 — une gravité BLOCK + couverture nulle ne devient JAMAIS WARN", () => {
  it("le seuil exact, et un cran au-dessus", () => {
    for (const score of [SEUIL_CRITIQUE, SEUIL_CRITIQUE + 1, 100]) {
      expect(niveau(score, 0), `score ${score}`).toBe("BLOCK");
    }
  });

  it("et le cran EN DESSOUS du seuil ne devient pas BLOCK pour autant", () => {
    // La préséance ne déborde pas : elle ne protège QUE la gravité établie.
    expect(niveau(SEUIL_CRITIQUE - 1, 0)).toBe("WARN");
    expect(decider(SEUIL_CRITIQUE - 1, 0).verdict).toBe("INSUFFICIENT_COVERAGE");
  });
});

describe("CC-OFFLINE-282 · M9 — le portail de couverture ne s'exécute pas comme réducteur", () => {
  it("il ne s'applique QU'EN L'ABSENCE de gravité établie", () => {
    // Sans gravité : le portail mord, et il nomme sa source.
    const sans = decider(SANS_RISQUE, 0);
    expect(sans.verdict).toBe("INSUFFICIENT_COVERAGE");
    expect(sans.verdictSource).toBe("NO_MEASUREMENT");

    // Avec gravité : le portail ne mord pas, et la source reste le score.
    const avec = decider(GRAVITE_BLOCK, 0);
    expect(avec.verdict).toBe("STOP");
    expect(avec.verdictSource).toBe("LEGACY_SCORE");
  });

  it("la COUVERTURE RAPPORTÉE reste inchangée — on ne maquille pas le manque", () => {
    // La gravité l'emporte sur la DÉCISION ; elle ne réécrit pas les FAITS.
    const d = decider(GRAVITE_BLOCK, 0);
    expect(d.coverage.expectedMeasured).toBe(0);
    expect(d.expectedContractSatisfied).toBe(false);
    expect(d.degraded).toBe(true);
    expect(d.coverage.missing.map((m) => m.engine)).toContain("off_chain_claims");
  });

  it("⛔ AUCUNE AUTRE PRÉSÉANCE N'A BOUGÉ", () => {
    // REFLEX reste l'autorité première, y compris contre une gravité de score.
    const reflex = canonicalPreBuyDecision({
      reflexVerdict: "NO_CRITICAL_SIGNAL",
      score: GRAVITE_BLOCK,
      measurement: couverture(0),
      identity: IDENTITE as never,
    });
    expect(reflex.verdict).toBe("NO_CRITICAL_SIGNAL");
    expect(reflex.verdictSource).toBe("REFLEX");

    // `score: null` reste une ABSENCE DE MESURE, jamais une gravité.
    const sansScore = canonicalPreBuyDecision({
      score: null, measurement: couverture(3), identity: IDENTITE as never,
    });
    expect(sansScore.verdict).toBe("INSUFFICIENT_COVERAGE");
    expect(sansScore.verdictSource).toBe("NO_MEASUREMENT");

    // Et les bornes elles-mêmes sont intactes.
    expect(decider(SEUIL_ELEVE, 3).verdict).toBe("VERIFY");
    expect(decider(SEUIL_ELEVE - 1, 3).verdict).toBe("NO_CRITICAL_SIGNAL");
  });
});

// ═══ IMPACT EVM — MESURÉ, PAS SUPPOSÉ ═══════════════════════════════════════

describe("CC-OFFLINE-282 · EVM — « un STOP reste un BLOCK », et rien de plus", () => {
  // Le chemin EVM déclare `expected: 1, expectedMeasured: 1`. Le portail
  // `expectedMeasured === 0` n'y était donc DÉJÀ jamais atteint : la sémantique
  // ALLOW/WARN de couverture côté EVM ne peut pas avoir changé.
  const evm = (score: number): FaitsDeMesure => ({
    expected: 1,
    expectedMeasured: 1,
    missing: [
      { engine: "market", reason: "NOT_REQUESTED_BY_CONTRACT" },
      { engine: "holders", reason: "NOT_REQUESTED_BY_CONTRACT" },
      { engine: "scam_lineage", reason: "NOT_REQUESTED_BY_CONTRACT" },
    ],
  });
  const niveauEvm = (score: number) =>
    projectPreBuy(
      canonicalPreBuyDecision({ score, measurement: evm(score), identity: IDENTITE as never }),
    ).level;

  it("la sémantique ALLOW / WARN / BLOCK du contrat EVM est INCHANGÉE", () => {
    expect({
      faible: niveauEvm(SANS_RISQUE),
      eleve: niveauEvm(SEUIL_ELEVE),
      critique: niveauEvm(GRAVITE_BLOCK),
    }).toEqual({ faible: "ALLOW", eleve: "WARN", critique: "BLOCK" });
  });

  it("le portail de couverture n'est pas atteignable sur ce contrat", () => {
    const d = canonicalPreBuyDecision({
      score: GRAVITE_BLOCK, measurement: evm(GRAVITE_BLOCK), identity: IDENTITE as never,
    });
    expect(d.coverage.expectedMeasured).toBeGreaterThan(0);
    expect(d.verdictSource).toBe("LEGACY_SCORE");
  });
});
