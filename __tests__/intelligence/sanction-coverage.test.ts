// ─── BUILD 10 / P1 — LES TROIS CAS DE hasSanction ─────────────────────────
//
// Le mutant central : refaire dire « pas de sanction » sur une couverture
// incomplète. C'est l'état exact de la production au 2026-09-08 — `amf` et
// `fca` NOT_ARMED — et c'est ce que la sortie affirmait.

import { describe, it, expect } from "vitest";
import {
  buildSanctionCoverage,
  assessSanction,
  EXPECTED_SANCTION_SOURCES,
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

/** L'état RÉEL de la production au 2026-09-08. */
const PROD = [v("ofac", "FRESH", 0), v("amf", "NOT_ARMED", null), v("fca", "NOT_ARMED", null)];

describe("MUTANT — « pas de sanction » sur couverture incomplète", () => {
  it("l'état de production rend PARTIAL, jamais COMPLETE", () => {
    expect(buildSanctionCoverage(PROD).state).toBe("PARTIAL");
  });

  it("le négatif n'est PAS concluant tant qu'amf et fca ne sont pas observées", () => {
    expect(buildSanctionCoverage(PROD).negativeIsConclusive).toBe(false);
  });

  it("TUE le mutant : hasSanction=false + couverture incomplète ≠ contrôle négatif", () => {
    const a = assessSanction(false, buildSanctionCoverage(PROD));
    expect(a).toBe("NO_MATCH_PARTIAL");
    expect(a).not.toBe("NO_MATCH_COMPLETE");
  });

  it("nomme les sources manquantes ET leur état — jamais un simple « absente »", () => {
    const c = buildSanctionCoverage(PROD);
    expect(c.consulted).toEqual(["ofac"]);
    expect(c.notConsulted).toEqual([
      { source: "amf", state: "NOT_ARMED" },
      { source: "fca", state: "NOT_ARMED" },
    ]);
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
    expect(assessSanction(false, buildSanctionCoverage(PROD))).toBe("NO_MATCH_PARTIAL");
  });

  it("les trois valeurs sont deux à deux distinctes", () => {
    const trois = [
      assessSanction(true, buildSanctionCoverage(complet)),
      assessSanction(false, buildSanctionCoverage(complet)),
      assessSanction(false, buildSanctionCoverage(PROD)),
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
    const c = buildSanctionCoverage([
      v("ofac", "UNKNOWN", null),
      v("amf", "NOT_ARMED", null),
      v("fca", "FRESH"),
    ]);
    expect(c.notConsulted).toEqual([
      { source: "ofac", state: "UNKNOWN" },
      { source: "amf", state: "NOT_ARMED" },
    ]);
  });

  it("une source attendue SANS verdict n'est pas fraîche par défaut", () => {
    const c = buildSanctionCoverage([v("ofac", "FRESH")]);
    expect(c.state).toBe("PARTIAL");
    expect(c.notConsulted.map((x) => x.source)).toEqual(["amf", "fca"]);
    expect(c.notConsulted.every((x) => x.state === "NOT_ARMED")).toBe(true);
  });
});

describe("Le vocabulaire est celui qui existe déjà", () => {
  it("les sources attendues sont les TIER 1 réglementaires", () => {
    expect([...EXPECTED_SANCTION_SOURCES]).toEqual(["ofac", "amf", "fca"]);
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
