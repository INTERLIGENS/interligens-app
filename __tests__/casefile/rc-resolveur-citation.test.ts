/**
 * __tests__/casefile/rc-resolveur-citation.test.ts
 *
 * RÉSOLUTION DE CITATION — EXACTE, ET RIEN D'AUTRE.
 *
 * ██  Un résolveur exact qui n'a jamais été prouvé exact n'est pas exact.  ██
 *
 * `resolveCaseFileRef` établit une IDENTITÉ, et seulement elle :
 *
 *     EXACT_MATCH  ·  NOT_FOUND        et aucune troisième issue.
 *
 * INTERDITS, explicitement : approximation, préfixe, sous-chaîne, nom de code,
 * handle d'acteur, similarité de mint, lecture d'une forme `CASE-*`, repli
 * implicite sur un alias historique.
 *
 * ─── DEUX FAÇONS DE VIOLER CE CONTRAT PAR ACCIDENT ──────────────────────────
 *
 * 1. RENDRE LE DOSSIER. Si `EXACT_MATCH` porte le titre, les claims ou le
 *    statut, le résolveur devient une surface de PUBLICATION et l'on a
 *    réinventé l'explorer par la porte de service. La citation établit
 *    l'identité ; elle ne rend publiable aucune autre propriété du dossier.
 *
 * 2. DISTINGUER « absent » DE « existe mais invisible pour toi ». Si l'appelant
 *    peut faire la différence, le résolveur devient un test d'appartenance
 *    ÉNUMÉRABLE. Doctrine ratifiée : on peut TESTER l'appartenance, on ne peut
 *    pas l'ÉNUMÉRER. Les deux issues doivent être indiscernables — non pas
 *    « équivalentes », mais IDENTIQUES, champ pour champ.
 *
 * ─── LE CRITÈRE EST UNE FONCTION, LE MUTANT EST UNE IMPLÉMENTATION ──────────
 *
 * `criteresExactitude()` prend un résolveur et rend la liste de ses échecs. On
 * l'applique à la vraie primitive (elle doit rendre une liste VIDE) puis à
 * quatre implémentations mutantes (chacune doit rendre une liste NON vide).
 * « Le mutant tue le critère » cesse d'être une affirmation de rapport : c'est
 * une assertion de la suite.
 */

import { describe, it, expect } from "vitest";

// ── Le magasin de fixture ───────────────────────────────────────────────────

const BOTIFY = "IL-SHILL-BOTIFY-001";
const CBEX_INVISIBLE = "IL-PON-CBEX-001";

export interface Enregistrement {
  readonly ref: string;
  readonly visible: boolean;
  // Présents EXPRÈS : si le résolveur les laisse fuir dans sa réponse, le
  // critère de forme le voit.
  readonly title: string;
  readonly publishStatus: string;
}

const MAGASIN: readonly Enregistrement[] = [
  { ref: BOTIFY, visible: true, title: "BOTIFY — dossier canonique", publishStatus: "published" },
  { ref: CBEX_INVISIBLE, visible: false, title: "CBEX — dossier plateforme", publishStatus: "draft" },
];

/** Le port : recherche EXACTE, et c'est tout ce que la primitive reçoit. */
const portExact = {
  async trouverParRefExact(ref: string): Promise<Enregistrement | null> {
    return MAGASIN.find((e) => e.ref === ref) ?? null;
  },
};

export type Issue = { readonly outcome: "EXACT_MATCH" | "NOT_FOUND" };
export type Resolveur = (ref: string, port: typeof portExact) => Promise<Issue>;

// ── Le critère ──────────────────────────────────────────────────────────────

/** Les formes qui ne doivent JAMAIS résoudre. Chacune nomme son interdit. */
const FORMES_REFUSEES: ReadonlyArray<readonly [string, string]> = [
  ["IL-SHILL-BOTIFY", "préfixe"],
  ["IL-SHILL", "préfixe court"],
  ["SHILL-BOTIFY-001", "sous-chaîne"],
  ["BOTIFY", "nom de code"],
  ["il-shill-botify-001", "casse"],
  [" IL-SHILL-BOTIFY-001", "espace en tête"],
  ["IL-SHILL-BOTIFY-001 ", "espace en fin"],
  ["IL-SHILL-BOTIFY-001-X", "sur-chaîne"],
  ["CASE-2024-BOTIFY-001", "forme CASE-* historique"],
  ["CASE-2026-BOTIFY-001", "forme CASE-* réécrite par l'horloge"],
  ["BOTIFY-MAIN", "forme courte du contournement explorer"],
  ["bkokoski", "handle d'acteur"],
  ["UnZacija4pumpBOTIFYmintxxxxxxxxxxxxxxxxxxxx", "mint"],
  ["", "chaîne vide"],
  ["%", "joker SQL"],
  ["IL-%", "joker SQL préfixé"],
];

export async function criteresExactitude(resoudre: Resolveur): Promise<string[]> {
  const echecs: string[] = [];
  const dire = (c: boolean, quoi: string) => {
    if (!c) echecs.push(quoi);
  };

  // 1. La référence exacte, visible, résout.
  const exact = await resoudre(BOTIFY, portExact);
  dire(exact.outcome === "EXACT_MATCH", "la référence exacte ne résout pas");

  // 2. Aucune forme approchante ne résout.
  for (const [forme, interdit] of FORMES_REFUSEES) {
    const r = await resoudre(forme, portExact);
    dire(r.outcome === "NOT_FOUND", `${interdit} : « ${forme} » a résolu`);
  }

  // 3. EXACT_MATCH ne porte RIEN du dossier au-delà de son existence.
  dire(
    Object.keys(exact).length === 1 && Object.keys(exact)[0] === "outcome",
    `EXACT_MATCH porte autre chose que l'issue : ${Object.keys(exact).join(", ")}`,
  );
  dire(
    !JSON.stringify(exact).includes("BOTIFY —") && !JSON.stringify(exact).includes("published"),
    "EXACT_MATCH laisse fuir une propriété du dossier",
  );

  // 4. « existe mais invisible » est IDENTIQUE à « absent ».
  const invisible = await resoudre(CBEX_INVISIBLE, portExact);
  const absent = await resoudre("IL-INEXISTANT-000", portExact);
  dire(invisible.outcome === "NOT_FOUND", "un dossier invisible se signale comme trouvé");
  dire(
    JSON.stringify(invisible) === JSON.stringify(absent),
    "invisible et absent sont distinguables — l'appartenance devient énumérable",
  );

  return echecs;
}

// ── Les mutants ─────────────────────────────────────────────────────────────

const MUTANT_PREFIXE: Resolveur = async (ref) => ({
  outcome: MAGASIN.some((e) => e.ref.startsWith(ref) && e.visible && ref.length > 0)
    ? "EXACT_MATCH"
    : "NOT_FOUND",
});

const MUTANT_SOUS_CHAINE: Resolveur = async (ref) => ({
  outcome: MAGASIN.some((e) => ref.length > 0 && e.ref.includes(ref) && e.visible)
    ? "EXACT_MATCH"
    : "NOT_FOUND",
});

const MUTANT_REPLI_NOM_DE_CODE: Resolveur = async (ref, port) => {
  const exact = await port.trouverParRefExact(ref);
  if (exact?.visible) return { outcome: "EXACT_MATCH" };
  // Le repli « pratique » : on tente le nom de code. C'est l'aliasing implicite.
  const parNom = MAGASIN.find((e) => e.title.toUpperCase().startsWith(ref.toUpperCase()) && ref.length > 0);
  return { outcome: parNom ? "EXACT_MATCH" : "NOT_FOUND" };
};

const MUTANT_FUITE_VISIBILITE: Resolveur = async (ref, port) => {
  const e = await port.trouverParRefExact(ref);
  if (e === null) return { outcome: "NOT_FOUND" };
  if (!e.visible) return { outcome: "NOT_FOUND", raison: "restreint" } as unknown as Issue;
  return { outcome: "EXACT_MATCH" };
};

describe("citation · le critère a des dents — chaque mutant le tue", () => {
  it("MUTANT préfixe", async () => {
    expect(await criteresExactitude(MUTANT_PREFIXE)).not.toEqual([]);
  });

  it("MUTANT sous-chaîne", async () => {
    expect(await criteresExactitude(MUTANT_SOUS_CHAINE)).not.toEqual([]);
  });

  it("MUTANT repli sur le nom de code (aliasing implicite)", async () => {
    expect(await criteresExactitude(MUTANT_REPLI_NOM_DE_CODE)).not.toEqual([]);
  });

  it("MUTANT fuite de visibilité — invisible devient distinguable d'absent", async () => {
    expect(await criteresExactitude(MUTANT_FUITE_VISIBILITE)).not.toEqual([]);
  });

  it("un résolveur qui refuse TOUT ne passe pas non plus — contrôle négatif", async () => {
    const refuseTout: Resolveur = async () => ({ outcome: "NOT_FOUND" });
    expect(await criteresExactitude(refuseTout)).not.toEqual([]);
  });
});

describe("citation · la propriété, sur la primitive", () => {
  it("`resolveCaseFileRef` satisfait tous les critères d'exactitude", async () => {
    const { resolveCaseFileRef } = await import("@/lib/casefile/ref");
    expect(await criteresExactitude(resolveCaseFileRef as unknown as Resolveur)).toEqual([]);
  });

  it("n'est exposée par AUCUNE route dans ce lot — la surface est une projection, et elle vient après", async () => {
    const { execSync } = await import("node:child_process");
    const path = await import("node:path");
    const racine = path.resolve(__dirname, "../..");
    // ── BUILD 13 · S3 — UNE MENTION N'EST PAS UNE EXPOSITION ───────────────
    //
    // ██  Le grep brut comptait un COMMENTAIRE comme un appel.            ██
    //
    // `src/app/api/pdf/casefile/route.ts` NOMME `resolveCaseFileRef` dans la
    // prose qui justifie la forme de son refus (« comme resolveCaseFileRef rend
    // la constante NOT_FOUND elle-même »). Il ne l'appelle pas, ne l'importe
    // pas, ne l'expose pas. La propriété défendue ici est l'EXPOSITION par une
    // surface — pas l'occurrence de sept syllabes dans un fichier.
    //
    // C'est exactement le faux positif déjà mesuré sur
    // `porteurs-artefact-univers.test.ts`, où `caseDb.ts:124` était compté
    // imprimeur pour une ligne de JOURNAL. Même correction, même raison : on
    // lit le CODE, jamais la prose. `codeSeul` est l'idiome du dépôt
    // (`__tests__/kol-memory/e1-e2-wiring.test.ts:17`).
    const codeSeul = (src: string) =>
      src
        .split("\n")
        .filter((l) => {
          const t = l.trimStart();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
        })
        .join("\n");

    const { readFileSync } = await import("node:fs");
    const candidats = execSync(
      `git -C ${racine} grep -l 'resolveCaseFileRef' -- 'src/app' || true`,
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean);

    const appels = candidats.filter((f) =>
      codeSeul(readFileSync(path.join(racine, f), "utf8")).includes("resolveCaseFileRef"),
    );
    expect(appels).toEqual([]);

    // La sonde n'est pas aveugle : elle voit bien un appel réel.
    expect(codeSeul(`const r = await resolveCaseFileRef(x);`)).toContain("resolveCaseFileRef");
    // Et elle ignore bien une mention en prose.
    expect(codeSeul(`  // comme resolveCaseFileRef rend NOT_FOUND`)).not.toContain(
      "resolveCaseFileRef",
    );
  });
});
