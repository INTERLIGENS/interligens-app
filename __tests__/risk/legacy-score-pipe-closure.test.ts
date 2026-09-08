// ─── BUILD 10 · P0 — legacyCaseScore : PIPE CLOSURE, PAS SCORING ───────────
//
// Les SEPT conditions mécaniques ratifiées. Elles ne sont pas jugées, elles
// sont DÉMONTRÉES : on rejoue le scoreur avant et après sur les mêmes
// observations mesurées, et on compare.
//
//   1. la valeur numérique existante ne change pas
//   2. les poids ne changent pas
//   3. les seuils ne changent pas
//   4. l'agrégation ne change pas
//   5. une observation réellement mesurée produit le MÊME résultat
//   6. seul l'état measured / degraded / unknown voyage à côté de la valeur
//   7. l'absence n'est plus interprétée comme une observation favorable
//
// La 5 est celle qui distingue une fermeture de tuyau d'un changement de
// scoring. C'est aussi la seule qu'un test peut prouver de façon décisive.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  linkEvidence,
  computeLegacyCaseScore,
  type ScorableClaim,
  type OnChainForScore,
} from "@/lib/casefile/legacyCaseScore";

const CLAIMS: ScorableClaim[] = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"].map(
  (id) => ({ id, status: "Referenced" }),
);

const scoreDe = (onChain: OnChainForScore | null) =>
  computeLegacyCaseScore(CLAIMS, linkEvidence(CLAIMS, onChain), onChain);

const code = readFileSync("src/lib/casefile/legacyCaseScore.ts", "utf8")
  .split("\n")
  .filter((l) => {
    const t = l.trimStart();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  })
  .join("\n");

// ═══ Condition 5 — l'égalité sur une observation MESURÉE ════════════════

describe("PIPE CLOSURE — une observation mesurée produit le MÊME résultat", () => {
  // L'implémentation d'AVANT, reproduite à l'identique. C'est l'oracle.
  const avant = (onChain: OnChainForScore | null) => {
    const links = CLAIMS.map((c) => {
      const checks: Array<{ check: string; result: string }> = [];
      let status = c.status ?? "Referenced";
      const top10 = parseFloat(onChain?.distribution?.top10_pct ?? "0");
      const liq = Number(onChain?.markets?.liquidity_usd ?? 0);
      if ((c.id === "C5" || c.id === "C7") && top10 > 40) {
        checks.push({ check: "top10_concentration", result: `Top-10: ${top10}%` });
        status = "Corroborated";
      }
      if (c.id === "C1" && liq > 0 && liq < 100000) {
        checks.push({ check: "low_liquidity", result: `Liquidity: $${liq.toLocaleString()}` });
        status = "Corroborated";
      }
      return { claim_id: c.id, on_chain_checks: checks, final_status: status };
    });
    return computeLegacyCaseScore(CLAIMS, links, onChain);
  };

  const MESURES: OnChainForScore[] = [
    { distribution: { top10_pct: "62.0", measurement: "MEASURED" }, markets: { liquidity_usd: 48000, markets_measurement: "MEASURED" } },
    { distribution: { top10_pct: "0.0",  measurement: "MEASURED" }, markets: { liquidity_usd: 0,     markets_measurement: "MEASURED" } },
    { distribution: { top10_pct: "40.0", measurement: "MEASURED" }, markets: { liquidity_usd: 99999, markets_measurement: "MEASURED" } },
    { distribution: { top10_pct: "40.1", measurement: "MEASURED" }, markets: { liquidity_usd: 100000, markets_measurement: "MEASURED" } },
    { distribution: { top10_pct: "78.5", measurement: "MEASURED" }, markets: { liquidity_usd: 1,     markets_measurement: "MEASURED" } },
    { distribution: { top10_pct: "100.0", measurement: "MEASURED" }, markets: { liquidity_usd: 250000, markets_measurement: "MEASURED" } },
  ];

  for (const [i, obs] of MESURES.entries()) {
    it(`observation mesurée #${i + 1} — score ET tier identiques`, () => {
      expect(scoreDe(obs)).toEqual(avant(obs));
    });
  }

  it("les corroborations sont identiques, une par une", () => {
    for (const obs of MESURES) {
      const ap = linkEvidence(CLAIMS, obs).map((l) => l.final_status);
      const av = CLAIMS.map((c) => {
        const top10 = parseFloat(obs.distribution?.top10_pct ?? "0");
        const liq = Number(obs.markets?.liquidity_usd ?? 0);
        if ((c.id === "C5" || c.id === "C7") && top10 > 40) return "Corroborated";
        if (c.id === "C1" && liq > 0 && liq < 100000) return "Corroborated";
        return "Referenced";
      });
      expect(ap).toEqual(av);
    }
  });

  it("un appelant qui NE POSE PAS l'état garde le comportement d'origine", () => {
    // Condition indispensable : sans elle, tout appelant non migré verrait son
    // score changer, et ce ne serait plus une fermeture de tuyau.
    const sansEtat: OnChainForScore = {
      distribution: { top10_pct: "62.0" },
      markets: { liquidity_usd: 48000 },
    };
    expect(scoreDe(sansEtat)).toEqual(avant(sansEtat));
    expect(linkEvidence(CLAIMS, sansEtat)).toEqual(
      linkEvidence(CLAIMS, { distribution: { top10_pct: "62.0", measurement: "MEASURED" },
                             markets: { liquidity_usd: 48000, markets_measurement: "MEASURED" } }),
    );
  });
});

// ═══ Condition 7 — l'absence n'est plus une observation favorable ═══════

describe("PIPE CLOSURE — ce qui n'est pas mesuré ne corrobore plus", () => {
  it("MUTANT — une panne holders ne corrobore ni C5 ni C7", () => {
    const panne: OnChainForScore = {
      distribution: { top10_pct: null, measurement: "PROVIDER_FAILURE" },
      markets: { liquidity_usd: 48000, markets_measurement: "MEASURED" },
    };
    const statuts = Object.fromEntries(
      linkEvidence(CLAIMS, panne).map((l) => [l.claim_id, l.final_status]),
    );
    expect(statuts.C5).toBe("Referenced");
    expect(statuts.C7).toBe("Referenced");
  });

  it("une panne marché ne corrobore pas C1, même dans la fenêtre basse", () => {
    // `liquidity_usd: 48000` est dans la fenêtre — mais elle n'a pas été
    // mesurée. Lire une valeur non mesurée serait exactement la faute.
    const panne: OnChainForScore = {
      distribution: { top10_pct: "62.0", measurement: "MEASURED" },
      markets: { liquidity_usd: 48000, markets_measurement: "PROVIDER_FAILURE" },
    };
    const statuts = Object.fromEntries(
      linkEvidence(CLAIMS, panne).map((l) => [l.claim_id, l.final_status]),
    );
    expect(statuts.C1).toBe("Referenced");
    expect(statuts.C5).toBe("Corroborated");
  });

  it("MUTANT DE SUR-CORRECTION — un zéro MESURÉ reste lisible", () => {
    // `top10 = 0` mesuré ne franchit pas le seuil de 40 : le claim n'est pas
    // corroboré, et c'est le comportement CORRECT. Traiter ce zéro comme non
    // mesuré ne changerait rien ici — mais un `top10 = 62` mesuré, lui, DOIT
    // corroborer. C'est ce que ce test protège.
    const mesure: OnChainForScore = {
      distribution: { top10_pct: "62.0", measurement: "MEASURED" },
      markets: { liquidity_usd: 48000, markets_measurement: "MEASURED" },
    };
    const statuts = Object.fromEntries(
      linkEvidence(CLAIMS, mesure).map((l) => [l.claim_id, l.final_status]),
    );
    expect(statuts.C5).toBe("Corroborated");
    expect(statuts.C7).toBe("Corroborated");
    expect(statuts.C1).toBe("Corroborated");
  });

  it("NOT_MEASURABLE ne corrobore pas davantage", () => {
    const nd: OnChainForScore = {
      distribution: { top10_pct: "0.0", measurement: "NOT_MEASURABLE" },
      markets: { liquidity_usd: null, markets_measurement: "MEASURED_EMPTY" },
    };
    for (const l of linkEvidence(CLAIMS, nd)) expect(l.final_status).toBe("Referenced");
  });
});

// ═══ Conditions 1 à 4 et 6 — lues dans le code ═════════════════════════

describe("PIPE CLOSURE — ni valeur, ni poids, ni seuil, ni agrégation", () => {
  it("les valeurs sont calculées exactement comme avant", () => {
    expect(code).toContain('const top10 = parseFloat(onChain?.distribution?.top10_pct ?? "0");');
    expect(code).toContain("const liq = Number(onChain?.markets?.liquidity_usd ?? 0);");
  });

  it("les seuils sont intacts", () => {
    expect(code).toContain("top10 > 40");
    expect(code).toContain("liq > 0 && liq < 100000");
    expect(code).toContain("if (claims.length >= 6 && score < 70) score = 70;");
    expect(code).toContain('const tier = score >= 70 ? "RED" : score >= 35 ? "ORANGE" : "GREEN";');
  });

  it("les poids sont intacts", () => {
    for (const p of ["score += 25", "score += 20", "score += 15", "score += 5", "score += 10"]) {
      expect(code, p).toContain(p);
    }
    expect(code).toContain("Math.min(corroborated * 5, 15)");
  });

  it("l'agrégation est intacte", () => {
    expect(code).toContain("score = Math.min(100, Math.max(0, score));");
    expect(code).toContain('linking.filter((l) => l.final_status === "Corroborated").length');
  });

  it("seul l'ÉTAT voyage à côté — aucune sentinelle numérique", () => {
    expect(code).toContain("const top10Mesure = estMesure(");
    expect(code).toContain("const liqMesure = estMesure(");
    // Règle durable : aucune sentinelle numérique. On cherche des AFFECTATIONS
    // de sentinelle, pas la sous-chaîne « -1 » — « Top-10: » en contient une,
    // et l'assertion naïve rougissait dessus. Un test faux est un test qui ment
    // dans les deux sens.
    expect(code).not.toMatch(/(\?\?|=|:|return)\s*-1\b/);
    expect(code).not.toMatch(/\bNaN\b/);
    expect(code).not.toMatch(/Number\.MIN_SAFE_INTEGER|Infinity/);
  });

  it("`computeLegacyCaseScore` n'a pas été touchée du tout", () => {
    const corps = code.slice(code.indexOf("export function computeLegacyCaseScore"));
    expect(corps).not.toContain("estMesure");
    expect(corps).not.toContain("measurement");
  });
});
