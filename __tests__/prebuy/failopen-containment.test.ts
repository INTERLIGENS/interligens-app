/**
 * BUILD 12 · P0 — CONTAINMENT DU FAIL-OPEN PRÉ-ACHAT.
 *
 * Les 7 propriétés d'acceptation, chacune nommée. Le fichier est volontairement
 * SÉPARÉ de `src/lib/safe-swap/__tests__/preSwapScan.test.ts` : celui-là est le
 * test unitaire du module, celui-ci est le témoin du contrat, et il lit aussi
 * la SOURCE là où le comportement seul ne peut pas trancher.
 *
 * Deux propriétés (2 et 7) portent sur ce que le code ne doit PAS contenir.
 * Aucune exécution ne peut prouver l'absence d'une initialisation par défaut :
 * la preuve y est lexicale, et elle est annoncée comme telle plutôt que
 * déguisée en preuve comportementale.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { derivePhantomWarning } from "@/lib/publicScore/schema";

vi.mock("@/lib/publicScore/computeVerdict", () => ({
  computeVerdictMeasured: vi.fn(),
}));
import { computeVerdictMeasured } from "@/lib/publicScore/computeVerdict";
import { preSwapScan } from "@/lib/safe-swap/preSwapScan";

const mockMeasured = vi.mocked(computeVerdictMeasured);

const RACINE = join(__dirname, "..", "..");
const SRC_PRESWAP = readFileSync(
  join(RACINE, "src/lib/safe-swap/preSwapScan.ts"),
  "utf8"
);
const SRC_SCHEMA = readFileSync(
  join(RACINE, "src/lib/publicScore/schema.ts"),
  "utf8"
);

/** La partie exécutable, commentaires retirés — le contrat n'est pas la prose. */
function codeSeul(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");
}

const CODE_PRESWAP = codeSeul(SRC_PRESWAP);

const A = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";
const B = "So11111111111111111111111111111111111111112";

const mesure = (v: "GREEN" | "ORANGE" | "RED") => ({ verdict: v, degraded: [] });

beforeEach(() => vi.restoreAllMocks());

// ── PROPRIÉTÉ 1 ───────────────────────────────────────────────────────────
describe("P1 — une erreur, une absence ou un non-concluant ne produit JAMAIS ALLOW", () => {
  it("panne des deux côtés : pas de résultat propre, avertissement obligatoire", async () => {
    mockMeasured
      .mockRejectedValueOnce(new Error("rpc down"))
      .mockRejectedValueOnce(new Error("rpc down"));
    const r = await preSwapScan(A, B);
    expect(r.degraded).toBe(true);
    expect(r.warning).toBeDefined();
    // « pas d'avertissement » est la forme que prend ALLOW dans ce contrat.
    expect(r.warning).not.toBe("");
  });

  it("GREEN avec une couverture explicitement incomplète → WARN, jamais ALLOW", () => {
    const p = derivePhantomWarning("GREEN", { expected: 4, expectedMeasured: 1 });
    expect(p.level).toBe("WARN");
    expect(p.level).not.toBe("ALLOW");
  });

  it("expected === 0 n'est pas une couverture parfaite", () => {
    // 0/0 vaut « aucun contrat », pas « tout mesuré ». Un contrat vide ne
    // soutient rien.
    const p = derivePhantomWarning("GREEN", { expected: 0, expectedMeasured: 0 });
    expect(p.disclaimer).not.toContain("No major risk signals detected");
  });
});

// ── PROPRIÉTÉ 2 ───────────────────────────────────────────────────────────
describe("P2 — GREEN n'est plus l'initialisation par défaut du chemin", () => {
  it("PREUVE LEXICALE — aucune affectation d'un GREEN littéral dans le code", () => {
    // `let fromVerdict: SwapVerdict = "GREEN"` et ses variantes.
    expect(CODE_PRESWAP).not.toMatch(/=\s*"GREEN"/);
    expect(CODE_PRESWAP).not.toMatch(/\bGREEN\b\s*,\s*\n?\s*.*\bGREEN\b/);
  });

  it("PREUVE COMPORTEMENTALE — sans mesure, le verdict est null et pas GREEN", async () => {
    mockMeasured
      .mockRejectedValueOnce(new Error("x"))
      .mockRejectedValueOnce(new Error("x"));
    const r = await preSwapScan(A, B);
    expect(r.fromVerdict).toBeNull();
    expect(r.toVerdict).toBeNull();
  });
});

// ── PROPRIÉTÉ 3 ───────────────────────────────────────────────────────────
describe("P3 — le catch ne rend plus { GREEN, GREEN, blocked: false }", () => {
  it("MUTANT — restaurer le catch fail-open casserait ces trois assertions", async () => {
    mockMeasured
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"));
    const r = await preSwapScan(A, B);
    expect(r.fromVerdict).not.toBe("GREEN");
    expect(r.toVerdict).not.toBe("GREEN");
    expect(r.warning).toBeDefined();
  });

  it("la panne est NOMMÉE, pas seulement absorbée", async () => {
    mockMeasured
      .mockRejectedValueOnce(new Error("helius 429"))
      .mockResolvedValueOnce(mesure("GREEN"));
    const r = await preSwapScan(A, B);
    const cote = r.coverage.sides.find((s) => s.side === "from");
    expect(cote?.state).toBe("FAILURE");
    expect(cote?.detail).toContain("helius 429");
  });
});

// ── PROPRIÉTÉ 4 ───────────────────────────────────────────────────────────
describe("P4 — un RED mesuré survit à l'échec de sa sœur", () => {
  it("échec côté FROM, RED mesuré côté TO → bloqué", async () => {
    mockMeasured
      .mockRejectedValueOnce(new Error("provider down"))
      .mockResolvedValueOnce(mesure("RED"));
    const r = await preSwapScan(A, B);
    expect(r.blocked).toBe(true);
    expect(r.toVerdict).toBe("RED");
  });

  it("RED mesuré côté FROM, échec côté TO → bloqué", async () => {
    mockMeasured
      .mockResolvedValueOnce(mesure("RED"))
      .mockRejectedValueOnce(new Error("provider down"));
    const r = await preSwapScan(A, B);
    expect(r.blocked).toBe(true);
    expect(r.fromVerdict).toBe("RED");
  });

  it("un ORANGE mesuré survit lui aussi", async () => {
    mockMeasured
      .mockRejectedValueOnce(new Error("provider down"))
      .mockResolvedValueOnce(mesure("ORANGE"));
    const r = await preSwapScan(A, B);
    expect(r.toVerdict).toBe("ORANGE");
    expect(r.warning).toContain("ORANGE");
  });

  it("PREUVE LEXICALE — plus aucun `Promise.all` sur des promesses qui rejettent", () => {
    // Le `Promise.all` restant joint `mesurerCote`, qui attrape sa propre
    // panne. La preuve que le contrat tient est que le catch soit DANS la
    // fonction jointe, avant la jonction.
    const posCatch = CODE_PRESWAP.indexOf("catch");
    const posAll = CODE_PRESWAP.indexOf("Promise.all");
    expect(posCatch).toBeGreaterThan(-1);
    expect(posAll).toBeGreaterThan(posCatch);
  });
});

// ── PROPRIÉTÉ 5 ───────────────────────────────────────────────────────────
describe("P5 — l'information de mesure n'est plus jetée", () => {
  it("le module consomme computeVerdictMeasured, pas computeVerdict", () => {
    expect(CODE_PRESWAP).toContain("computeVerdictMeasured(");
    // On juge les APPELS, pas le chemin du module : `computeVerdictMeasured`
    // est importé DEPUIS `@/lib/publicScore/computeVerdict`, et ce chemin
    // n'est pas un usage de la fonction qui jette la mesure.
    expect(CODE_PRESWAP).not.toMatch(/\bcomputeVerdict\s*\(/);
  });

  it("MUTANT — jeter le canal parallèle rendrait ce detail vide", async () => {
    mockMeasured
      .mockResolvedValueOnce({
        verdict: "GREEN",
        degraded: [{ field: "holders", reason: "PROVIDER_UNAVAILABLE" }],
      })
      .mockResolvedValueOnce(mesure("GREEN"));
    const r = await preSwapScan(A, B);
    const cote = r.coverage.sides.find((s) => s.side === "from");
    expect(cote?.detail).toContain("holders");
    expect(cote?.detail).toContain("PROVIDER_UNAVAILABLE");
    expect(r.degraded).toBe(true);
  });

  it("la dégradation voyage À CÔTÉ du verdict, pas dedans", async () => {
    mockMeasured
      .mockResolvedValueOnce({
        verdict: "GREEN",
        degraded: [{ field: "holders", reason: "PROVIDER_UNAVAILABLE" }],
      })
      .mockResolvedValueOnce(mesure("GREEN"));
    const r = await preSwapScan(A, B);
    // Le verdict mesuré reste ce qu'il était : on ne le corrompt pas pour
    // signaler la dégradation.
    expect(r.fromVerdict).toBe("GREEN");
    expect(r.degraded).toBe(true);
  });
});

// ── PROPRIÉTÉ 6 ───────────────────────────────────────────────────────────
describe("P6 — « No major risk signals detected. » est conditionnée", () => {
  const PHRASE = "No major risk signals detected.";

  it("MUTANT — sans information de mesure, la phrase n'est PAS émise", () => {
    expect(derivePhantomWarning("GREEN").disclaimer).not.toContain(PHRASE);
  });

  it("avec une mesure attendue réussie et suffisante, elle est émise", () => {
    const p = derivePhantomWarning("GREEN", { expected: 3, expectedMeasured: 3 });
    expect(p.disclaimer).toBe(PHRASE);
    expect(p.level).toBe("ALLOW");
  });

  it("MUTANT DE SUR-CORRECTION — RED et ORANGE ne bougent pas d'un caractère", () => {
    expect(derivePhantomWarning("RED")).toEqual({
      level: "BLOCK",
      disclaimer: "This token has critical risk signals. Swapping is strongly discouraged.",
    });
    expect(derivePhantomWarning("ORANGE")).toEqual({
      level: "WARN",
      disclaimer: "This token shows elevated risk. Proceed with caution.",
    });
    // Et une couverture parfaite ne les adoucit pas non plus.
    const support = { expected: 3, expectedMeasured: 3 };
    expect(derivePhantomWarning("RED", support).level).toBe("BLOCK");
    expect(derivePhantomWarning("ORANGE", support).level).toBe("WARN");
  });

  it("le remplacement ne réaffirme pas la sécurité sous un autre nom", () => {
    const d = derivePhantomWarning("GREEN").disclaimer;
    // La seule occurrence de « safe » est NIÉE.
    expect(d).toMatch(/not a confirmation that the token is safe/i);
    expect(d.match(/\bsafe\b/gi)).toHaveLength(1);
    expect(d).not.toContain(PHRASE);
  });
});

// ── PROPRIÉTÉ 7 ───────────────────────────────────────────────────────────
describe("P7 — aucun score ni seuil forensique inventé", () => {
  it("preSwapScan ne contient aucun seuil numérique de décision", () => {
    // Les deux seules comparaisons chiffrées sont STRUCTURELLES :
    //   `> 0` — la liste des entrées manquantes est-elle non vide ;
    //   `< 2` — les DEUX côtés du swap ont-ils été mesurés.
    // Aucune ne pondère, ne classe ni ne note. Toute autre comparaison serait
    // une méthodologie nouvelle.
    const comparaisons = CODE_PRESWAP.match(/[<>]=?\s*\d+|\d+\s*[<>]=?/g) ?? [];
    expect(comparaisons.sort()).toEqual(["< 2", "> 0"]);
  });

  it("derivePhantomWarning n'introduit aucun seuil chiffré", () => {
    const code = codeSeul(SRC_SCHEMA);
    const debut = code.indexOf("export function derivePhantomWarning");
    const fin = code.indexOf("export type PublicErrorResponse");
    expect(debut).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(debut);
    const corps = code.slice(debut, fin);
    // Seul `> 0` subsiste : « le contrat attendait-il quelque chose ». La
    // suffisance se lit `expectedMeasured >= expected`, jamais contre un
    // nombre choisi.
    const chiffres = corps.match(/[<>]=?\s*\d+|\d+\s*[<>]=?/g) ?? [];
    expect(chiffres).toEqual(["> 0"]);
    expect(corps).toContain("support.expectedMeasured >= support.expected");
  });

  it("la suffisance est une COMPARAISON DE COUVERTURE, pas un seuil choisi", () => {
    // 1/2 et 99/100 sont tous deux insuffisants : il n'y a pas de ratio
    // au-dessus duquel on se déclarerait satisfait.
    expect(derivePhantomWarning("GREEN", { expected: 2, expectedMeasured: 1 }).level).toBe("WARN");
    expect(derivePhantomWarning("GREEN", { expected: 100, expectedMeasured: 99 }).level).toBe("WARN");
    expect(derivePhantomWarning("GREEN", { expected: 100, expectedMeasured: 100 }).level).toBe("ALLOW");
  });
});

// ── COMPATIBILITÉ /api/partner/v1/* ───────────────────────────────────────
describe("le contrat partenaire v1 ne bouge pas", () => {
  const ROUTES = [
    "src/app/api/partner/v1/transaction-check/route.ts",
    "src/app/api/partner/v1/batch-score/route.ts",
    "src/app/api/partner/v1/score-lite/route.ts",
  ];

  it("aucune route partenaire ne consomme la surface modifiée", () => {
    for (const r of ROUTES) {
      const src = readFileSync(join(RACINE, r), "utf8");
      expect(src, r).not.toContain("derivePhantomWarning");
      expect(src, r).not.toContain("preSwapScan");
      expect(src, r).not.toContain("PreSwapScanResult");
    }
  });

  it("elles n'importent de publicScore/schema que les validateurs, inchangés", () => {
    for (const r of ROUTES) {
      const src = readFileSync(join(RACINE, r), "utf8");
      const imp = src.match(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/publicScore\/schema"/);
      if (!imp) continue;
      const noms = imp[1].split(",").map((s) => s.trim()).filter(Boolean).sort();
      expect(noms, r).toEqual(["isValidEvmAddress", "isValidMint"]);
    }
  });
});

// ── LE MOT « WARN » N'EST PAS UNE SÉMANTIQUE ──────────────────────────────
describe("containment, pas sémantique", () => {
  it("le module ne se déclare équivalent ni à VERIFY ni à WAIT", () => {
    expect(CODE_PRESWAP).not.toContain("VERIFY");
    expect(CODE_PRESWAP).not.toContain("WAIT");
  });
});
