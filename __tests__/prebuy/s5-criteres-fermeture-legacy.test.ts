// ─── BUILD 12 · S5 — CRITÈRES DE FERMETURE DES DEUX DÉFAUTS LEGACY ─────────
//
// ██  Les deux constats de S1 deviennent des critères prouvables.          ██
//
// S1 les a épinglés comme observés. Ce fichier écrit ce qui devra être vrai
// APRÈS, avec des mutants qui mordent sur la propriété visée.
//
//   a) LA BANDE DE DIVERGENCE — `verdict_to` et `recommendation` doivent
//      dériver de LA MÊME décision canonique.
//   b) LA RÉASSURANCE — aucune formulation d'absence de risque, en prose ou
//      en jeton, sans mesure attendue réussie qui la soutienne.
//
// Aucun seuil n'est inventé : la propriété exigée est un APPARIEMENT, pas un
// nombre. Les tests ne disent jamais où placer une bascule.
//
// Ne modifie ni ec933c5 (S1) ni 7e7a0f7 (S4) — T1 code contre.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const R = (p: string) => readFileSync(`src/app/api/partner/v1/${p}/route.ts`, "utf8");

/**
 * ─── PREUVE LEXICALE, ANNONCÉE COMME TELLE ──────────────────────────────
 *
 * Règle ratifiée le 2026-09-09 : un test qui lit du SOURCE doit énoncer
 * qu'il le fait, et pourquoi le comportement ne suffit pas.
 *
 * Ici le comportement ne suffit pas parce que les trois routes sont GELÉES,
 * frappent la base et exigent `X-Partner-Key` — elles ne sont pas exécutables
 * depuis la suite. Ce qu'on prouve est donc l'ABSENCE d'une construction dans
 * le code, et aucune exécution ne prouve une absence.
 *
 * `codeSeul` retire les commentaires AVANT toute assertion. Sans ça, une
 * chaîne survivant dans un commentaire d'archéologie ferait passer un test
 * qui affirme sa disparition — c'est exactement le faux vert que T1 a trouvé
 * dans trois tests du corpus S1, et c'est le pendant de ma propre garde
 * d'indépendance qui rougissait sur du code correct parce qu'elle lisait une
 * assertion citant `buildReason(`. Même famille d'erreur, deux directions.
 */
const codeSeul = (src: string): string =>
  src
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const CODE = (p: string) => codeSeul(R(p));
const LES_TROIS = ["transaction-check", "score-lite", "batch-score"] as const;

// ═══ A · LA BANDE DE DIVERGENCE ══════════════════════════════════════════

type Verdict = "SAFE" | "WARNING" | "AVOID";
type Recommendation = "ALLOW" | "WARN" | "BLOCK";

/** L'appariement canonique. Une paire, pas deux échelles. */
const APPARIEMENT: Record<Verdict, Recommendation> = {
  AVOID: "BLOCK",
  WARNING: "WARN",
  SAFE: "ALLOW",
};

// ─── Le constat d'aujourd'hui, balayé sur TOUTE la plage ──────────────────

const legacyVerdict = (s: number): Verdict =>
  s >= 70 ? "AVOID" : s >= 35 ? "WARNING" : "SAFE";
const legacyRecommendation = (s: number): Recommendation =>
  s >= 70 ? "BLOCK" : s >= 40 ? "WARN" : "ALLOW";

function bandesDeDivergence(
  v: (s: number) => Verdict,
  r: (s: number) => Recommendation,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let debut: number | null = null;
  for (let s = 0; s <= 100; s++) {
    const diverge = APPARIEMENT[v(s)] !== r(s);
    if (diverge && debut === null) debut = s;
    if (!diverge && debut !== null) { out.push([debut, s - 1]); debut = null; }
  }
  if (debut !== null) out.push([debut, 100]);
  return out;
}

describe("S5/a1 — le constat, balayé sur 0..100", () => {
  it("il existe EXACTEMENT une bande de divergence, et c'est 35–39", () => {
    // Question posée : y en a-t-il d'autres ? Réponse mesurée : non, une seule.
    expect(bandesDeDivergence(legacyVerdict, legacyRecommendation)).toEqual([[35, 39]]);
  });

  it("l'appariement 70/35 ne diverge sur aucune plage — propriété d'arithmétique", () => {
    // Preuve COMPORTEMENTALE, pas lexicale : deux échelles partageant leurs
    // bornes s'apparient partout. C'est ce qui rend la bande 35–39 imputable
    // au seul 40, et non à la forme des fonctions.
    const memesBornes = (s: number): Recommendation =>
      s >= 70 ? "BLOCK" : s >= 35 ? "WARN" : "ALLOW";
    expect(bandesDeDivergence(legacyVerdict, memesBornes)).toEqual([]);
  });

  // ─── RETOURNÉ le 2026-09-09, fermé par 6585b63 ──────────────────────────
  //
  // Constat d'origine, conservé : les trois endpoints portaient chacun leurs
  // fonctions de bascule — `toVerdict` (70/35), `toRecommendation` (70/40) et
  // `toTier` (70/35) — et transaction-check émettait `buildReason` sur le seul
  // score. La bande 35–39 en découlait directement.
  //
  // `6585b63` les a toutes retirées : les trois routes appellent
  // `canonicalPreBuyDecision`. L'assertion est donc retournée — on ne certifie
  // plus la présence du défaut, on garantit son NON-RETOUR.
  it("ANTI-RÉGRESSION — aucune échelle de bascule locale ne subsiste", () => {
    // ⚠ PREUVE LEXICALE, sur code SANS commentaires. Les anciennes fonctions
    // survivent volontairement dans les commentaires d'archéologie des routes :
    // les lire ferait passer ce test à tort. Voir `codeSeul`.
    for (const p of LES_TROIS) {
      const code = CODE(p);
      for (const interdit of ["function toVerdict", "function toRecommendation",
                              "function toTier", "score >= 40", "score >= 35",
                              "score >= 70"]) {
        expect(code, `${p} — ${interdit} est revenu dans le code exécuté`)
          .not.toContain(interdit);
      }
      expect(code, `${p} ne passe pas par la décision canonique`)
        .toContain("canonicalPreBuyDecision");
    }
  });

  it("ANTI-RÉGRESSION — la borne 40, seule cause de la bande, a disparu", () => {
    // ⚠ PREUVE LEXICALE. Le 40 est la borne qui n'appariait pas ; 70 et 35
    // restent les bornes canoniques, dans `canonicalDecision.ts` uniquement.
    const canon = codeSeul(readFileSync("src/lib/prebuy/canonicalDecision.ts", "utf8"));
    expect(canon).toContain("SEUIL_CRITIQUE = 70");
    expect(canon).toContain("SEUIL_ELEVE = 35");
    expect(canon).not.toContain("40");
  });
});

// ─── Le critère d'acceptation ─────────────────────────────────────────────
//
// Après migration, les deux champs dérivent d'UNE décision. La forme du type
// le rend structurel : l'implémentation ne reçoit pas un score, elle reçoit
// une décision, et rend les deux champs ensemble.

interface DecisionCanonique {
  level: "BLOCK" | "WARN" | "ALLOW";
  /** Le score reste servi au partenaire — il n'est plus l'autorité. */
  score: number;
}
interface SortiePartenaire {
  verdict_to: Verdict;
  recommendation: Recommendation;
  score_to: number;
}
type ImplA = (d: DecisionCanonique) => SortiePartenaire;

const NIVEAUX: DecisionCanonique["level"][] = ["BLOCK", "WARN", "ALLOW"];
const SCORES = Array.from({ length: 101 }, (_, i) => i);

const TEMOIN_A: ImplA = (d) => {
  const verdict_to: Verdict =
    d.level === "BLOCK" ? "AVOID" : d.level === "WARN" ? "WARNING" : "SAFE";
  return { verdict_to, recommendation: d.level, score_to: d.score };
};

function batterieA(impl: ImplA): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // A1 — appariement sur TOUTE la plage, pour TOUS les niveaux
  let apparie = true;
  for (const level of NIVEAUX) {
    for (const score of SCORES) {
      const o = impl({ level, score });
      if (APPARIEMENT[o.verdict_to] !== o.recommendation) apparie = false;
    }
  }
  dit(apparie, "A1 bande-de-divergence");

  // A2 — le score ne pilote plus le verdict : à niveau constant, le verdict
  // est constant quel que soit le score.
  let stable = true;
  for (const level of NIVEAUX) {
    const ref = impl({ level, score: 0 }).verdict_to;
    for (const score of SCORES) if (impl({ level, score }).verdict_to !== ref) stable = false;
  }
  dit(stable, "A2 verdict-pilote-par-le-score");

  // A3 — les trois niveaux restent distinguables (pas d'aplatissement)
  dit(
    new Set(NIVEAUX.map((level) => impl({ level, score: 50 }).verdict_to)).size === 3,
    "A3 niveaux-aplatis",
  );

  // A4 — le score reste servi tel quel : rétrocompatibilité de la valeur
  dit(impl({ level: "WARN", score: 37 }).score_to === 37, "A4 score-non-transmis");

  return v;
}

describe("S5/a2 — critère d'acceptation : une seule décision canonique", () => {
  it("le TÉMOIN passe", () => expect(batterieA(TEMOIN_A)).toEqual([]));

  const MUTANTS_A: Array<{ nom: string; critere: string; impl: ImplA }> = [
    {
      nom: "LE DÉFAUT ACTUEL — deux échelles de seuils indépendantes",
      critere: "A1 bande-de-divergence",
      impl: (d) => ({
        verdict_to: legacyVerdict(d.score),
        recommendation: legacyRecommendation(d.score),
        score_to: d.score,
      }),
    },
    {
      nom: "le verdict redevient une fonction du score, la reco vient du niveau",
      critere: "A2 verdict-pilote-par-le-score",
      impl: (d) => ({ ...TEMOIN_A(d), verdict_to: legacyVerdict(d.score) }),
    },
    {
      nom: "SUR-CORRECTION — les trois niveaux sont aplatis sur WARNING",
      critere: "A3 niveaux-aplatis",
      impl: (d) => ({ ...TEMOIN_A(d), verdict_to: "WARNING", recommendation: "WARN" }),
    },
    {
      nom: "le score cesse d'être servi au partenaire",
      critere: "A4 score-non-transmis",
      impl: (d) => ({ ...TEMOIN_A(d), score_to: 0 }),
    },
  ];

  for (const m of MUTANTS_A) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieA(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
});

// ═══ B · LA RÉASSURANCE PARTENAIRE ═══════════════════════════════════════

describe("S5/b1 — inventaire des formulations de réassurance", () => {
  it("UNE SEULE phrase de prose existe, et elle est dans transaction-check", () => {
    // Question posée : y en a-t-il d'autres ? Mesuré sur les trois endpoints.
    expect(R("transaction-check")).toContain("no critical risk signals detected");
    for (const p of ["score-lite", "batch-score"]) {
      expect(R(p), p).not.toMatch(/no critical risk|no major risk|is safe|appears safe/i);
    }
  });

  // ─── RETOURNÉ le 2026-09-09, fermé par 6585b63 ──────────────────────────
  //
  // Constat d'origine, conservé : `score-lite` et `batch-score` n'émettaient
  // aucune prose mais rendaient `return "SAFE"` depuis une bascule de score —
  // une absence de phrase n'est pas une absence de réassurance. Et
  // `transaction-check` construisait « no critical risk signals detected » via
  // `buildReason(score, signalsCount)`, sans aucun état de mesure.
  //
  // Les deux axes sont fermés ensemble. C'est le point qui comptait : corriger
  // la prose en laissant le jeton aurait laissé la réassurance intacte pour un
  // consommateur machine.
  it("ANTI-RÉGRESSION — aucun jeton `SAFE` ne sort d'une bascule de score", () => {
    // ⚠ PREUVE LEXICALE, sur code SANS commentaires : on prouve une ABSENCE
    // de construction, et aucune exécution ne prouve une absence.
    for (const p of LES_TROIS) {
      expect(CODE(p), `${p} — bascule vers SAFE réintroduite`)
        .not.toContain('return "SAFE"');
    }
  });

  it("ANTI-RÉGRESSION — aucune phrase de réassurance n'est bâtie sur le seul score", () => {
    // ⚠ PREUVE LEXICALE, sur code SANS commentaires.
    for (const p of LES_TROIS) {
      const code = CODE(p);
      expect(code, `${p} — buildReason est revenu`).not.toContain("function buildReason");
      expect(code, `${p} — formulation rassurante réintroduite`)
        .not.toMatch(/no critical risk signals detected|no major risk|is safe/i);
    }
  });

  it("`computeVerdict` n'a plus AUCUN consommateur — le raccourci qui jetait `degraded`", () => {
    // ⚠ PREUVE LEXICALE. Trouvé en balayant les mocks morts : le wrapper qui
    // jetait le canal `degraded` à sa dernière ligne est toujours EXPORTÉ et
    // appelable, mais plus personne ne l'appelle. Le laisser accessible, c'est
    // laisser le défaut à portée du prochain qui choisira le nom le plus court.
    const consommateurs = ["src/lib/safe-swap/preSwapScan.ts"]
      .map((f) => codeSeul(readFileSync(f, "utf8")))
      .filter((c) => /\bcomputeVerdict\s*\(/.test(c));
    expect(consommateurs, "computeVerdict a retrouvé un consommateur").toEqual([]);
  });
});

// ─── Le critère d'acceptation ─────────────────────────────────────────────

interface EtatMesure {
  expectedContractSatisfied: boolean;
  degraded: boolean;
  identityResolved: boolean;
}
interface SortieB { verdict: Verdict; reason: string }
type ImplB = (d: DecisionCanonique & EtatMesure) => SortieB;

const RASSURANT = /no critical risk signals detected|no major risk|is safe/i;

const SOUTENU: EtatMesure = {
  expectedContractSatisfied: true, degraded: false, identityResolved: true,
};
const NON_SOUTENUS: EtatMesure[] = [
  { ...SOUTENU, expectedContractSatisfied: false },
  { ...SOUTENU, degraded: true },
  { ...SOUTENU, identityResolved: false },
];

const TEMOIN_B: ImplB = (d) => {
  const soutenu = d.expectedContractSatisfied && !d.degraded && d.identityResolved;
  if (d.level === "BLOCK")
    return { verdict: "AVOID", reason: `Score ${d.score}/100 — high-risk signals detected` };
  if (d.level === "WARN" || !soutenu)
    return {
      verdict: soutenu ? "WARNING" : "WARNING",
      reason: `Score ${d.score}/100 — completeness of checks not established`,
    };
  return { verdict: "SAFE", reason: `Score ${d.score}/100 — no critical risk signals detected` };
};

function batterieB(impl: ImplB): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // B1 — la PROSE rassurante n'est émise que si la mesure la soutient
  dit(
    NON_SOUTENUS.every((e) => !RASSURANT.test(impl({ level: "ALLOW", score: 0, ...e }).reason)),
    "B1 prose-non-soutenue",
  );
  // B2 — le JETON `SAFE` obéit à la même règle que la prose
  dit(
    NON_SOUTENUS.every((e) => impl({ level: "ALLOW", score: 0, ...e }).verdict !== "SAFE"),
    "B2 jeton-SAFE-non-soutenu",
  );
  // B3 — quand elle EST soutenue, elle reste émise : pas de sur-correction
  const ok = impl({ level: "ALLOW", score: 0, ...SOUTENU });
  dit(ok.verdict === "SAFE" && RASSURANT.test(ok.reason), "B3 sur-correction-jamais-rassurant");
  // B4 — un BLOCK n'est jamais accompagné d'une phrase rassurante
  dit(
    !RASSURANT.test(impl({ level: "BLOCK", score: 90, ...SOUTENU }).reason),
    "B4 BLOCK-rassurant",
  );

  return v;
}

describe("S5/b2 — critère d'acceptation : réassurance soutenue par la mesure", () => {
  it("le TÉMOIN passe", () => expect(batterieB(TEMOIN_B)).toEqual([]));

  const MUTANTS_B: Array<{ nom: string; critere: string; impl: ImplB }> = [
    {
      nom: "LE DÉFAUT ACTUEL — la phrase dépend du seul score",
      critere: "B1 prose-non-soutenue",
      impl: (d) => ({
        verdict: legacyVerdict(d.score),
        reason: `Score ${d.score}/100 — no critical risk signals detected`,
      }),
    },
    {
      nom: "la prose est corrigée mais le jeton `SAFE` reste émis sans support",
      critere: "B2 jeton-SAFE-non-soutenu",
      impl: (d) => ({ ...TEMOIN_B(d), verdict: "SAFE" }),
    },
    {
      nom: "SUR-CORRECTION — plus aucune réassurance, même pleinement soutenue",
      critere: "B3 sur-correction-jamais-rassurant",
      impl: (d) => ({ ...TEMOIN_B(d), verdict: "WARNING", reason: "checks incomplete" }),
    },
    {
      nom: "un BLOCK est servi avec une phrase rassurante",
      critere: "B4 BLOCK-rassurant",
      impl: (d) => ({ ...TEMOIN_B(d), reason: "no critical risk signals detected" }),
    },
  ];

  for (const m of MUTANTS_B) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieB(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("les témoins ne délèguent à aucun code jugé", () => {
    // Première rédaction : la tranche allait de `TEMOIN_A` à `batterieB`, donc
    // elle englobait une ASSERTION qui cite `buildReason(` — et rougissait sur
    // du code correct. On ne lit désormais que les CORPS des deux témoins.
    // Un test faux ment dans les deux sens.
    const src = readFileSync("__tests__/prebuy/s5-criteres-fermeture-legacy.test.ts", "utf8");
    const corps = (nom: string) => {
      const d = src.indexOf(`const ${nom}`);
      return src.slice(d, src.indexOf("\n};", d) + 3);
    };
    const blocs = [corps("TEMOIN_A"), corps("TEMOIN_B")];
    expect(blocs.every((b) => b.length > 50)).toBe(true);
    for (const b of blocs) {
      for (const i of ["buildReason(", "toRecommendation(", "computeVerdict(",
                       "derivePhantomWarning(", "legacyVerdict(", "legacyRecommendation("]) {
        expect(b, `un témoin appelle ${i}`).not.toContain(i);
      }
    }
  });
});
