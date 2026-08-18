// A14 — GARDE ANTI-RÉCIDIVE — **PRÉPARÉ, NON LIVRÉ.**
//
// EMPLACEMENT CIBLE : `__tests__/security/monetary-surface-coverage.test.ts`.
// Ce fichier vit sous docs/prep/patches/ avec l'extension `.test.ts` mais HORS
// des répertoires que Vitest parcourt : il ne s'exécute pas. C'est délibéré —
// il fige un état qui n'est pas encore le bon, et le poser aujourd'hui rendrait
// vert un cliquet qui doit être calibré après les correctifs de surface.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'IL EMPÊCHE
// ═══════════════════════════════════════════════════════════════════════════
//
// A13 a trouvé 36 porteurs de chiffres nominatifs, 4 couverts. Le recensement
// a coûté une demi-journée et il sera périmé au prochain champ ajouté.
//
// **Un recensement par `SELECT` ne suffira jamais** : quatre des porteurs ne
// sont dans aucune table — ils sont dans le code (`CASE_DB`, les `cexTargets`
// de class-action, les 62 %/78 % de `pdfGeneratorPublic`). La seconde passe
// doit donc se faire sur le code, et elle n'est reproductible que par un test.
//
// C'est ce qui empêche les 36 de devenir 40.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'IL N'EST PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// Ce n'est **pas** une preuve de couverture. Il ne prouve pas qu'un montant est
// filtré — seulement qu'un fichier qui en manipule un connaît l'existence d'un
// point de filtrage. Un fichier peut importer le garde et l'oublier sur une
// ligne. Le test attrape l'ajout silencieux, pas l'erreur d'application.
//
// Il produit aussi des faux positifs assumés : `types.ts` déclare des types,
// `signals.ts` calcule des seuils. Ils comptent dans le plafond et le feront
// baisser quand on les traitera — un cliquet honnête compte ce qu'il voit.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ── Le plafond, mesuré le 2026-08-18 sur l'arbre SANS les correctifs A14 ────
//
// Pour le faire baisser : couvrir un fichier, puis baisser le nombre. Il ne
// doit JAMAIS être relevé sans une ligne de justification ici même.
const MAX_MONETAIRES_SANS_GARDE = 15;
const MAX_PROSE_SANS_GARDE = 5;

/** Les champs qui portent un montant. Étendre cette liste est le bon réflexe. */
const CHAMPS_MONETAIRES = [
  "totalScammed",
  "paidUsd",
  "amountUsd",
  "proceedsUsd",
  "totalDocumented",
  "totalProceedsUsd",
  "publishedValueUsd",
  "pricePerPost",
  "topWalletProceedsUsd",
  "largestEventUsd",
];

/** Les champs de prose susceptibles de contenir un chiffre. */
const CHAMPS_PROSE = [
  "narrativeText",
  "documentedFacts",
  "partialFacts",
  "observedBehaviorSummary",
  "exitNarrative",
  "internalNote",
  "coverageNote",
  "topWalletLabel",
  "sourceLabel",
  "attributionNote",
  "contentSnippet",
];

/** Les points de filtrage connus. Un fichier qui en importe un est considéré informé. */
const POINTS_DE_FILTRAGE = ["proceedsGate", "monetaryGate", "publicationGate", "publishGate"];

/**
 * Les répertoires qui servent du nominatif — dérivés du matcher de
 * `src/proxy.ts` et de `NOMINATIVE_PREFIXES` de `nominativeApiGate.ts`, plus
 * les bibliothèques et composants qu'ils consomment.
 *
 * Ajouter une surface nominative sans l'ajouter ici la rendrait invisible au
 * garde. C'est la limite connue, et elle est nommée.
 */
const SURFACES_NOMINATIVES = [
  "src/app/api/kol",
  "src/app/api/v1/kol",
  "src/app/api/watchlist",
  "src/app/api/laundry",
  "src/app/api/cluster",
  "src/app/api/coordination",
  "src/app/api/explorer",
  "src/app/api/casefile",
  "src/app/api/token",
  "src/app/api/scan",
  "src/app/api/mobile",
  "src/app/api/pdf",
  "src/lib/kol",
  "src/lib/explorer",
  "src/lib/ask",
  "src/lib/laundry",
  "src/components/kol",
  "src/components/token",
];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

function scan(champs: string[]): string[] {
  const coupables: string[] = [];
  for (const dir of SURFACES_NOMINATIVES) {
    for (const file of walk(dir)) {
      const src = fs.readFileSync(file, "utf8");
      if (POINTS_DE_FILTRAGE.some((g) => src.includes(g))) continue;
      if (champs.some((c) => new RegExp(`\\b${c}\\b`).test(src))) {
        coupables.push(path.relative(process.cwd(), file));
      }
    }
  }
  return coupables.sort();
}

describe("garde anti-récidive — aucun chiffre nominatif nouveau sans point de filtrage", () => {
  it("champs MONÉTAIRES sur surface nominative", () => {
    const coupables = scan(CHAMPS_MONETAIRES);
    expect(
      coupables.length,
      `Fichiers manipulant un montant nominatif sans importer de point de filtrage ` +
        `(${coupables.length}, plafond ${MAX_MONETAIRES_SANS_GARDE}) :\n  ${coupables.join("\n  ")}\n\n` +
        `Si c'est un ajout : passe le montant par src/lib/publication/monetaryGate.ts. ` +
        `Si c'est un faux positif : traite-le quand même, ou justifie-le ici.`,
    ).toBeLessThanOrEqual(MAX_MONETAIRES_SANS_GARDE);
  });

  it("champs de PROSE sur surface nominative", () => {
    const coupables = scan(CHAMPS_PROSE);
    expect(
      coupables.length,
      `Fichiers manipulant de la prose nominative sans point de filtrage ` +
        `(${coupables.length}, plafond ${MAX_PROSE_SANS_GARDE}) :\n  ${coupables.join("\n  ")}`,
    ).toBeLessThanOrEqual(MAX_PROSE_SANS_GARDE);
  });

  it("les points de filtrage existent tous", () => {
    // Renommer un garde sans mettre à jour cette liste désarmerait le test en
    // silence : tous les fichiers redeviendraient « informés » ou « coupables »
    // d'un coup, selon le sens du renommage.
    const attendus = [
      "src/lib/kol/proceedsGate.ts",
      "src/lib/kol/publishGate.ts",
      "src/lib/publication/monetaryGate.ts",
      "src/lib/laundry/publicationGate.ts", // A12
    ];
    for (const f of attendus) {
      expect(fs.existsSync(path.join(process.cwd(), f)), `point de filtrage disparu : ${f}`).toBe(true);
    }
  });

  it("aucune surface nominative n'est sortie du périmètre balayé", () => {
    // Le garde ne voit que ce qu'on lui montre. Si `nominativeApiGate.ts`
    // déclare un préfixe qui n'est pas balayé ici, un chiffre peut y entrer
    // sans être vu.
    const gateSrc = fs.readFileSync(
      path.join(process.cwd(), "src/lib/security/nominativeApiGate.ts"),
      "utf8",
    );
    const prefixes = [...gateSrc.matchAll(/"(\/api\/[a-z0-9/_-]+)\/"/g)].map((m) => m[1]);
    const nonCouverts = prefixes.filter(
      (p) => !SURFACES_NOMINATIVES.some((d) => d.startsWith("src/app" + p)),
    );
    expect(
      nonCouverts,
      `Préfixes nominatifs déclarés mais non balayés : ${nonCouverts.join(", ")}`,
    ).toEqual([]);
  });
});
