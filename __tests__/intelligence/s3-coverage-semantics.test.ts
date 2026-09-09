// ─── BUILD 12 · S3 — SÉMANTIQUE DE COUVERTURE, CHEMIN PRÉ-ACHAT ────────────
//
// ██  NEVER_EXECUTED ne projette JAMAIS en NO_MATCH.                       ██
//
// Mesuré en production le 2026-09-09, sur la MÊME adresse :
//
//   /api/scan/intelligence  → NO_MATCH_PARTIAL · notConsulted:[amf,fca NOT_ARMED]
//                             · negativeIsConclusive: false
//   /api/v1/score           → ALLOW · sources: [] · « No major risk signals
//                             detected. » · AUCUN champ de couverture
//
// Deux surfaces servies, deux affirmations épistémiques contradictoires. Sur le
// chemin pré-achat, « jamais exécutée » est indistinguable de « vérifiée, rien
// trouvé ».
//
// ─── Ce que ce fichier juge, et ce qu'il ne juge pas ──────────────────────
//
// Il juge l'AUTORITÉ, qui vit dans un fichier libre. Le CÂBLAGE des routes
// gelées est annoncé séparément et n'est pas ici.
//
// Les critères B viennent du corpus AU de T2 (commit 5835390) : B1, B1b, B2,
// B2b, B3b, B4, B5. Ce sont ses critères, pas les miens.

import { describe, it, expect } from "vitest";
import {
  buildIntelligenceCoverage,
  freshnessToMeasurementState,
  DECLARED_INTELLIGENCE_SOURCES,
  buildSanctionCoverage,
  EXPECTED_SANCTION_SOURCES,
} from "@/lib/intelligence/sanctionCoverage";
import { MEASUREMENT_STATES } from "@/lib/publication/absenceVocabulary";
import type { FreshnessVerdict } from "@/lib/watchdog/sourceFreshness";

const v = (sourceSlug: string, state: string): FreshnessVerdict =>
  ({
    sourceSlug,
    state,
    ageDays: state === "FRESH" ? 1 : null,
    limitDays: 7,
    measuredField: "intel_ingestion_batches.completedAt(status=success)",
  }) as FreshnessVerdict;

/** L'état RÉEL au 2026-09-09 : deux sources ont tourné, quatre non. */
const REEL: FreshnessVerdict[] = [v("ofac", "FRESH"), v("scamsniffer", "FRESH")];

describe("S3/B — le contrat porte la couverture réelle", () => {
  const c = buildIntelligenceCoverage(REEL);

  it("B1 — une source jamais exécutée n'est PAS rendue mesurée", () => {
    const goplus = c.notVerified.find((x) => x.source === "goplus");
    expect(c.verifiedScope).not.toContain("goplus");
    expect(goplus?.reason).not.toBe("MEASURED");
  });

  it("B1b — le motif de l'absence est conservé, pas perdu", () => {
    for (const slug of ["amf", "fca", "goplus", "forta"]) {
      const x = c.notVerified.find((n) => n.source === slug);
      expect(x, `${slug} absent de notVerified`).toBeDefined();
      expect(x!.reason).toBe("NOT_MEASURED");
    }
  });

  it("B2 — `NOT_MEASURED` n'est pas aplati sur `NOT_APPLICABLE`", () => {
    // Une source DÉCLARÉE et jamais exécutée n'est pas « hors sujet » : elle
    // est attendue et manquante. Les deux jetons disent des choses opposées.
    expect(c.notVerified.map((x) => x.reason)).not.toContain("NOT_APPLICABLE");
  });

  it("B2b — tout motif vient du vocabulaire d'absence ratifié", () => {
    for (const x of c.notVerified) {
      expect(MEASUREMENT_STATES, `jeton inventé : ${x.reason}`).toContain(x.reason);
    }
    // La traduction, exhaustive et sans invention.
    expect(freshnessToMeasurementState("FRESH")).toBe("MEASURED");
    expect(freshnessToMeasurementState("STALE")).toBe("STALE");
    expect(freshnessToMeasurementState("NOT_ARMED")).toBe("NOT_MEASURED");
    expect(freshnessToMeasurementState("QUOI_QUE_CE_SOIT")).toBe("UNKNOWN");
  });

  it("B3b — le périmètre ANNONCÉ est le périmètre RÉELLEMENT vérifié", () => {
    // AU2. Six sources déclarées, deux ont tourné : le périmètre annoncé est 2.
    expect(DECLARED_INTELLIGENCE_SOURCES).toHaveLength(6);
    expect([...c.verifiedScope].sort()).toEqual(["ofac", "scamsniffer"]);
  });

  it("B4 — le dénominateur n'inclut pas une source sans run", () => {
    expect(c.denominator).toBe(2);
    expect(c.denominator).not.toBe(DECLARED_INTELLIGENCE_SOURCES.length);
  });

  it("B5 SUR-CORRECTION — un périmètre VIDE n'est pas rendu complet", () => {
    const rien = buildIntelligenceCoverage([]);
    expect(rien.verifiedScope).toHaveLength(0);
    expect(rien.denominator).toBe(0);
    expect(rien.state).toBe("PARTIAL");
    expect(rien.negativeIsConclusive).toBe(false);
  });

  it("SUR-CORRECTION — un périmètre COMPLET est bien rendu complet", () => {
    // Refuser toujours ne vaut pas mieux qu'affirmer toujours.
    const tout = buildIntelligenceCoverage(
      DECLARED_INTELLIGENCE_SOURCES.map((s) => v(s, "FRESH")),
    );
    expect(tout.state).toBe("COMPLETE");
    expect(tout.denominator).toBe(6);
    expect(tout.notVerified).toHaveLength(0);
    expect(tout.negativeIsConclusive).toBe(true);
  });

  it("`STALE` et `UNKNOWN` ne comptent pas comme vérifiées, et se distinguent", () => {
    const mixte = buildIntelligenceCoverage([
      v("ofac", "FRESH"),
      v("amf", "STALE"),
      v("fca", "UNKNOWN"),
    ]);
    expect(mixte.verifiedScope).toEqual(["ofac"]);
    const parSource = Object.fromEntries(mixte.notVerified.map((x) => [x.source, x.reason]));
    expect(parSource.amf).toBe("STALE");
    expect(parSource.fca).toBe("UNKNOWN");
    expect(parSource.goplus).toBe("NOT_MEASURED");
    // Trois raisons distinctes de ne pas avoir vu : elles ne se fondent pas.
    expect(new Set(Object.values(parSource)).size).toBe(3);
  });
});

describe("S3/1 — UNE autorité, étendue et non recopiée", () => {
  it("la forme SANCTIONS existante est intacte", () => {
    // Les deux routes qui la consomment déjà ne doivent rien voir changer.
    expect([...EXPECTED_SANCTION_SOURCES]).toEqual(["ofac", "amf", "fca"]);
    const s = buildSanctionCoverage(REEL);
    expect(s.state).toBe("PARTIAL");
    expect(s.consulted).toEqual(["ofac"]);
    expect(s.notConsulted.map((x) => x.source)).toEqual(["amf", "fca"]);
    expect(s.negativeIsConclusive).toBe(false);
  });

  it("les deux formes répondent à la MÊME question sur des périmètres différents", () => {
    // C'est ce qui distingue une extension d'une copie : sur le périmètre
    // sanctions, les deux doivent s'accorder sur qui a été vu.
    const large = buildIntelligenceCoverage(REEL, [...EXPECTED_SANCTION_SOURCES]);
    const sanctions = buildSanctionCoverage(REEL);
    expect(large.verifiedScope).toEqual([...sanctions.consulted]);
    expect(large.notVerified.map((x) => x.source)).toEqual(
      sanctions.notConsulted.map((x) => x.source),
    );
    expect(large.negativeIsConclusive).toBe(sanctions.negativeIsConclusive);
  });

  it("MUTANT — le dénominateur ne peut pas redevenir le périmètre déclaré", () => {
    // Le défaut que AU2 nomme : annoncer une couverture sur des sources qui
    // n'ont pas tourné.
    const c = buildIntelligenceCoverage(REEL);
    expect(c.denominator).toBeLessThan(DECLARED_INTELLIGENCE_SOURCES.length);
    expect(c.verifiedScope.length + c.notVerified.length).toBe(
      DECLARED_INTELLIGENCE_SOURCES.length,
    );
  });
});
