/**
 * __tests__/garde/semantique-executable.test.ts
 *
 * LE CRITÈRE DES GARDES À CRITÈRE TEXTUEL.
 *
 *   « A semantic enforcement guard must inspect executable semantics, not
 *     textual mention of the prohibited mechanism. »
 *
 * Six gardes du dépôt interrogeaient la source BRUTE — ou la dépouillaient
 * ligne à ligne, ce qui laisse passer trois formes de prose sur cinq. La
 * direction de la défaillance a été MESURÉE avant correction : faux positif,
 * jamais faux vert. Aucune n'était aveugle ; chacune pouvait devenir bruyante
 * le jour où un en-tête citerait le symbole qu'elle interdit. C'était donc un
 * lot de propreté, et il est traité comme tel.
 *
 * Ce fichier ne rejoue pas les gardes : il prouve LE CRITÈRE qu'elles partagent
 * désormais, dans les deux sens, sur des corpus SYNTHÉTIQUES. Aucune violation
 * n'est écrite dans le dépôt : ces sources vivent en mémoire, sous `__tests__/`,
 * et aucune garde ne lit cet arbre.
 *
 *   SENS ROUGE — le symbole ÉMIS par du code exécutable    → la garde doit crier.
 *   SENS VERT  — le même symbole en prose seule (5 formes) → elle doit se taire.
 *
 * Chaque forme de prose est d'abord vérifiée PLANTÉE dans la source brute : une
 * forme qui ne contiendrait pas le symbole rendrait le sens vert vrai par
 * vacuité, et « verte parce qu'il n'y a rien » serait indiscernable de « verte
 * parce qu'elle regarde ».
 *
 * Hors périmètre, et noté comme tel : `scripts/legal-wording-check.sh`
 * (consultatif, ne décide de rien) et les cinq runners de mutation, qui
 * localisent par `includes` + `replace` brut mais défaillent BRUYAMMENT —
 * bruyant, donc détectable, donc pas la même classe de défaut.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BOTIFY_SYNTHETIC_ROUTE_KEY } from "@/lib/kol-memory/tokenIdentity";
import { codeSeul, codeSeulLigneALigne, emisParLeCode } from "../casefile/codeSeul";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const trouve = (src: string, m: string | RegExp) =>
  typeof m === "string" ? src.includes(m) : src.match(m) !== null;

/** Les cinq formes de prose, paramétrées par le texte à y planter. */
const FORMES_DE_PROSE: ReadonlyArray<{ nom: string; envelopper: (e: string) => string }> = [
  {
    nom: "commentaire de ligne, seul sur sa ligne",
    envelopper: (e) => `// ${e}\nconst ok = 1;`,
  },
  {
    nom: "bloc JSDoc, lignes préfixées par `*`",
    envelopper: (e) => `/**\n * ${e}\n */\nconst ok = 1;`,
  },
  {
    nom: "commentaire de FIN DE LIGNE",
    envelopper: (e) => `const ok = 1; // ancien : ${e}`,
  },
  {
    nom: "INTÉRIEUR de bloc, sans `*` en tête",
    envelopper: (e) => `/* on ne fait plus\n${e}\n*/\nconst ok = 1;`,
  },
  {
    nom: "bloc refermé en MILIEU de ligne",
    envelopper: (e) => `const ok = /* ${e} */ 1;`,
  },
];

/**
 * Les six gardes, par le symbole qu'elles interdisent et par une ligne de CODE
 * qui l'émet réellement. `emission` n'est pas décoratif : c'est lui qui fait le
 * sens ROUGE, et c'est lui qu'on enveloppe de prose pour faire le sens VERT.
 */
type Cas = {
  readonly garde: string;
  readonly cible: string;
  readonly nom: string;
  readonly symbole: string | RegExp;
  readonly emission: string;
};

const CAS: ReadonlyArray<Cas> = [
  // ── 1. claims-invariants — le label rendu, pas le label cité ──────────────
  {
    garde: "claims-invariants",
    cible: "src/components/cases/TokenCasefileView.tsx",
    nom: "label « Estimated retail harm »",
    symbole: "Estimated retail harm",
    emission: `return <span className="label">Estimated retail harm</span>;`,
  },
  {
    garde: "claims-invariants",
    cible: "src/components/cases/TokenCasefileView.tsx",
    nom: "label « Préjudice retail estimé »",
    symbole: "Préjudice retail estimé",
    emission: `return <span className="label">Préjudice retail estimé</span>;`,
  },
  // ── 2/3/4. wiring — les trois dépouillements en ligne ─────────────────────
  {
    garde: "wiring",
    cible: "src/lib/kol/identity.ts",
    nom: "`confidence: \"exact\"` en dur",
    symbole: /confidence:\s*["']exact["']/,
    emission: `return { confidence: "exact", source: "manual" };`,
  },
  {
    garde: "wiring",
    cible: "src/lib/kol/identity.ts",
    nom: "`source: \"manual\"` en dur",
    symbole: /source:\s*["']manual["']/,
    emission: `return { confidence: "exact", source: "manual" };`,
  },
  {
    garde: "wiring",
    cible: "src/app/api/kol/[handle]/route.ts",
    nom: "lecture non filtrée `kolWallets: true`",
    symbole: /kolWallets:\s*true/,
    emission: `const kol = await prisma.kol.findUnique({ include: { kolWallets: true } });`,
  },
  {
    garde: "wiring",
    cible: "src/lib/kol/canonical.ts",
    nom: "condition morte `attributionSource === \"manual\"`",
    symbole: /attributionSource\s*===\s*["']manual["']/,
    emission: `if (row.attributionSource === "manual") return "exact";`,
  },
  // ── 5. e1-e2-wiring — même famille, même idiome ligne à ligne ─────────────
  {
    garde: "e1-e2-wiring",
    cible: "src/app/api/casefile/route.ts",
    nom: "alias synthétique 43 caractères en dur",
    symbole: BOTIFY_SYNTHETIC_ROUTE_KEY,
    emission: `const CLE = ${JSON.stringify(BOTIFY_SYNTHETIC_ROUTE_KEY)};`,
  },
  {
    garde: "e1-e2-wiring",
    cible: "src/app/api/casefile/route.ts",
    nom: "constante `BOTIFY_MINT` déclarée en ligne",
    symbole: /^const BOTIFY_MINT = "/m,
    emission: `const BOTIFY_MINT = "AAAA";`,
  },
  {
    garde: "e1-e2-wiring",
    cible: "src/app/api/casefile/route.ts",
    nom: "carte locale de dossiers `CASE_DB`",
    symbole: "CASE_DB",
    emission: `const CASE_DB = { [BOTIFY_MINT]: { case_id: "X" } };`,
  },
  {
    garde: "e1-e2-wiring",
    cible: "src/app/api/casefile/route.ts",
    nom: "résolution sur l'entrée brute",
    symbole: "canonicalRefForMint(sanitizeMint)",
    emission: `const ref = canonicalRefForMint(sanitizeMint);`,
  },
  {
    garde: "e1-e2-wiring",
    cible: "src/app/api/casefile/route.ts",
    nom: "garde-fou de score sur l'entrée brute",
    symbole: "sanitizeMint === BOTIFY_MINT",
    emission: `if (sanitizeMint === BOTIFY_MINT) score = 0;`,
  },
  {
    garde: "e1-e2-wiring",
    cible: "src/lib/kol/canonical.ts",
    nom: "`findUnique` strict sur le handle brut",
    symbole: "where: { handle },",
    emission: `const k = await prisma.kol.findUnique({ where: { handle }, select: { id: true } });`,
  },
  // ── 6. failopen-containment:299 — le contrat partenaire v1 ────────────────
  {
    garde: "failopen-containment",
    cible: "src/app/api/partner/v1/transaction-check/route.ts",
    nom: "consommation de `derivePhantomWarning`",
    symbole: "derivePhantomWarning",
    emission: `import { derivePhantomWarning } from "@/lib/publicScore/schema";`,
  },
  {
    garde: "failopen-containment",
    cible: "src/app/api/partner/v1/batch-score/route.ts",
    nom: "consommation de `preSwapScan`",
    symbole: "preSwapScan",
    emission: `const r = await preSwapScan({ mint, chain });`,
  },
  {
    garde: "failopen-containment",
    cible: "src/app/api/partner/v1/score-lite/route.ts",
    nom: "consommation du type `PreSwapScanResult`",
    symbole: "PreSwapScanResult",
    emission: `let r: PreSwapScanResult | null = null;`,
  },
  // ── 7. evidence-bytes-probe:367 — le module pur ne caviarde rien ──────────
  {
    garde: "evidence-bytes-probe",
    cible: "src/lib/evidence-chain/bytesProbe.ts",
    nom: "caviardage dans le module pur",
    symbole: "redact",
    emission: `console.log(redact(String(err)));`,
  },
];

// ── SENS ROUGE ──────────────────────────────────────────────────────────────
describe("une violation EXÉCUTABLE fait crier la garde", () => {
  for (const c of CAS) {
    it(`${c.garde} · ${c.nom}`, () => {
      expect(emisParLeCode(c.emission, c.symbole)).toBe(true);
    });
  }
});

// ── SENS VERT ───────────────────────────────────────────────────────────────
describe("le MÊME symbole en prose seule laisse la garde muette", () => {
  for (const c of CAS) {
    it(`${c.garde} · ${c.nom}`, () => {
      const plantees = FORMES_DE_PROSE.map((f) => ({
        nom: f.nom,
        src: f.envelopper(c.emission),
      })).filter((f) => trouve(f.src, c.symbole));

      // Sans cette borne, une forme qui ne planterait rien rendrait le sens vert
      // vrai par vacuité. On exige qu'au moins une forme porte réellement le
      // symbole dans la source BRUTE avant de demander le silence.
      expect(plantees.length, "aucune forme de prose ne plante le symbole").toBeGreaterThan(0);

      for (const f of plantees) {
        expect(trouve(f.src, c.symbole), `${f.nom} — non plantée`).toBe(true);
        expect(emisParLeCode(f.src, c.symbole), `${f.nom} — non dépouillée`).toBe(false);
      }
    });
  }
});

// ── MUTATION DISCRIMINANTE ──────────────────────────────────────────────────
/**
 * Doctrine ratifiée :
 *
 *   « An absence guard is probative only if it independently proves that the
 *     prohibited phenomenon exists in its controlled positive witness. »
 *
 * La forme complète est donc TRIPLE, et « grep rend zéro » n'en est aucune des
 * trois :
 *
 *   contrôle d'absence  +  témoin positif contrôlé  +  MUTATION DISCRIMINANTE
 *
 * Les deux premières branches sont au-dessus (sens vert, sens rouge). Voici la
 * troisième. Un critère qui ne distingue pas `codeSeul` d'un dépouillement
 * dégénéré ne mesure rien : les trois dégénérés ci-dessous doivent ÉCHOUER, et
 * `codeSeul` être le seul à tenir les deux sens sur les seize cas.
 *
 * ⚠️ La mutation est ENCODÉE, pas jouée à la main. Une vérification qui ne vit
 * pas dans la suite n'est pas un critère, c'est un souvenir : elle ne protège
 * que le jour où quelqu'un pense à la rejouer.
 */
const critere =
  (depouillement: (s: string) => string) => (src: string, symbole: string | RegExp) =>
    trouve(depouillement(src), symbole);

/**
 * Les fautes d'un dépouillement donné, sur les deux sens et les seize cas.
 * Une forme de prose qui ne plante pas le symbole est HORS SUJET — elle ne
 * peut ni accuser ni disculper, et la compter fabriquerait un écart.
 */
function fautes(depouillement: (s: string) => string): string[] {
  const c = critere(depouillement);
  const out: string[] = [];
  for (const cas of CAS) {
    if (!c(cas.emission, cas.symbole)) out.push(`ROUGE · ${cas.garde} · ${cas.nom}`);
    for (const f of FORMES_DE_PROSE) {
      const src = f.envelopper(cas.emission);
      if (!trouve(src, cas.symbole)) continue;
      if (c(src, cas.symbole)) out.push(`VERT · ${cas.garde} · ${cas.nom} · ${f.nom}`);
    }
  }
  return out;
}

describe("mutation discriminante — le critère distingue, ou il ne mesure rien", () => {
  it("`codeSeul` tient les DEUX sens sur les seize cas, sans exception", () => {
    expect(fautes(codeSeul)).toEqual([]);
  });

  /** Chaque dégénéré, et le sens dans lequel il DOIT tomber. */
  const DEGENERES: ReadonlyArray<
    readonly [string, (s: string) => string, "ROUGE" | "VERT"]
  > = [
    ["identité — ne dépouille rien, lit la source brute", (s) => s, "VERT"],
    ["table rase — efface tout, la garde devient aveugle", () => "", "ROUGE"],
    ["ligne à ligne — l'idiome historique du dépôt", codeSeulLigneALigne, "VERT"],
  ];

  for (const [nom, depouillement, sens] of DEGENERES) {
    it(`${nom} — ÉCHOUE, et dans le sens ${sens}`, () => {
      const f = fautes(depouillement);
      // Qu'il échoue ne suffit pas : il doit échouer LÀ OÙ on l'attend. Un
      // dégénéré qui tomberait dans l'autre sens dirait que le corpus, et non
      // le dépouillement, porte le défaut.
      expect(f.length, "un dégénéré qui passe le critère invalide le critère").toBeGreaterThan(0);
      expect(f.filter((x) => !x.startsWith(sens))).toEqual([]);
    });
  }

  it("les trois dégénérés ne se ressemblent pas — la table rase est l'inverse des deux autres", () => {
    // `identité` et `ligne à ligne` laissent passer la PROSE ; `table rase`
    // efface le CODE. Les deux modes de défaillance sont opposés, et c'est ce
    // qui rend le couple de sens réellement discriminant.
    expect(fautes((s) => s).every((x) => x.startsWith("VERT"))).toBe(true);
    expect(fautes(() => "").every((x) => x.startsWith("ROUGE"))).toBe(true);
    expect(fautes(codeSeulLigneALigne).length).toBeLessThan(fautes((s) => s).length);
  });
});

// ── LE DÉPOUILLEMENT EST UN CRITÈRE, PAS UNE INTENTION ──────────────────────
const GARDES = [
  "__tests__/data-nature/claims-invariants.test.ts",
  "__tests__/kol-memory/wiring.test.ts",
  "__tests__/kol-memory/e1-e2-wiring.test.ts",
  "__tests__/prebuy/failopen-containment.test.ts",
  "__tests__/security/evidence-bytes-probe.test.ts",
] as const;

describe("les six gardes passent par l'exemplaire unique", () => {
  it("chacune importe `__tests__/casefile/codeSeul`", () => {
    for (const g of GARDES) {
      expect(lire(g), g).toContain('from "../casefile/codeSeul"');
    }
  });

  it("aucune ne conserve un dépouillement local", () => {
    for (const g of GARDES) {
      // L'idiome ligne à ligne — `startsWith("//")`, `"*"`, `"/*"`.
      expect(emisParLeCode(lire(g), /startsWith\("(\/\/|\*|\/\*)"\)/), g).toBe(false);
      // L'idiome à expression rationnelle — `.replace(/\/\*[\s\S]*?\*\//g, "")`.
      expect(emisParLeCode(lire(g), /replace\(\/\\\/\\\*/), g).toBe(false);
    }
  });
});

describe("ce dépouillement travaille sur le dépôt réel", () => {
  it("au moins un chemin gardé porte AUJOURD'HUI le symbole en prose", () => {
    // Mesuré le 2026-09-12 : cinq sites — `identity.ts:10` (les deux littéraux),
    // `route.ts:33`, `canonical.ts:122` et `:150`, `casefile/route.ts:17/24/290`.
    // L'assertion est AGRÉGÉE, et c'est délibéré : elle dit que la famille sert
    // à quelque chose, pas que telle prose doive rester écrite. Un en-tête
    // réécrit n'est pas une régression, et une garde qui l'exigerait serait
    // exactement le défaut que ce lot referme.
    const porteurs = CAS.filter((c) => trouve(lire(c.cible), c.symbole));
    expect(porteurs.length).toBeGreaterThan(0);

    // …et sur chacun de ces chemins, la mention ne compte pas comme émission.
    for (const c of porteurs) {
      expect(emisParLeCode(lire(c.cible), c.symbole), `${c.cible} :: ${c.nom}`).toBe(false);
    }
  });
});
