// ─── BUILD 10 · P0 — L'ABSENCE NE PRODUIT PLUS DE RASSURANCE ───────────────
//
// La règle ratifiée :
//
//   « Aucune donnée absente, erreur provider, timeout, collector périmé ou
//     signal non évalué ne peut produire PAR COERCITION la valeur favorable
//     correspondant à une observation RÉELLEMENT MESURÉE. »
//
// ─── Ce que ces tests doivent prouver, et pas seulement vérifier ──────────
//
// Que « succès provider / zéro réel » est DISTINGUABLE de « échec provider /
// donnée absente ». Un test qui vérifierait seulement que l'absence ne rend
// pas GREEN passerait aussi si l'absence rendait RED — or inventer un risque
// est l'autre moitié de la faute.
//
// Chaque chemin fermé porte donc DEUX assertions symétriques : le zéro mesuré
// garde son verdict favorable, et l'absence n'en obtient aucun.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  getTier,
  getTierOrUnknown,
  getTierColor,
  getTierOrUnknownColor,
} from "@/lib/risk/tier";
import {
  degraded,
  isDegraded,
  degradedFieldNames,
  DegradationLeakError,
  DEGRADATION_REASONS,
  type MeasuredVerdict,
} from "@/lib/risk/degradation";

const codeSeul = (chemin: string): string =>
  readFileSync(chemin, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const PAGES_DEMO = [
  "src/app/[locale]/demo/page.tsx",
  "src/app/en/demo/page.tsx",
  "src/app/fr/demo/page.tsx",
];

// ═══ CHEMIN A — score absent → plus jamais GREEN ═════════════════════════

describe("CHEMIN A — un score absent n'est pas un score de zéro", () => {
  it("MUTANT — `null` ne rend PAS le palier favorable", () => {
    expect(getTierOrUnknown(null)).toBe("UNKNOWN");
    expect(getTierOrUnknown(null)).not.toBe("GREEN");
  });

  it("`undefined` et `NaN` non plus", () => {
    expect(getTierOrUnknown(undefined)).toBe("UNKNOWN");
    expect(getTierOrUnknown(Number.NaN)).toBe("UNKNOWN");
  });

  it("un zéro MESURÉ reste GREEN — c'est la distinction rétablie", () => {
    // Sans cette assertion, on aurait pu « corriger » en rendant UNKNOWN pour
    // tout, ce qui détruirait une observation réelle au lieu d'une coercition.
    expect(getTierOrUnknown(0)).toBe("GREEN");
    expect(getTier(0)).toBe("GREEN");
  });

  it("les seuils d'origine sont INTACTS — P0 ne touche pas au barème", () => {
    expect(getTier(0)).toBe("GREEN");
    expect(getTier(34)).toBe("GREEN");
    expect(getTier(35)).toBe("ORANGE");
    expect(getTier(69)).toBe("ORANGE");
    expect(getTier(70)).toBe("RED");
    expect(getTier(100)).toBe("RED");
  });

  it("UNKNOWN n'invente pas non plus un risque", () => {
    // L'autre moitié de la faute. « Si on ne sait pas, mettons rouge » est
    // aussi faux que la coercition qu'on ferme.
    expect(getTierOrUnknown(null)).not.toBe("RED");
    expect(getTierOrUnknown(null)).not.toBe("ORANGE");
  });

  it("la couleur d'UNKNOWN n'est ni le vert ni le rouge du produit", () => {
    const gris = getTierOrUnknownColor("UNKNOWN");
    expect(gris).not.toBe(getTierColor("GREEN"));
    expect(gris).not.toBe(getTierColor("RED"));
    expect(gris).not.toBe(getTierColor("ORANGE"));
  });

  it("MUTANT — aucune page /demo ne coerce plus le score en 0", () => {
    for (const p of PAGES_DEMO) {
      const code = codeSeul(p);
      expect(code, p).not.toContain("tiger_score ?? 0");
      expect(code, p).not.toContain("risk?.score ?? 0");
    }
  });

  it("les trois pages font traverser l'absence jusqu'au palier", () => {
    for (const p of PAGES_DEMO) {
      const code = codeSeul(p);
      expect(code, p).toContain("getTierOrUnknown(scoreOrNull)");
      expect(code, p).toContain("scoreMeasured");
    }
  });

  it("MUTANT — les trois pages RENDENT l'absence, elles ne la masquent pas", () => {
    // Masquer le verdict sans rien dire serait un blanc silencieux de plus :
    // le lecteur ne saurait pas qu'un verdict a été refusé.
    for (const p of PAGES_DEMO) {
      const src = readFileSync(p, "utf8");
      expect(src, p).toMatch(/NOT EVALUATED|NON ÉVALUÉ/);
      expect(src.replace(/\s+/g, " "), p).toMatch(/not\s+absence\s+of\s+risk|pas l(?:'|&apos;)absence de risque/);
    }
  });
});

// ═══ CHEMIN C1 — échec base ≠ aucune lignée de scam ═════════════════════

describe("CHEMIN C1 — « la base a échoué » ≠ « aucune lignée »", () => {
  const code = codeSeul("src/lib/publicScore/computeVerdict.ts");

  it("MUTANT — le catch ne rend plus une valeur nue", () => {
    // Avant : `catch { return "NONE"; }` — la valeur favorable, sans trace.
    expect(code).not.toMatch(/catch\s*\{\s*return\s*"NONE";\s*\}/);
    expect(code).toContain('measured: false');
  });

  it("le succès et l'échec portent le MÊME `lineage` et un `measured` différent", () => {
    // La valeur passée au scoreur ne change pas — P0 s'interdit de toucher au
    // calcul. C'est `measured` qui distingue, et lui seul.
    expect(code).toContain('lineage: "NONE", measured: true');
    expect(code).toContain('lineage: "NONE", measured: false');
  });

  it("la valeur transmise au scoreur reste inchangée", () => {
    expect(code).toContain("scam_lineage: scamLineageResult.lineage");
  });

  it("`computeVerdict` garde sa signature — aucun appelant cassé", () => {
    expect(code).toContain("export async function computeVerdict(mint: string): Promise<SwapVerdict>");
    expect(code).toContain("export async function computeVerdictMeasured");
  });

  it("l'indisponibilité du marché est nommée elle aussi", () => {
    // DÉPLACÉ EN BUILD 12 · S2, et le test suit le déplacement au lieu de
    // relâcher ce qu'il protégeait. La propriété est inchangée : les deux
    // capacités sont NOMMÉES quand elles échouent, aucune n'est absorbée.
    // Ce qui change est la forme — l'échec est d'abord porté sur l'axe mesure
    // (`reason: "FAILURE"`), puis traduit dans le vocabulaire `degraded`.
    expect(code).toContain('{ engine: "market", reason: "FAILURE" as const }');
    expect(code).toContain('{ engine: "scam_lineage", reason: "FAILURE" as const }');
    // Et la traduction préserve le NOM du champ — elle ne le remplace pas par
    // une étiquette générique.
    expect(code).toContain('degraded(x.engine, "PROVIDER_UNAVAILABLE")');
  });
});

// ═══ Le vocabulaire de dégradation ══════════════════════════════════════

describe("P0 — une dégradation nomme le CHAMP, jamais la valeur", () => {
  it("un nom de champ passe", () => {
    expect(degraded("scam_lineage", "PROVIDER_UNAVAILABLE")).toEqual({
      field: "scam_lineage",
      reason: "PROVIDER_UNAVAILABLE",
    });
  });

  it("MUTANT — une valeur déguisée en champ est REFUSÉE", () => {
    for (const faux of ["top10 = 62 %", "score 0", "$604,489", "liquidity: null"]) {
      expect(() => degraded(faux, "PROVIDER_UNAVAILABLE"), faux).toThrow(DegradationLeakError);
    }
  });

  it("le vocabulaire des raisons est FERMÉ", () => {
    expect([...DEGRADATION_REASONS]).toEqual([
      "PROVIDER_UNAVAILABLE",
      "NOT_EVALUATED",
      "PIPE_NOT_CONNECTED",
    ]);
  });

  it("un verdict sans dégradation ne se déclare pas dégradé", () => {
    const m: MeasuredVerdict<string> = { verdict: "GREEN", degraded: [] };
    expect(isDegraded(m)).toBe(false);
    expect(degradedFieldNames(m)).toEqual([]);
  });

  it("un verdict dégradé le dit, et nomme ses champs", () => {
    const m: MeasuredVerdict<string> = {
      verdict: "GREEN",
      degraded: [
        degraded("market", "PROVIDER_UNAVAILABLE"),
        degraded("scam_lineage", "PROVIDER_UNAVAILABLE"),
        degraded("market", "PROVIDER_UNAVAILABLE"),
      ],
    };
    expect(isDegraded(m)).toBe(true);
    expect(degradedFieldNames(m)).toEqual(["market", "scam_lineage"]);
  });

  it("un GREEN dégradé reste distinguable d'un GREEN mesuré", () => {
    // C'est la propriété que P0 achète : deux verdicts identiques, deux
    // niveaux de confiance différents, et la différence est LISIBLE.
    const mesure: MeasuredVerdict<string> = { verdict: "GREEN", degraded: [] };
    const partiel: MeasuredVerdict<string> = {
      verdict: "GREEN",
      degraded: [degraded("market", "PROVIDER_UNAVAILABLE")],
    };
    expect(mesure.verdict).toBe(partiel.verdict);
    expect(isDegraded(mesure)).not.toBe(isDegraded(partiel));
  });
});
