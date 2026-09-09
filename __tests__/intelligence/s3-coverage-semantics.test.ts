// ─── BUILD 12 · S3 — SÉMANTIQUE DE COUVERTURE, CHEMIN PRÉ-ACHAT ────────────
//
// ██  NEVER_EXECUTED ne projette JAMAIS en NO_MATCH.                       ██
// ██  Mais EXPECTED ≠ DECLARED : une capacité jamais armée ne dégrade rien. ██
//
// Mesuré en production le 2026-09-09, sur la MÊME adresse :
//
//   /api/scan/intelligence  → NO_MATCH_PARTIAL · notConsulted:[amf,fca NOT_ARMED]
//   /api/v1/score           → ALLOW · sources: [] · « No major risk signals
//                             detected. » · AUCUN champ de couverture
//
// ─── Les quatre états que le contrat doit distinguer ─────────────────────
//
//   EXPECTED            les capacités réellement ARMÉES
//   CONSULTED-MEASURED  celles des attendues effectivement observées
//   NOT_CONSULTED       attendues, non observées, avec motif TYPÉ
//   NEGATIVE_CONCLUSIVE ce qu'un no-match autorise à conclure
//
// ─── Le piège que ce fichier surveille ────────────────────────────────────
//
// Ma première implémentation confondait EXPECTED et DECLARED : `state` restait
// `PARTIAL` en permanence, parce qu'`amf` et `fca` ne seront jamais fraîches.
// Tout scan serait sorti dégradé — l'alerte serait devenue le fond. C'est le
// piège de `holders` fermé en phase 2, et il est revenu par une autre porte.
//
// Critères B repris du corpus AU de T2 (5835390). Le discriminant d'axe D
// vient de son corpus S3 (1f1d00c) : compter `state !== "NOT_ARMED"` au lieu
// de `=== "FRESH"` compterait une source PÉRIMÉE comme consultée.

import { describe, it, expect } from "vitest";
import {
  buildIntelligenceCoverage,
  freshnessToMeasurementState,
  DECLARED_INTELLIGENCE_SOURCES,
  buildSanctionCoverage,
  EXPECTED_SANCTION_SOURCES,
} from "@/lib/intelligence/sanctionCoverage";
import { MEASUREMENT_STATES } from "@/lib/publication/absenceVocabulary";
import { phantomFromProjection } from "@/lib/publicScore/schema";
import { projectPreBuy } from "@/lib/prebuy/projection";
import type { DecisionCanonique } from "@/lib/prebuy/canonicalDecision";
import type { FreshnessVerdict } from "@/lib/watchdog/sourceFreshness";

const v = (sourceSlug: string, state: string): FreshnessVerdict =>
  ({
    sourceSlug,
    state,
    ageDays: state === "FRESH" ? 1 : null,
    limitDays: 7,
    measuredField: "intel_ingestion_batches.completedAt(status=success)",
  }) as FreshnessVerdict;

/** L'état RÉEL au 2026-09-09 : deux sources armées et fraîches, quatre jamais armées. */
const REEL: FreshnessVerdict[] = [v("ofac", "FRESH"), v("scamsniffer", "FRESH")];

describe("S3/A — EXPECTED ≠ DECLARED", () => {
  const c = buildIntelligenceCoverage(REEL);

  it("LE PIÈGE — un scan où seules les sources armées sont fraîches sort COMPLET", () => {
    // Si `amf` et `fca` entraient au dénominateur, tout scan sortirait dégradé
    // en permanence et l'alerte deviendrait le fond.
    expect(c.state).toBe("COMPLETE");
    expect(c.negativeConclusive).toBe(true);
    expect(c.notConsulted).toEqual([]);
  });

  it("les jamais armées sont HORS dénominateur, mais NOMMÉES", () => {
    expect([...c.expected].sort()).toEqual(["ofac", "scamsniffer"]);
    expect(c.denominator).toBe(2);
    expect(c.declaredNotArmed.map((x) => x.source).sort()).toEqual([
      "amf",
      "fca",
      "forta",
      "goplus",
    ]);
    for (const x of c.declaredNotArmed) expect(x.reason).toBe("NOT_MEASURED");
  });

  it("MUTANT AXE D — une source ARMÉE mais PÉRIMÉE dégrade, elle", () => {
    // Le discriminant : `STALE` est armée et manquante. Une copie écrite
    // `state !== "NOT_ARMED"` la compterait comme consultée.
    const perime = buildIntelligenceCoverage([
      v("ofac", "FRESH"),
      v("scamsniffer", "STALE"),
    ]);
    expect(perime.expected).toContain("scamsniffer");
    expect(perime.consultedMeasured).not.toContain("scamsniffer");
    expect(perime.notConsulted.find((x) => x.source === "scamsniffer")?.reason).toBe("STALE");
    expect(perime.state).toBe("PARTIAL");
    expect(perime.negativeConclusive).toBe(false);
  });

  it("`UNKNOWN` dégrade aussi, et ne se confond pas avec `STALE`", () => {
    const mixte = buildIntelligenceCoverage([v("ofac", "FRESH"), v("scamsniffer", "UNKNOWN")]);
    expect(mixte.notConsulted.find((x) => x.source === "scamsniffer")?.reason).toBe("UNKNOWN");
    expect(mixte.state).toBe("PARTIAL");
  });

  it("le FLOOR OFAC reste — `ofac` est armé, attendu et consulté", () => {
    // Corollaire ratifié : ne pas généraliser l'inertie d'amf/fca à ofac, qui
    // porte 869 observations et fait se déclencher le plancher sanction.
    expect(c.expected).toContain("ofac");
    expect(c.consultedMeasured).toContain("ofac");
    expect(c.notConsulted.map((x) => x.source)).not.toContain("ofac");
  });
});

describe("S3/B — les critères du corpus AU", () => {
  const c = buildIntelligenceCoverage(REEL);

  it("B1 — une source jamais exécutée n'est PAS rendue mesurée", () => {
    expect(c.consultedMeasured).not.toContain("goplus");
    expect(c.expected).not.toContain("goplus");
  });

  it("B1b — le motif de l'absence est conservé, pas perdu", () => {
    for (const slug of ["amf", "fca", "goplus", "forta"]) {
      const x = c.declaredNotArmed.find((n) => n.source === slug);
      expect(x, `${slug} absent`).toBeDefined();
      expect(x!.reason).toBe("NOT_MEASURED");
    }
  });

  it("B2 — `NOT_MEASURED` n'est pas aplati sur `NOT_APPLICABLE`", () => {
    // Une source déclarée et jamais exécutée n'est pas « hors sujet ».
    expect(c.declaredNotArmed.map((x) => x.reason)).not.toContain("NOT_APPLICABLE");
  });

  it("B2b — tout motif vient du vocabulaire d'absence ratifié", () => {
    for (const x of [...c.declaredNotArmed, ...c.notConsulted]) {
      expect(MEASUREMENT_STATES, `jeton inventé : ${x.reason}`).toContain(x.reason);
    }
    expect(freshnessToMeasurementState("FRESH")).toBe("MEASURED");
    expect(freshnessToMeasurementState("STALE")).toBe("STALE");
    expect(freshnessToMeasurementState("NOT_ARMED")).toBe("NOT_MEASURED");
    expect(freshnessToMeasurementState("QUOI_QUE_CE_SOIT")).toBe("UNKNOWN");
  });

  it("B3b — le périmètre ANNONCÉ est le périmètre réellement ARMÉ", () => {
    expect(DECLARED_INTELLIGENCE_SOURCES).toHaveLength(6);
    expect(c.expected).toHaveLength(2);
    // Rien n'est perdu : tout déclaré est classé quelque part.
    expect(c.expected.length + c.declaredNotArmed.length).toBe(
      DECLARED_INTELLIGENCE_SOURCES.length,
    );
  });

  it("B4 — le dénominateur n'inclut pas une source sans run", () => {
    expect(c.denominator).toBe(2);
    expect(c.denominator).not.toBe(DECLARED_INTELLIGENCE_SOURCES.length);
  });

  it("B5 SUR-CORRECTION — un périmètre attendu VIDE ne conclut RIEN", () => {
    // Aucune source armée : personne n'a regardé. Rendre `COMPLETE` ferait
    // d'une absence totale une couverture parfaite.
    const rien = buildIntelligenceCoverage([]);
    expect(rien.expected).toHaveLength(0);
    expect(rien.denominator).toBe(0);
    expect(rien.state).toBe("PARTIAL");
    expect(rien.negativeConclusive).toBe(false);
    expect(rien.declaredNotArmed).toHaveLength(6);
  });

  it("SUR-CORRECTION — six sources armées et fraîches donnent bien un dénominateur de 6", () => {
    const tout = buildIntelligenceCoverage(
      DECLARED_INTELLIGENCE_SOURCES.map((s) => v(s, "FRESH")),
    );
    expect(tout.denominator).toBe(6);
    expect(tout.state).toBe("COMPLETE");
    expect(tout.declaredNotArmed).toHaveLength(0);
  });
});

describe("S3/1 — UNE autorité, étendue et non recopiée", () => {
  it("la forme SANCTIONS existante est intacte", () => {
    expect([...EXPECTED_SANCTION_SOURCES]).toEqual(["ofac", "amf", "fca"]);
    const s = buildSanctionCoverage([v("ofac", "FRESH")]);
    expect(s.state).toBe("PARTIAL");
    expect(s.consulted).toEqual(["ofac"]);
    expect(s.notConsulted.map((x) => x.source)).toEqual(["amf", "fca"]);
    expect(s.negativeIsConclusive).toBe(false);
  });

  it("les deux formes s'accordent sur QUI a été observé", () => {
    // C'est ce qui distingue une extension d'une copie. Elles divergent
    // volontairement sur le DÉNOMINATEUR — la forme sanctions attend les trois
    // régulateurs par contrat, la forme générale attend les armées.
    const large = buildIntelligenceCoverage([v("ofac", "FRESH")], [...EXPECTED_SANCTION_SOURCES]);
    const sanctions = buildSanctionCoverage([v("ofac", "FRESH")]);
    expect(large.consultedMeasured).toEqual([...sanctions.consulted]);
    const vusCommeManquants = [
      ...large.notConsulted.map((x) => x.source),
      ...large.declaredNotArmed.map((x) => x.source),
    ].sort();
    expect(vusCommeManquants).toEqual([...sanctions.notConsulted.map((x) => x.source)].sort());
  });

  it("MUTANT — le dénominateur ne peut pas redevenir le périmètre déclaré", () => {
    const c = buildIntelligenceCoverage(REEL);
    expect(c.denominator).toBeLessThan(DECLARED_INTELLIGENCE_SOURCES.length);
  });
});

// ═══ S3/2 — LA PROJECTION VIENT APRÈS LE CONTRAT ═════════════════════════

const DECISION_PROPRE: DecisionCanonique = {
  verdict: "NO_CRITICAL_SIGNAL",
  verdictSource: "REFLEX",
  expectedContractSatisfied: true,
  degraded: false,
  coverage: { expected: 4, expectedMeasured: 4, missing: [] },
  identityResolved: true,
};

describe("S3/2 — la phrase rassurante et le périmètre vérifié", () => {
  const allow = projectPreBuy(DECISION_PROPRE);

  it("le niveau reste ALLOW — on ne fabrique pas une gravité", () => {
    // « Do not force provider noise into retail UI. » Un collecteur périmé
    // n'est pas un risque sur le jeton. Faire basculer en WARN rendrait
    // l'alerte permanente — le défaut sous un autre signe.
    expect(phantomFromProjection(allow, { negativeConclusive: false }).level).toBe("ALLOW");
    expect(phantomFromProjection(allow, { negativeConclusive: true }).level).toBe("ALLOW");
  });

  it("MUTANT — couverture incomplète : la phrase n'AFFIRME plus", () => {
    const d = phantomFromProjection(allow, { negativeConclusive: false }).disclaimer;
    expect(d).not.toBe("No major risk signals detected.");
    expect(d).toMatch(/sources actually consulted/i);
    expect(d).toMatch(/not a confirmation that the token is safe/i);
  });

  it("SUR-CORRECTION — couverture complète : la phrase revient", () => {
    // Ne plus jamais la dire serait la sur-correction symétrique.
    expect(phantomFromProjection(allow, { negativeConclusive: true }).disclaimer).toBe(
      "No major risk signals detected.",
    );
  });

  it("sans information de couverture, le cas CONSERVATEUR", () => {
    // Le défaut est l'absence de la mesure au point de consommation.
    expect(phantomFromProjection(allow).disclaimer).toBe("No major risk signals detected.");
  });

  it("BLOCK et WARN ne bougent pas d'un caractère", () => {
    const stop = projectPreBuy({ ...DECISION_PROPRE, verdict: "STOP" });
    const verify = projectPreBuy({ ...DECISION_PROPRE, verdict: "VERIFY" });
    for (const cov of [undefined, { negativeConclusive: false }, { negativeConclusive: true }]) {
      expect(phantomFromProjection(stop, cov)).toEqual({
        level: "BLOCK",
        disclaimer: "This token has critical risk signals. Swapping is strongly discouraged.",
      });
      expect(phantomFromProjection(verify, cov)).toEqual({
        level: "WARN",
        disclaimer: "This token shows elevated risk. Proceed with caution.",
      });
    }
  });
});
