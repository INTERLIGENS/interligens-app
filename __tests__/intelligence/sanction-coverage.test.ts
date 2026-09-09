// ─── BUILD 10 / P1 — LES TROIS CAS DE hasSanction ─────────────────────────
//
// Le mutant central : refaire dire « pas de sanction » sur une couverture
// incomplète. C'est l'état exact de la production au 2026-09-08 — `amf` et
// `fca` NOT_ARMED — et c'est ce que la sortie affirmait.
//
// ─── S3.1 · CE CORPUS A ÉTÉ REPRIS, ET IL FAUT DIRE OÙ ────────────────────
//
// ██  Ce fichier confondait DEUX défauts sous une seule fixture.           ██
//
// `PROD` — ofac frais, amf et fca JAMAIS exécutées — servait à la fois de
// preuve pour « une couverture incomplète ne conclut pas » ET de constat pour
// « voilà l'état de la production ». Les deux sont vrais séparément ; ensemble
// ils ont figé une erreur.
//
// Une source JAMAIS ARMÉE n'est pas une couverture incomplète : c'est une
// capacité absente. La compter au dénominateur rendait CHAQUE scan dégradé,
// en permanence — et une alerte allumée en régime nominal cesse d'alerter.
//
// Ce qui rend une couverture incomplète, c'est une source ARMÉE et MANQUANTE :
// `STALE` ou `UNKNOWN`. La fixture discriminante est donc `PARTIELLE`, pas
// `PROD`, et la doctrine du fichier — « pas de sanction exige d'avoir regardé »
// — est INTACTE : elle porte désormais sur le périmètre réellement armé.
//
// Mesuré en production le 2026-09-09, la contradiction que ça produisait sur
// une seule et même adresse :
//   /api/scan/intelligence  PARTIAL   negativeIsConclusive false
//   /api/v1/score           COMPLETE  negativeConclusive   true

import { describe, it, expect } from "vitest";
import {
  buildSanctionCoverage,
  assessSanction,
  DECLARED_SANCTION_SOURCES,
} from "@/lib/intelligence/sanctionCoverage";
import type { FreshnessVerdict } from "@/lib/watchdog/sourceFreshness";

const v = (
  sourceSlug: string,
  state: FreshnessVerdict["state"],
  ageDays: number | null = 0,
): FreshnessVerdict => ({
  sourceSlug,
  state,
  ageDays,
  limitDays: 7,
  measuredField: "intel_ingestion_batches.completedAt(status=success)",
});

/** L'état RÉEL de la production. `amf` et `fca` n'ont JAMAIS exécuté un lot. */
const PROD = [v("ofac", "FRESH", 0), v("amf", "NOT_ARMED", null), v("fca", "NOT_ARMED", null)];

/**
 * LA FIXTURE DISCRIMINANTE — une régulatrice ARMÉE mais PÉRIMÉE.
 *
 * CONSTRUITE, et annoncée comme telle : aucune source n'est dans cet état
 * aujourd'hui. Sans elle, EXPECTED et CONSULTED ne se distinguent pas sur le
 * corpus réel, `ofac` étant la seule armée ET fraîche.
 */
const PARTIELLE = [v("ofac", "FRESH", 0), v("amf", "STALE", 40), v("fca", "FRESH")];

describe("MUTANT — « pas de sanction » sur couverture incomplète", () => {
  it("une source ARMÉE et MANQUANTE rend PARTIAL, jamais COMPLETE", () => {
    expect(buildSanctionCoverage(PARTIELLE).state).toBe("PARTIAL");
  });

  it("le négatif n'est PAS concluant tant qu'une source ARMÉE n'est pas observée", () => {
    expect(buildSanctionCoverage(PARTIELLE).negativeIsConclusive).toBe(false);
  });

  it("TUE le mutant : hasSanction=false + couverture incomplète ≠ contrôle négatif", () => {
    const a = assessSanction(false, buildSanctionCoverage(PARTIELLE));
    expect(a).toBe("NO_MATCH_PARTIAL");
    expect(a).not.toBe("NO_MATCH_COMPLETE");
  });

  it("nomme les sources manquantes ET leur état — jamais un simple « absente »", () => {
    const c = buildSanctionCoverage(PARTIELLE);
    expect(c.consulted).toEqual(["ofac", "fca"]);
    expect(c.notConsulted).toEqual([{ source: "amf", state: "STALE" }]);
  });

  it("SUR-CORRECTION — une JAMAIS ARMÉE ne dégrade PAS, et ne disparaît pas", () => {
    // Le défaut fermé par S3.1, dans les deux sens. Elle sort du dénominateur
    // ET reste nommée : si elle disparaissait, ce serait pire que l'origine.
    const c = buildSanctionCoverage(PROD);
    expect(c.state).toBe("COMPLETE");
    expect(c.expected).toEqual(["ofac"]);
    expect(c.declaredNotArmed.map((x) => x.source)).toEqual(["amf", "fca"]);
    expect(c.declaredNotArmed.every((x) => x.reason === "NOT_MEASURED")).toBe(true);
  });

  it("BORNE SYMÉTRIQUE — aucune capacité armée ne conclut RIEN", () => {
    // Sans cette borne, `notConsulted.length === 0` rendrait « complet » vrai
    // d'un périmètre VIDE : la sur-correction par le néant.
    const c = buildSanctionCoverage([v("amf", "NOT_ARMED", null), v("fca", "NOT_ARMED", null)]);
    expect(c.expected).toEqual([]);
    expect(c.state).toBe("PARTIAL");
    expect(c.negativeIsConclusive).toBe(false);
    expect(assessSanction(false, c)).toBe("NO_MATCH_PARTIAL");
  });
});

describe("Les trois cas sont distinguables", () => {
  const complet = [v("ofac", "FRESH"), v("amf", "FRESH"), v("fca", "FRESH")];

  it("1 · match réel trouvé", () => {
    expect(assessSanction(true, buildSanctionCoverage(complet))).toBe("MATCHED");
  });

  it("2 · aucun match parmi les sources effectivement consultées", () => {
    expect(assessSanction(false, buildSanctionCoverage(complet))).toBe("NO_MATCH_COMPLETE");
  });

  it("3 · couverture incomplète", () => {
    expect(assessSanction(false, buildSanctionCoverage(PARTIELLE))).toBe("NO_MATCH_PARTIAL");
  });

  it("les trois valeurs sont deux à deux distinctes", () => {
    const trois = [
      assessSanction(true, buildSanctionCoverage(complet)),
      assessSanction(false, buildSanctionCoverage(complet)),
      assessSanction(false, buildSanctionCoverage(PARTIELLE)),
    ];
    expect(new Set(trois).size).toBe(3);
  });
});

describe("Un match réel sort TOUJOURS — le containment n'aplatit rien", () => {
  it("MATCHED même sur couverture incomplète : trouver prime sur avoir tout regardé", () => {
    expect(assessSanction(true, buildSanctionCoverage(PROD))).toBe("MATCHED");
  });

  it("hasSanction n'est jamais réécrit par la couverture", () => {
    // Le module ne rend PAS de booléen : il qualifie. La valeur reste au caller.
    const c = buildSanctionCoverage(PROD);
    expect(c).not.toHaveProperty("hasSanction");
  });
});

describe("STALE et UNKNOWN ne comptent pas comme consultées — pour des raisons distinctes", () => {
  it("STALE ne compte pas", () => {
    const c = buildSanctionCoverage([v("ofac", "STALE", 30), v("amf", "FRESH"), v("fca", "FRESH")]);
    expect(c.state).toBe("PARTIAL");
    expect(c.notConsulted).toEqual([{ source: "ofac", state: "STALE" }]);
  });

  it("UNKNOWN ne compte pas, et se distingue de NOT_ARMED", () => {
    // Les DEUX sont des absences, et elles ne vont PAS au même endroit :
    // `UNKNOWN` est armée-et-illisible, donc elle dégrade ; `NOT_ARMED` n'a
    // jamais tourné, donc elle sort du dénominateur. Les confondre était le
    // défaut. Ce test est la preuve qu'elles restent distinctes.
    const c = buildSanctionCoverage([
      v("ofac", "UNKNOWN", null),
      v("amf", "NOT_ARMED", null),
      v("fca", "FRESH"),
    ]);
    expect(c.notConsulted).toEqual([{ source: "ofac", state: "UNKNOWN" }]);
    expect(c.declaredNotArmed).toEqual([{ source: "amf", reason: "NOT_MEASURED" }]);
    expect(c.negativeIsConclusive).toBe(false);
  });

  it("une source SANS verdict n'est pas fraîche par défaut — elle est NOT_ARMED", () => {
    const c = buildSanctionCoverage([v("ofac", "FRESH")]);
    expect(c.declaredNotArmed.map((x) => x.source)).toEqual(["amf", "fca"]);
    expect(c.declaredNotArmed.every((x) => x.reason === "NOT_MEASURED")).toBe(true);
    // Elle n'est pas comptée comme consultée pour autant.
    expect(c.consulted).toEqual(["ofac"]);
  });
});

describe("Le vocabulaire est celui qui existe déjà", () => {
  it("les sources attendues sont les TIER 1 réglementaires", () => {
    expect([...DECLARED_SANCTION_SOURCES]).toEqual(["ofac", "amf", "fca"]);
  });

  it("aucun état inventé — seulement ceux de sourceFreshness", () => {
    const c = buildSanctionCoverage([
      v("ofac", "FRESH"),
      v("amf", "STALE", 40),
      v("fca", "UNKNOWN", null),
    ]);
    const connus = new Set(["FRESH", "STALE", "UNKNOWN", "NOT_ARMED"]);
    for (const x of c.notConsulted) expect(connus.has(x.state)).toBe(true);
  });
});
