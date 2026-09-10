/**
 * __tests__/casefile/porteurs-artefact-univers.test.ts
 *
 * L'UNIVERS DES PORTEURS D'IDENTITÉ SUR ARTEFACT PORTABLE — DÉCOUVERT, PAS ÉNUMÉRÉ.
 *
 * ██  Un constat n'est pas une preuve. Un cinquième moteur ajouté        ██
 * ██  demain doit ROUGIR, pas passer.                                    ██
 *
 * ─── POURQUOI CETTE GARDE EXISTE ──────────────────────────────────────────
 *
 * La carte des porteurs a d'abord été dressée en partant de `renderCaseFilePDF`
 * — c'est-à-dire en partant de l'IDENTITÉ D'UN MOTEUR. `/api/report/v2` a été
 * classé « transport JSON seul » sur cette base, alors qu'il produit un PDF par
 * un autre moteur (`renderHtmlV2` + puppeteer) qui imprime la même identité non
 * fondée. Un porteur gelé a donc été manqué, et il ne l'aurait pas été si la
 * recherche était partie de la CAPACITÉ DE PRODUIRE UN ARTEFACT PORTABLE.
 *
 * La garde reproduit la recherche par capacité, à chaque exécution :
 *
 *   PRODUCTEUR  pose un `Content-Disposition`, ou appelle un moteur PDF
 *   IMPRIMEUR   interpole une identité de dossier dans un gabarit
 *   PORTEUR     un PRODUCTEUR dont la clôture d'imports atteint un IMPRIMEUR,
 *               et qui fournit une identité NON FONDÉE
 *
 * ─── LE MUTANT NE TOUCHE PAS LE DÉPÔT ─────────────────────────────────────
 *
 * `decouvrirPorteurs` est une fonction PURE d'une carte {chemin → source}. On
 * l'applique au dépôt réel, puis à des corpus SYNTHÉTIQUES portant un cinquième
 * moteur. Démontrer qu'une garde attrape une violation ne doit jamais exiger
 * d'introduire la violation.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const RACINE = path.resolve(__dirname, "../..");

// ── Les trois porteurs DÉCLARÉS ─────────────────────────────────────────────
//
// Périmètre A ratifié : « identity printed/named by a portable CaseFile
// artifact ». Cette liste n'est pas la mesure — c'est ce que la mesure doit
// retrouver toute seule. Si elles divergent, c'est la liste qui a tort.
const PORTEURS_DECLARES: readonly string[] = [
  "src/app/api/casefile/generate/route.ts",
  "src/app/api/pdf/casefile/route.ts",
  "src/app/api/report/v2/route.ts",
];

// ── Les trois capacités ─────────────────────────────────────────────────────

/** Produire un artefact portable : le nommer en en-tête, ou l'imprimer. */
const CAPACITE_PRODUCTEUR = /Content-Disposition|\.\s*pdf\s*\(\s*\{|PDFDocument/i;

/**
 * Imprimer une identité de dossier : l'interpoler dans un gabarit DE DOCUMENT.
 *
 * Deux exigences, et la seconde a été ajoutée après mesure : l'interpolation
 * (`${…}`) — une valeur passée comme argument de lecture n'est pas une valeur
 * imprimée, ce qui exclut à juste titre l'export CSV BOTIFY — ET la présence de
 * balisage sur la même ligne. Sans elle, `src/lib/caseDb.ts:124` était compté
 * imprimeur pour une ligne de JOURNAL :
 *
 *     `[caseDb] offchain_source=case_db case_id=${parsed.case_meta.case_id} `
 *
 * Un log n'est pas un artefact portable. La garde a produit ce faux positif à
 * sa première exécution ; il est corrigé ici, pas contourné par une exception.
 */
const CAPACITE_IMPRIMEUR = /<[^\n]*\$\{[^}]*\b(?:case_id|caseId)\b[^}]*\}|\$\{[^}]*\b(?:case_id|caseId)\b[^}]*\}[^\n]*>/;

/**
 * Identité NON FONDÉE = l'espace de nommage HISTORIQUE du dossier, et lui seul,
 * LU et non ÉCRIT.
 *
 * La négation d'affectation n'est pas cosmétique : sans elle,
 * `report/casefile:71` — `casefile.off_chain.case_id = dossier.ref` — était
 * compté porteur pour la ligne même par laquelle il DEVIENT conforme. Une garde
 * qui condamne la correction qu'elle demande n'est pas utilisable.
 *
 * Exclusion discriminée, pas silencieuse : un `caseId` d'une AUTRE entité —
 * case investigateur (`investigators/cases/[caseId]`), case de graphe — n'est
 * pas une référence de dossier CaseFile et n'entre pas dans ce périmètre.
 */
// La blancheur vit DANS la négation, jamais devant elle : écrite
// `…case_id\s*(?!=[^=>])`, la regex retombe sur ses pieds par retour arrière —
// `\s*` renonce à l'espace, la négation s'évalue sur cet espace, et l'affectation
// passe quand même. Le piège est silencieux : la garde reste verte en apparence.
const IDENTITE_NON_FONDEE = /(?:case_meta\s*\.\s*case_id|off_chain\s*\.\s*case_id)(?!\s*=[^=>])/;

// Il n'y a PAS de motif symétrique « identité fondée ». C'est délibéré : un
// porteur se reconnaît à ce qu'il ÉMET d'historique, jamais à ce qu'il omet.
// Chercher la présence du fondé ferait passer pour conforme une surface qui
// porte les deux — et une surface qui porte les deux est un porteur.

// ── Résolution d'imports, RESTREINTE au corpus ──────────────────────────────

const EXT = [".ts", ".tsx", ".mts", ".mjs", ".js"];

function resoudre(spec: string, depuis: string, corpus: Map<string, string>): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(depuis), spec));
  else return null;
  for (const c of [base, ...EXT.map((e) => base + e), ...EXT.map((e) => base + "/index" + e)]) {
    if (corpus.has(c)) return c;
  }
  return null;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function cloture(entree: string, corpus: Map<string, string>, cap = 400): Set<string> {
  const vus = new Set([entree]);
  const file = [entree];
  while (file.length && vus.size < cap) {
    const f = file.shift()!;
    for (const m of (corpus.get(f) ?? "").matchAll(IMPORT_RE)) {
      const spec = m[1] || m[2];
      if (!spec) continue;
      const r = resoudre(spec, f, corpus);
      if (r && !vus.has(r)) {
        vus.add(r);
        file.push(r);
      }
    }
  }
  return vus;
}

// ── La découverte ───────────────────────────────────────────────────────────

export interface Porteur {
  readonly fichier: string;
  /** Le fichier qui IMPRIME réellement l'identité — souvent un autre. */
  readonly imprimeur: string;
}

export function decouvrirPorteurs(corpus: Map<string, string>): Porteur[] {
  const porteurs: Porteur[] = [];
  for (const [chemin, src] of corpus) {
    if (chemin.includes("__tests__") || /\.test\.tsx?$/.test(chemin)) continue;
    if (!CAPACITE_PRODUCTEUR.test(src)) continue;
    if (!IDENTITE_NON_FONDEE.test(src)) continue;

    // Qui imprime ? Le producteur lui-même, ou un module de sa clôture.
    let imprimeur: string | null = null;
    for (const f of cloture(chemin, corpus)) {
      if (CAPACITE_IMPRIMEUR.test(corpus.get(f) ?? "")) {
        imprimeur = f;
        break;
      }
    }
    if (imprimeur === null) continue;

    porteurs.push({ fichier: chemin, imprimeur });
  }
  return porteurs.sort((a, b) => a.fichier.localeCompare(b.fichier));
}

// ── Corpus synthétiques ─────────────────────────────────────────────────────
//
// Aucun de ces fichiers n'existe. Ils ne sont jamais écrits sur le disque.

const MOTEUR_EXISTANT_IMPRIMEUR = `
  export function renderCaseFilePDF(scan) {
    return \`<div>\${scan.off_chain.case_id ?? "—"}</div>\`;
  }
`;

const CINQUIEME_MOTEUR_SYNTHETIQUE = `
  // Un moteur de rendu que personne n'a encore écrit.
  export function renderHtmlV3(scan) {
    return \`<footer>\${scan.off_chain.case_id}</footer>\`;
  }
`;

const ROUTE_MUTANTE = `
  import { renderHtmlV3 } from "@/lib/pdf/v3/templateV3";
  export async function GET(req) {
    const caseFile = loadCaseByMint(mint);
    const scan = { off_chain: { case_id: caseFile?.case_meta.case_id ?? null } };
    const html = renderHtmlV3(scan);
    return new Response(await toPdf(html), {
      headers: { "Content-Disposition": 'attachment; filename="v3.pdf"' },
    });
  }
`;

const ROUTE_CONFORME = `
  import { renderHtmlV3 } from "@/lib/pdf/v3/templateV3";
  export async function GET(req) {
    const dossier = await loadCanonicalCaseFile(ref);
    const scan = { off_chain: { case_id: dossier.ref } };
    const html = renderHtmlV3(scan);
    return new Response(await toPdf(html), {
      headers: { "Content-Disposition": 'attachment; filename="v4.pdf"' },
    });
  }
`;

function corpusSynthetique(entrees: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entrees));
}

describe("univers · la garde découvre un moteur qu'elle ne connaît pas", () => {
  it("MUTANT — un CINQUIÈME moteur, jamais nommé nulle part, est découvert", () => {
    const trouves = decouvrirPorteurs(
      corpusSynthetique({
        "src/lib/pdf/v3/templateV3.ts": CINQUIEME_MOTEUR_SYNTHETIQUE,
        "src/app/api/report/v3/route.ts": ROUTE_MUTANTE,
      }),
    );
    expect(trouves.map((p) => p.fichier)).toEqual(["src/app/api/report/v3/route.ts"]);
    expect(trouves[0].imprimeur).toBe("src/lib/pdf/v3/templateV3.ts");
  });

  it("CONTRÔLE NÉGATIF — le MÊME moteur, alimenté par la référence fondée, n'est pas un porteur", () => {
    const trouves = decouvrirPorteurs(
      corpusSynthetique({
        "src/lib/pdf/v3/templateV3.ts": CINQUIEME_MOTEUR_SYNTHETIQUE,
        "src/app/api/report/v4/route.ts": ROUTE_CONFORME,
      }),
    );
    expect(trouves).toEqual([]);
  });

  it("la garde ne dépend d'aucun nom de moteur — les deux moteurs sont vus de la même façon", () => {
    const avecV3 = decouvrirPorteurs(
      corpusSynthetique({
        "src/lib/pdf/v3/templateV3.ts": CINQUIEME_MOTEUR_SYNTHETIQUE,
        "src/app/api/report/v3/route.ts": ROUTE_MUTANTE,
      }),
    );
    const avecExistant = decouvrirPorteurs(
      corpusSynthetique({
        "src/lib/pdf/v3/templateV3.ts": MOTEUR_EXISTANT_IMPRIMEUR,
        "src/app/api/report/v3/route.ts": ROUTE_MUTANTE,
      }),
    );
    expect(avecV3.map((p) => p.fichier)).toEqual(avecExistant.map((p) => p.fichier));
  });

  it("un producteur qui n'imprime RIEN n'est pas un porteur — la clef de lecture n'est pas une émission", () => {
    const trouves = decouvrirPorteurs(
      corpusSynthetique({
        "src/app/api/export/route.ts": `
          export async function GET() {
            const db = await charger(caseData.case_meta.case_id);
            return new Response(toCsv(db), {
              headers: { "Content-Disposition": 'attachment; filename="table.csv"' },
            });
          }
        `,
      }),
    );
    expect(trouves).toEqual([]);
  });
});

describe("univers · la propriété, sur le dépôt réel", () => {
  const corpus = new Map<string, string>();
  for (const f of execSync(`git -C ${RACINE} ls-files 'src/**/*.ts' 'src/**/*.tsx'`, {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)) {
    corpus.set(f, readFileSync(path.join(RACINE, f), "utf8"));
  }

  /** Les racines gelées, telles que `scripts/guard-offline.sh` les déclare. */
  const estGele = (f: string) =>
    /^(src\/app\/api\/|src\/components\/|src\/lib\/(?:scoring|tigerscore|watcher|pdf|evidence|kol|auth|security)\/|src\/middleware\/|src\/proxy\.ts$|prisma\/|migrations\/)/.test(
      f,
    );

  it("l'univers GELÉ découvert est EXACTEMENT les porteurs déclarés — ni plus, ni moins", () => {
    const trouves = decouvrirPorteurs(corpus).map((p) => p.fichier).filter(estGele);
    expect(trouves).toEqual([...PORTEURS_DECLARES].sort());
  });

  /**
   * Un porteur en terrain LIBRE ne demande aucune fenêtre — mais il ne doit pas
   * disparaître de la carte pour autant. `pdfGenerator` en est un : il imprime
   * le `h1` (ligne 312) et NOMME la clef d'archive (ligne 628) depuis l'identité
   * historique. Les deux sont connus et libres ; ils sont listés ici pour que
   * l'apparition d'un TROISIÈME porteur libre soit visible.
   */
  it("les porteurs en terrain LIBRE sont eux aussi énumérés, et connus", () => {
    const libres = decouvrirPorteurs(corpus).map((p) => p.fichier).filter((f) => !estGele(f));
    expect(libres).toEqual(["src/lib/casefile/pdfGenerator.ts"]);
  });

  it("chaque porteur déclaré nomme le moteur qui imprime réellement son identité", () => {
    const parFichier = new Map(decouvrirPorteurs(corpus).map((p) => [p.fichier, p.imprimeur]));
    expect(parFichier.get("src/app/api/pdf/casefile/route.ts")).toBe(
      "src/components/pdf/pdfRenderer.ts",
    );
    expect(parFichier.get("src/app/api/report/v2/route.ts")).toBe("src/lib/pdf/v2/templateV2.ts");
    expect(parFichier.get("src/app/api/casefile/generate/route.ts")).toBe(
      "src/lib/casefile/pdfGenerator.ts",
    );
  });
});
