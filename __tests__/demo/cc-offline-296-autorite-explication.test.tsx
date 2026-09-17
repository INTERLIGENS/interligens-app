// @vitest-environment jsdom
// ─── CC-OFFLINE-296 · B — LE PONT D'AUTORITÉ DE `AnalysisSummary` ──────────
//
// ██  UNKNOWN ≠ LOW ≠ CLEAN ≠ SAFE ≠ ALLOW.                                ██
// ██  LE LLM NE PEUT PAS RECEVOIR UNE AFFIRMATION PLUS FORTE QUE           ██
// ██  L'AUTORITÉ QUI LUI FOURNIT SON CONTEXTE.                             ██
//
// Le témoin humain a mesuré, sur le servi, sous un bandeau UNVERIFIED :
//   VINE   « Score 30/100. Relatively clean — no major flags from this scan. »
//   BOTIFY « Score 20/100. Relatively clean — no major flags from this scan. »
//
// SIX surfaces vivantes partageaient UNE frontière : `AnalysisSummary`, dont
// `tierToVerdict` traduisait un GREEN NON COUVERT en `LOW`. Ces témoins
// tiennent la frontière, puis chaque surface qu'elle alimente.
//
// ⛔ AUCUNE MÉTHODOLOGIE DE SCORING N'EST TOUCHÉE. Aucune claim CaseFile n'est
//    inspectée. Aucun verdict n'est inventé : `UNVERIFIED` est l'état que la
//    bannière retail projette déjà depuis CC-OFFLINE-284.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeToAnalysisSummary } from "@/lib/explanation/normalizer";
import { buildAnalysisSummaryText } from "@/lib/explanation/summaryBuilder";
import { getAnswer } from "@/lib/explanation/answerHandlers";
import { generateChips } from "@/lib/explanation/chipGenerator";
import type { AnalysisSummary, Locale } from "@/lib/explanation/types";
import TigerRevealCard from "@/components/TigerRevealCard";
import AdvancedSignals from "@/components/scan/AdvancedSignals";

beforeEach(() => {
  // `useReducedMotion` interroge `matchMedia` au premier rendu. jsdom ne le
  // fournit pas : c'est un manque du harnais, pas du produit.
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const LANGUES: readonly Locale[] = ["en", "fr"] as const;

/** Les deux cas SERVIS, tels que `/api/scan/solana` les rend aujourd'hui. */
const SCAN_BOTIFY = { score: 20, tier: "GREEN", proofs: [], recommendations: ["Verify URL / contract before signing"], risk: { coverage: { sufficient: false } } };
const SCAN_VINE = { score: 30, tier: "GREEN", proofs: [], recommendations: ["Verify URL / contract before signing"], risk: { coverage: { sufficient: false } } };
/** Le contrôle : un scan RÉELLEMENT couvert, à risque faible. */
const SCAN_COUVERT = { score: 18, tier: "GREEN", proofs: [], recommendations: ["Verify URL / contract before signing"], risk: { coverage: { sufficient: true } } };
/** Une chaîne qui ne produit aucune couverture (EVM) : `undefined ≠ false`. */
const SCAN_SANS_AUTORITE = { score: 18, tier: "GREEN", proofs: [], recommendations: ["Verify URL / contract before signing"] };

const PHRASES_INTERDITES = [
  "Relatively clean",
  "no major flags",
  "No major flags",
  "Pretty clean",
  "Plutôt propre",
  "pas de gros signal",
  "Rien de critique",
];

// ═══ B · LA FRONTIÈRE ═══════════════════════════════════════════════════════

describe("CC-OFFLINE-296 · B — `AnalysisSummary` sait dire « non vérifié »", () => {
  it("le transport est une RECOPIE, et le verdict cesse d'être LOW", () => {
    for (const scan of [SCAN_BOTIFY, SCAN_VINE]) {
      const s = normalizeToAnalysisSummary(scan);
      expect(s.coverageSufficient).toBe(false);
      expect(s.verdict).toBe("UNVERIFIED");
      // ⛔ AUCUN SCORE SUBSTITUÉ : le nombre mesuré reste le nombre mesuré.
      expect(s.tigerScore).toBe(scan.score);
    }
  });

  it("⛔ M15 — perdre la couverture ramène le LOW rassurant : la frontière est LA cause", () => {
    // Le mutant EST cette ligne. Sans `risk.coverage`, l'ancien comportement
    // revient à l'identique — c'est la preuve que rien d'autre n'a été
    // rafistolé en aval pour masquer le défaut.
    const sansCouverture = normalizeToAnalysisSummary({ ...SCAN_BOTIFY, risk: undefined });
    expect(sansCouverture.verdict).toBe("LOW");
    expect(buildAnalysisSummaryText(sansCouverture, "en")).toContain("Relatively clean");
    // …et la source montre que la couverture est LUE, jamais dérivée.
    const code = sansCommentaires(lire("src/lib/explanation/normalizer.ts"));
    expect(code).toContain("raw?.risk?.coverage?.sufficient");
    for (const interdit of ["computeScore", "loadCaseByMint", "fetch(", "claims", "canonicalRef"]) {
      expect(code, interdit).not.toContain(interdit);
    }
  });

  it("⛔ UNE GRAVITÉ N'EST JAMAIS RELÂCHÉE — RED et ORANGE traversent", () => {
    expect(normalizeToAnalysisSummary({ score: 90, tier: "RED", risk: { coverage: { sufficient: false } } }).verdict).toBe("CRITICAL");
    expect(normalizeToAnalysisSummary({ score: 50, tier: "ORANGE", risk: { coverage: { sufficient: false } } }).verdict).toBe("HIGH");
  });

  it("`undefined` ≠ `false` — sans autorité, comportement historique", () => {
    expect(normalizeToAnalysisSummary(SCAN_SANS_AUTORITE).verdict).toBe("LOW");
    expect(normalizeToAnalysisSummary(SCAN_SANS_AUTORITE).coverageSufficient).toBeUndefined();
  });

  it("un palier INCONNU ne devient plus « plutôt propre » non plus", () => {
    // Défaut latent relevé en CC-OFFLINE-294 : `UNKNOWN` retombait sur le repli
    // par score (0) et rendait `LOW`. « Pas de score » devenait « clean ».
    expect(normalizeToAnalysisSummary({ score: 0, tier: "UNKNOWN" }).verdict).toBe("UNVERIFIED");
  });
});

// ═══ B1 · LE RÉSUMÉ ═════════════════════════════════════════════════════════

describe("CC-OFFLINE-296 · B1 — le résumé ASK INTERLIGENS", () => {
  for (const lang of LANGUES) {
    it(`${lang} — aucune phrase rassurante, AUCUN score présenté`, () => {
      for (const scan of [SCAN_BOTIFY, SCAN_VINE]) {
        const texte = buildAnalysisSummaryText(normalizeToAnalysisSummary(scan), lang);
        for (const m of PHRASES_INTERDITES) expect(texte, `${lang} · ${m}`).not.toContain(m);
        // ⛔ Ni le nombre, ni un substitut.
        expect(texte).not.toMatch(/\d+\s*\/\s*100/);
        expect(texte).not.toMatch(/\d/);
        expect(texte).toMatch(/not a safety assessment|pas une évaluation de sécurité/);
      }
    });

    it(`${lang} — ⛔ CONTRÔLE : couverture suffisante ⇒ la copie positive est INTACTE`, () => {
      const texte = buildAnalysisSummaryText(normalizeToAnalysisSummary(SCAN_COUVERT), lang);
      expect(texte).toContain("18/100");
      expect(texte).toMatch(/Relatively clean|Plutôt propre/);
    });
  }

  it("les quatre phrases historiques sont mot pour mot ce qu'elles étaient", () => {
    const code = lire("src/lib/explanation/summaryBuilder.ts");
    expect(code).toContain("Relatively clean — no major flags from this scan.");
    expect(code).toContain("Some signals here worth checking before you do anything.");
    expect(code).toContain("This looks rough — the scan flagged several serious signals.");
    expect(code).toContain("This is bad. The scan found critical risk indicators.");
  });
});

// ═══ B2 · LES CHIPS ═════════════════════════════════════════════════════════

describe("CC-OFFLINE-296 · B2 — WHY THIS SCORE et WHAT TO DO", () => {
  for (const lang of LANGUES) {
    it(`${lang} — « why_score » ne présente plus de nombre sous UNVERIFIED`, () => {
      const s = normalizeToAnalysisSummary(SCAN_BOTIFY);
      const a = getAnswer("why_score", s, lang);
      expect(a.body).not.toMatch(/\d+\s*\/\s*100/);
      expect(a.body).toMatch(/coverage was not established|couverture attendue n’a pas été établie/i);
    });

    it(`${lang} — « what_to_do » ne sert plus la copie permissive`, () => {
      const s = normalizeToAnalysisSummary(SCAN_BOTIFY);
      const a = getAnswer("what_to_do", s, lang);
      for (const m of PHRASES_INTERDITES) expect(a.body, m).not.toContain(m);
      // ⛔ Et pas davantage le conseil de palier (`getActionCopy` GREEN).
      expect(a.body).not.toContain("Verify URL / contract before signing");
      expect(a.body).toMatch(/unknown, not as cleared|inconnu, pas comme validé/);
    });

    it(`${lang} — ⛔ CONTRÔLE : couverture suffisante ⇒ les deux chips sont INTACTS`, () => {
      const s = normalizeToAnalysisSummary(SCAN_COUVERT);
      expect(getAnswer("why_score", s, lang).body).toContain("18/100");
      expect(getAnswer("what_to_do", s, lang).body).toContain("Verify URL / contract before signing");
    });

    it(`${lang} — les quatre chips restent générés : rien n'est amputé`, () => {
      const chips = generateChips(normalizeToAnalysisSummary(SCAN_BOTIFY), lang);
      expect(chips).toHaveLength(4);
      expect(chips.map((c) => c.intent)).toContain("why_score");
      expect(chips.map((c) => c.intent)).toContain("what_to_do");
    });
  }

  it("⛔ les preuves NÉGATIVES réelles ne sont pas masquées par l'ignorance", () => {
    // UNE COUVERTURE MANQUANTE NE DOIT PAS MASQUER UNE PREUVE NÉGATIVE RÉELLE.
    const s: AnalysisSummary = { ...normalizeToAnalysisSummary(SCAN_BOTIFY), recidivismFlag: true, deployerRisk: "HIGH" };
    const a = getAnswer("why_score", s, "en");
    expect(a.body).toMatch(/flagged history|repeating pattern/);
  });
});

// ═══ B3 · L'AUTORITÉ FOURNIE AU LLM ═════════════════════════════════════════

describe("CC-OFFLINE-296 · B3 — ⛔ M16 · le prompt ne reçoit plus de prémisse fausse", () => {
  const route = lire("src/app/api/scan/ask/route.ts");

  it("la prémisse vient de `summary.verdict` — corrigée à la SOURCE", () => {
    // La route projette ; elle ne fabrique pas. La table est indexée par
    // `string` et retombe sur le verdict lui-même : `UNVERIFIED` s'y affiche
    // tel quel, sans traduction rassurante et sans crash.
    expect(route).toContain("const verdictOpener: Record<string, Record<string, string>> = {");
    expect(route).toContain('const vLine = verdictOpener[summary.verdict]?.[isFr ? "fr" : "en"] ?? summary.verdict');
    expect(route).toContain("VERDICT: ${summary.verdict} (${vLine})");
    // ⛔ Et rien n'associe `UNVERIFIED` à une ouverture rassurante.
    expect(route).not.toMatch(/UNVERIFIED:\s*\{[^}]*clean/i);
  });

  it("⛔ M16 — les exemplaires de TON rassurants ne sont plus enseignés sans condition", () => {
    // Ils vivaient dans les listes « GOOD », donc inconditionnellement — le
    // modèle apprenait le registre de la réassurance avant même de lire le
    // verdict.
    expect(route).not.toContain('"Pretty clean for now — nothing critical."');
    expect(route).not.toContain("\"Plutôt propre — rien de critique pour l'instant.\"");
    // Le bloc de phrasé permissif est désormais BORNÉ à l'état qui le fonde…
    expect(route).toContain('LOW SCORE PHRASING — USE ONLY WHEN VERDICT IS EXACTLY "LOW":');
    expect(route).toContain('When VERDICT is "LOW", do not say "I cannot tell you if it\'s safe"');
    // …et l'état sans couverture reçoit sa consigne véridique.
    expect(route).toContain('WHEN VERDICT IS "UNVERIFIED":');
    expect(route).toContain("an absence of findings is not a finding of absence");
  });

  it("⛔ le périmètre de la lease ③ est tenu : rien d'autre n'a bougé", () => {
    // Aucune autorité COUNSEL, aucune claim gouvernée, aucun raisonnement de
    // risque nouveau, aucun redécoupage du prompt.
    for (const interdit of ["COUNSEL", "publishStatus", "loadCaseByMint", "canonicalRefForMint", "template=governed"]) {
      expect(route, interdit).not.toContain(interdit);
    }
    // Les phrasés LOW eux-mêmes sont PRÉSERVÉS — on les conditionne, on ne les
    // supprime pas (⛔ ne tue pas le positif).
    expect(route).toContain('"Pretty clean for now." / "Nothing critical here."');
  });

  it("l'état épistémique voyage aussi dans le corps sérialisé du prompt", () => {
    // `CURRENT SCAN: ${JSON.stringify(summary)}` — le champ transporté y est.
    expect(route).toContain("CURRENT SCAN:");
    expect(JSON.stringify(normalizeToAnalysisSummary(SCAN_BOTIFY))).toContain('"coverageSufficient":false');
  });
});

// ═══ B4 · TIGER REVEAL ══════════════════════════════════════════════════════

describe("CC-OFFLINE-296 · B4 — ⛔ M17 · TigerRevealCard", () => {
  const PROOFS = [{ label: "Network", value: "Solana Mainnet", level: "low", riskDescription: "Official chain" }];

  it("⛔ M17 — couverture insuffisante ⇒ aucun « Verdict: GREEN » faisant autorité", () => {
    render(<TigerRevealCard tier="GREEN" proofs={PROOFS} coverageSufficient={false} />);
    expect(screen.queryByText(/Verdict:\s*GREEN/)).toBeNull();
    expect(screen.getByText(/Verdict:\s*UNVERIFIED/)).toBeTruthy();
  });

  it("⛔ LES PROOFS SONT PRÉSERVÉS — on conditionne un verdict, on n'ampute pas", () => {
    render(<TigerRevealCard tier="GREEN" proofs={PROOFS} coverageSufficient={false} />);
    expect(screen.getByText("Solana Mainnet")).toBeTruthy();
  });

  it("⛔ CONTRÔLE — couverture suffisante, `undefined`, RED et ORANGE : intacts", () => {
    render(<TigerRevealCard tier="GREEN" proofs={PROOFS} coverageSufficient={true} />);
    expect(screen.getByText(/Verdict:\s*GREEN/)).toBeTruthy();
    cleanup();
    render(<TigerRevealCard tier="GREEN" proofs={PROOFS} />);
    expect(screen.getByText(/Verdict:\s*GREEN/)).toBeTruthy();
    cleanup();
    render(<TigerRevealCard tier="RED" proofs={PROOFS} coverageSufficient={false} />);
    expect(screen.getByText(/Verdict:\s*RED/)).toBeTruthy();
  });
});

// ═══ B5 · ADVANCED SIGNALS ══════════════════════════════════════════════════

describe("CC-OFFLINE-296 · B5 — ⛔ M18 · AdvancedSignals", () => {
  const base = { lang: "en" as const, rawSummary: { markets: { data_unavailable: true } } };

  it("⛔ M18 — « Influence: Low » n'est plus CRÉÉ par le seul repli GREEN", () => {
    render(<AdvancedSignals {...base} tier="GREEN" manipulationLevel={null} coverageSufficient={false} />);
    expect(screen.queryByText("Influence: Low")).toBeNull();
    expect(screen.getByText("Influence: not measured")).toBeTruthy();
    // ⚠️ CC-OFFLINE-298 — « NOT ESTABLISHED » n'est plus unique dans la carte :
    //    la coordination a adopté le MÊME vocabulaire ratifié. Le contrat de ce
    //    témoin est inchangé — c'est l'hypothèse d'unicité qui ne tenait plus.
    //    Les deux assertions décisives ci-dessus, elles, sont sans ambiguïté.
    expect(screen.getAllByText("NOT ESTABLISHED").length).toBeGreaterThan(0);
  });

  it("⛔ L'AUTORITÉ INDÉPENDANTE EST PRÉSERVÉE — `manipulationLevel` prime", () => {
    // PROUVÉ causalement : `manipulationLevel` vient de la météo de marché, une
    // mesure qui n'a jamais dépendu du palier. Elle survit à l'ignorance.
    for (const [niveau, attendu] of [["red", "Influence: High"], ["orange", "Influence: Med"]] as const) {
      cleanup();
      render(<AdvancedSignals {...base} tier="GREEN" manipulationLevel={niveau} coverageSufficient={false} />);
      expect(screen.getByText(attendu), niveau).toBeTruthy();
    }
  });

  it("⛔ UNE GRAVITÉ DE PALIER TRAVERSE AUSSI", () => {
    cleanup();
    render(<AdvancedSignals {...base} tier="RED" manipulationLevel={null} coverageSufficient={false} />);
    expect(screen.getByText("Influence: High")).toBeTruthy();
  });

  it("⛔ CONTRÔLE — couverture suffisante ou absente ⇒ « Influence: Low » revient", () => {
    render(<AdvancedSignals {...base} tier="GREEN" manipulationLevel={null} coverageSufficient={true} />);
    expect(screen.getByText("Influence: Low")).toBeTruthy();
    cleanup();
    render(<AdvancedSignals {...base} tier="GREEN" manipulationLevel={null} />);
    expect(screen.getByText("Influence: Low")).toBeTruthy();
  });
});

// ═══ PARITÉ DES TROIS IMPLÉMENTATIONS ═══════════════════════════════════════

describe("CC-OFFLINE-296 · PARITÉ — aucune démo ne garde un comportement contradictoire", () => {
  const DEMOS = [
    "src/app/en/demo/page.tsx",
    "src/app/fr/demo/page.tsx",
    "src/app/[locale]/demo/page.tsx",
  ] as const;

  for (const p of DEMOS) {
    const code = sansCommentaires(lire(p));

    it(`${p} — transporte la couverture, sans cast et sans défaut permissif`, () => {
      expect(code).toContain("risk?: { coverage?: ScanCoverage };");
      expect(code).toContain("risk: data?.risk?.coverage ? { coverage: data.risk.coverage as ScanCoverage } : undefined,");
      expect(code).not.toMatch(/as\s*\{\s*risk\?/);
      expect(code).not.toMatch(/sufficient\s*(\?\?|\|\|)\s*true/);
    });

    it(`${p} — la bannière retail reçoit l'autorité`, () => {
      expect(code).toContain("coverageSufficient={result.risk?.coverage?.sufficient}");
    });

    it(`${p} — TigerRevealCard reçoit l'autorité`, () => {
      expect(code).toMatch(/<TigerRevealCard[^>]*coverageSufficient=\{result\.risk\?\.coverage\?\.sufficient\}/);
    });

    it(`${p} — le repli numérique n'est pas présenté sous UNVERIFIED`, () => {
      expect(code).toContain("_nonVerifie");
      expect(code).toContain('const LABEL_PREUVE_SCORE = "Score";');
      expect(code).toContain("!== LABEL_PREUVE_SCORE");
      expect(code).not.toContain('label: "Score"');
    });

    it(`${p} — ⛔ le palier sous-jacent n'est jamais réécrit`, () => {
      // ⚠️ Lookahead négatif : `result.tier === "GREEN"` est une COMPARAISON,
      //    parfaitement légitime. Ce qu'on interdit est l'AFFECTATION.
      expect(code).not.toMatch(/result\.tier\s*=(?!=)/);
      expect(code).not.toMatch(/risk\.tier\s*=(?!=)/);
    });
  }

  it("`[locale]/demo` ne sert plus « Proceed » ni « looks clean » sans couverture", () => {
    const code = sansCommentaires(lire("src/app/[locale]/demo/page.tsx"));
    expect(code).toContain('{_nonVerifie ? "UNVERIFIED" : result.verdict}');
    expect(code).toContain('Coverage was not established for this address. This is not a safety assessment.');
    // La phrase historique n'est pas supprimée : elle n'est plus SÉLECTIONNÉE.
    expect(code).toContain("Wallet health looks clean. Still verify URLs.");
  });
});
