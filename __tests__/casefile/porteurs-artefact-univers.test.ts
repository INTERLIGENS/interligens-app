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
import { codeSeul, codeSeulLigneALigne } from "./codeSeul";

const RACINE = path.resolve(__dirname, "../..");

// ── LE REGISTRE — des porteurs CLASSÉS, jamais un nombre ───────────────────
//
// ██  Un compte est une liste déguisée. On classe, on ne compte pas.  ██
//
// La garde ne défend PAS « il y en a trois ». Elle défend « tout porteur
// découvert porte un ÉTAT ». Les deux propriétés se ressemblent tant que rien
// ne bouge, et divergent dès que quelque chose bouge :
//
//   un porteur NOUVEAU, absent du registre    → ROUGE   (c'est le but)
//   un porteur RETIRÉ du dépôt                → VERT    (un compte rougirait)
//
// Le cliquet porte donc sur une IDENTITÉ — le chemin du fichier — jamais sur
// un total ni sur une coordonnée. Une ligne qui se déplace ne déclasse rien.

export type EtatPorteur =
  /** Émet la référence FONDÉE dans son emplacement de citation. */
  | "CONFORME"
  /** Affirme sur l'INSTANCE une autorité qui n'est vraie que de la SURFACE. */
  | "P1_AUTORITE_D_INSTANCE"
  /** Émet une identité de l'espace de nommage historique sur un artefact portable. */
  | "P1_IDENTITE_NON_FONDEE"
  /** N'émet rien de son propre chef : il rend ce que son appelant lui donne. */
  | "PASSIF";

export interface EntreeRegistre {
  readonly etat: EtatPorteur;
  readonly gele: boolean;
  readonly note: string;
}

/**
 * Toute surface qui IMPRIME ou NOMME une identité de dossier sur un artefact
 * portable, et son état.
 *
 * Le registre est plus large que la découverte : il déclare aussi les
 * IMPRIMEURS PASSIFS et les surfaces CONFORMES, que la découverte ne signale
 * pas. C'est délibéré, et c'est ce qui rend le retrait d'un porteur silencieux :
 * l'assertion va de la DÉCOUVERTE vers le REGISTRE, jamais l'inverse.
 */
export const REGISTRE_PORTEURS: Readonly<Record<string, EntreeRegistre>> = {
  "src/app/api/casefile/generate/route.ts": {
    etat: "CONFORME",
    gele: true,
    note: "BUILD 13 · S3 — nomme l'artefact depuis le `ref` du dossier chargé, et `casefile-ungoverned.pdf` quand `body.data` n'en charge aucun. L'estampille d'instance a été fermée en terrain libre par b051d55.",
  },
  "src/app/api/pdf/casefile/route.ts": {
    etat: "CONFORME",
    gele: true,
    note: "BUILD 13 · S3 — `off_chain.case_id = dossierGouverne.ref`, et FAIL-CLOSED : sans dossier gouverné persisté, aucun artefact (404 `no_governed_casefile`, refus indiscernable par cause).",
  },
  "src/app/api/report/v2/route.ts": {
    etat: "CONFORME",
    gele: true,
    note: "BUILD 13 · S3 — cite le ref gouverné quand un dossier le fonde, `null` sinon. PAS de fail-closed : cette surface sert des mints SANS dossier par contrat (booster `no_casefile`), et le mint tronqué y reste un identifiant de SUJET.",
  },
  "src/lib/casefile/pdfGenerator.ts": {
    etat: "P1_IDENTITE_NON_FONDEE",
    gele: false,
    note: "Imprime le `h1` (l.312) et NOMME la clef d'archive (l.628) depuis l'identité historique, alors que la ligne 278 dispose de `canonical?.ref`. Terrain libre : aucune fenêtre requise.",
  },
  "src/app/api/report/casefile/route.ts": {
    etat: "CONFORME",
    gele: true,
    note: "Pose `off_chain.case_id = dossier.ref` (l.71). C'est le PRÉCÉDENT du dépôt : la référence fondée occupe l'emplacement, sans changer aucun type.",
  },
  "src/app/api/casefile/pdf/route.ts": {
    etat: "CONFORME",
    gele: true,
    note: "Transmet `canonical: { ref: dossier.ref }` (l.163) et nomme le fichier depuis `ref` (l.141/176). Fail-closed à l.189.",
  },
  "src/app/api/casefile/public/route.ts": {
    etat: "CONFORME",
    gele: true,
    note: "Nomme le fichier depuis `ref` (l.103) ; le rendu public imprime `dossier.ref`.",
  },
  "src/components/pdf/pdfRenderer.ts": {
    etat: "PASSIF",
    gele: true,
    note: "Imprime `off_chain.case_id` (l.162) sans le produire. Deux appelants, un conforme, un non. On ne le modifie pas parce qu'un appelant fournit la mauvaise propriété.",
  },
  "src/lib/pdf/v2/templateV2.ts": {
    etat: "PASSIF",
    gele: true,
    note: "Imprime `off_chain.case_id` (l.427) sans le produire. Un seul appelant, non conforme.",
  },
};

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

/**
 * ── BUILD 13 · S3 — UNE MENTION N'EST PAS UNE ÉMISSION ─────────────────────
 *
 * ██  Troisième fois que ce motif mord, sous une troisième forme.       ██
 *
 * CAUSE MESURÉE (4917bf2 → 6f0ec29) : la découverte testait ses trois motifs
 * sur le texte BRUT du corpus. Ce n'est pas « le dépouillement ne retire pas
 * les commentaires » ni « il n'est pas appelé ici » — AUCUN dépouillement
 * n'existait sur ce chemin. Une route CORRIGÉE, qui ne fait plus que NOMMER
 * `case_meta.case_id` dans le commentaire expliquant pourquoi elle ne l'émet
 * plus, restait comptée porteuse. Une garde dont le signal survit à sa propre
 * correction ne signale plus rien : elle reste verte par inertie, et le jour
 * où un vrai porteur apparaît, il se noie dans les faux.
 *
 * Le dépôt a déjà rencontré ce motif deux fois :
 *   · `caseDb.ts:124` compté IMPRIMEUR pour une ligne de JOURNAL (corrigé en
 *     exigeant du balisage sur la ligne) ;
 *   · `resolveCaseFileRef` compté EXPOSÉ pour une mention en prose
 *     (`rc-resolveur-citation.test.ts`, corrigé dans ce même lot).
 *
 * On lit le CODE, jamais la prose. Le dépouillement vit dans
 * `./codeSeul` — un seul exemplaire pour les deux gardes, avec son propre
 * critère dans les deux sens (`mention-vs-emission.test.ts`). Il s'applique
 * aux TROIS capacités — producteur, imprimeur, identité — parce qu'un
 * commentaire peut porter n'importe laquelle des trois.
 */
export { codeSeul };

export function decouvrirPorteurs(corpus: Map<string, string>): Porteur[] {
  const porteurs: Porteur[] = [];
  for (const [chemin, brut] of corpus) {
    if (chemin.includes("__tests__") || /\.test\.tsx?$/.test(chemin)) continue;
    const src = codeSeul(brut);
    if (!CAPACITE_PRODUCTEUR.test(src)) continue;
    if (!IDENTITE_NON_FONDEE.test(src)) continue;

    // Qui imprime ? Le producteur lui-même, ou un module de sa clôture.
    let imprimeur: string | null = null;
    for (const f of cloture(chemin, corpus)) {
      if (CAPACITE_IMPRIMEUR.test(codeSeul(corpus.get(f) ?? ""))) {
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
  it("MUTANT — un CINQUIÈME moteur rougit parce qu'il est ABSENT DU REGISTRE, pas parce que le total a bougé", () => {
    const trouves = decouvrirPorteurs(
      corpusSynthetique({
        "src/lib/pdf/v3/templateV3.ts": CINQUIEME_MOTEUR_SYNTHETIQUE,
        "src/app/api/report/v3/route.ts": ROUTE_MUTANTE,
      }),
    );
    expect(trouves.map((p) => p.fichier)).toEqual(["src/app/api/report/v3/route.ts"]);
    expect(trouves[0].imprimeur).toBe("src/lib/pdf/v3/templateV3.ts");
    // LA raison du rouge : le registre ne le connaît pas.
    expect("src/app/api/report/v3/route.ts" in REGISTRE_PORTEURS).toBe(false);
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

  /**
   * La négation d'affectation a été FAUSSE une fois, et sa fausseté ressemblait
   * à un succès : écrite `…case_id\s*(?!=[^=>])`, elle laissait passer
   * l'affectation par retour arrière. On vérifie ici que c'est bien la forme
   * CORRIGÉE qui tourne — une garde reformée sur une regex fausse serait la
   * même faute au propre.
   */
  it("la négation d'affectation est bien la forme corrigée, et elle mord", () => {
    // ÉCRITE — la ligne par laquelle une surface devient conforme : ignorée.
    expect(IDENTITE_NON_FONDEE.test("casefile.off_chain.case_id = dossier.ref;")).toBe(false);
    expect(IDENTITE_NON_FONDEE.test("off_chain.case_id  =  founded;")).toBe(false);
    // LUE — les trois formes réelles des porteurs : vues.
    expect(IDENTITE_NON_FONDEE.test("case_id: caseFile?.case_meta.case_id ?? null,")).toBe(true);
    expect(IDENTITE_NON_FONDEE.test("`${input.case_meta.case_id}.pdf`")).toBe(true);
    expect(IDENTITE_NON_FONDEE.test("${off_chain.case_id ?? mint.slice(0,8)}")).toBe(true);
    // Comparaison, pas affectation : c'est une lecture.
    expect(IDENTITE_NON_FONDEE.test("if (off_chain.case_id === ref)")).toBe(true);
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

  /** Les porteurs découverts que le registre ne connaît pas. LA propriété. */
  const nonClasses = (c: Map<string, string>) =>
    decouvrirPorteurs(c)
      .map((p) => p.fichier)
      .filter((f) => !(f in REGISTRE_PORTEURS));

  it("LA PROPRIÉTÉ — tout porteur découvert porte un état. Aucun inconnu.", () => {
    expect(nonClasses(corpus)).toEqual([]);
  });

  it("l'état déclaré de chaque porteur découvert est lisible, et son gel est exact", () => {
    for (const p of decouvrirPorteurs(corpus)) {
      const entree = REGISTRE_PORTEURS[p.fichier];
      expect(entree, `${p.fichier} n'est pas classé`).toBeDefined();
      expect(entree.etat).not.toBe("PASSIF"); // un passif n'émet rien : il ne peut pas être découvert
      expect(entree.gele).toBe(estGele(p.fichier));
      expect(entree.note.length).toBeGreaterThan(40);
    }
  });

  /**
   * LE COROLLAIRE — c'est lui qui distingue une classification d'un compte.
   *
   * On ampute le corpus d'un porteur réel. Un cliquet qui défendait « il y en a
   * trois » rougirait : le total a changé. Un cliquet qui défend « aucun
   * inconnu » reste vert : rien de nouveau n'est apparu.
   *
   * Les deux assertions sont posées ensemble, et la seconde est la preuve que
   * la première n'est pas triviale.
   */
  // BUILD 13 · S3 — l'amputation porte sur `pdfGenerator.ts`, seul porteur
  // encore découvert depuis que les trois routes dérivent du ref gouverné.
  // Le corollaire ne dépend d'AUCUN porteur en particulier : il dépend qu'il
  // y en ait un. Le jour où il n'y en aura plus, ce test devra le dire — pas
  // se taire.
  it("COROLLAIRE — retirer un porteur du dépôt ne rougit PAS, alors qu'un compte rougirait", () => {
    const reels = decouvrirPorteurs(corpus).map((p) => p.fichier);
    expect(reels.length, "plus aucun porteur : le corollaire n'a rien à amputer").toBeGreaterThan(0);
    const ampute = new Map(corpus);
    ampute.delete(reels[0]);

    // La classification tient.
    expect(nonClasses(ampute)).toEqual([]);

    // Et le compte, lui, a bougé — un cliquet numérique aurait échoué ici.
    expect(decouvrirPorteurs(ampute).length).toBeLessThan(decouvrirPorteurs(corpus).length);
  });

  it("le cliquet porte sur une IDENTITÉ — un chemin —, jamais sur une coordonnée ni un total", () => {
    for (const clef of Object.keys(REGISTRE_PORTEURS)) {
      expect(clef).toMatch(/^src\/.+\.(ts|tsx)$/);
      expect(clef).not.toMatch(/:\d+|#\d+/); // pas de ligne, pas d'ancre
    }
  });

  it("chaque porteur découvert nomme le moteur qui imprime réellement son identité", () => {
    for (const p of decouvrirPorteurs(corpus)) {
      expect(p.imprimeur, `${p.fichier} ne nomme aucun imprimeur`).toBeTruthy();
      expect(corpus.has(p.imprimeur)).toBe(true);
    }
  });

  /**
   * BUILD 13 · S3 — LES TROIS ROUTES NE SONT PLUS DES PORTEUSES.
   *
   * ██  C'est la SEULE assertion du lot qui dit que le travail a eu lieu.  ██
   *
   * Elle est posée depuis la DÉCOUVERTE, pas depuis le registre : une entrée
   * de registre qu'on aurait simplement réétiquetée « CONFORME » sans toucher
   * au code laisserait ce test rouge. C'est voulu — le registre déclare, la
   * découverte constate, et c'est la découverte qui a raison.
   */
  it("les trois routes de la fenêtre S3 ne sont PLUS découvertes comme porteuses", () => {
    const trouves = decouvrirPorteurs(corpus).map((p) => p.fichier);
    for (const route of [
      "src/app/api/pdf/casefile/route.ts",
      "src/app/api/report/v2/route.ts",
      "src/app/api/casefile/generate/route.ts",
    ]) {
      expect(corpus.has(route), `${route} a disparu du dépôt`).toBe(true);
      expect(trouves, `${route} émet encore une identité non fondée`).not.toContain(route);
      expect(REGISTRE_PORTEURS[route].etat).toBe("CONFORME");
    }
  });

  /**
   * Et la garde n'est pas devenue aveugle en chemin : `codeSeul` retire les
   * commentaires, donc une route qui NOMME `case_meta.case_id` en prose n'est
   * plus comptée — mais une route qui l'ÉMET l'est toujours.
   */
  // ── LE CONTRÔLE QUI COMPTE — LES DEUX SENS, QUATRE FORMES DE PROSE ───────
  //
  // ██  Une garde corrigée pour ne plus crier au faux positif, et qui ne  ██
  // ██  crie plus du tout, est PIRE que celle qu'on remplace.             ██
  //
  // Le corpus est SYNTHÉTIQUE : démontrer qu'une garde attrape une violation
  // ne doit jamais exiger d'introduire la violation dans le dépôt.

  const MOTEUR = `export const r = (s) => \`<div>\${s.off_chain.case_id}</div>\`;`;

  /** Une ÉMISSION réelle : la route donne au moteur l'identité historique. */
  const EMET = `
      import { r } from "@/lib/moteur";
      export async function GET() {
        const scan = { off_chain: { case_id: caseFile.case_meta.case_id } };
        return new Response(r(scan), { headers: { "Content-Disposition": "attachment" } });
      }`;

  /** Les quatre façons de NOMMER `case_meta.case_id` sans l'émettre. */
  const PROSES: ReadonlyArray<readonly [string, string]> = [
    [
      "commentaire de ligne",
      `        // L'identité ne vient plus de case_meta.case_id : elle vient du ref.`,
    ],
    ["commentaire de FIN DE LIGNE", `        const _ = 1; // ancien : case_meta.case_id`],
    ["INTÉRIEUR de bloc sans \`*\` en tête", `        /* on n'émettait\n           case_meta.case_id\n        */`],
    ["bloc refermé en MILIEU de ligne", `        const _ = /* case_meta.case_id */ 1;`],
  ];

  const routeQuiNomme = (prose: string) => `
      import { r } from "@/lib/moteur";
      export async function GET() {
${prose}
        const scan = { off_chain: { case_id: dossier.ref } };
        return new Response(r(scan), { headers: { "Content-Disposition": "attachment" } });
      }`;

  const corpusAvec = (route: string) =>
    new Map([
      ["src/lib/moteur.ts", MOTEUR],
      ["src/app/api/a/route.ts", route],
    ]);

  it("SENS 1 — une ÉMISSION réelle est DÉCOUVERTE. La garde mord.", () => {
    expect(decouvrirPorteurs(corpusAvec(EMET)).map((p) => p.fichier)).toEqual([
      "src/app/api/a/route.ts",
    ]);
  });

  for (const [nom, prose] of PROSES) {
    it(`SENS 2 — ${nom} : la route NOMME sans émettre, elle reste VERTE`, () => {
      expect(decouvrirPorteurs(corpusAvec(routeQuiNomme(prose)))).toEqual([]);
    });
  }

  /**
   * Et la correction n'est pas cosmétique : le dépouillement LIGNE À LIGNE,
   * l'idiome historique, laisse passer trois de ces quatre formes. Cette
   * assertion mesure le gain — et rougira si le dépouillement régresse vers
   * lui.
   */
  it("le dépouillement ligne à ligne laisse passer trois des quatre formes — la mesure du gain", () => {
    const echappent = PROSES.filter(([, prose]) =>
      IDENTITE_NON_FONDEE.test(codeSeulLigneALigne(routeQuiNomme(prose))),
    ).map(([nom]) => nom);
    expect(echappent).toEqual(PROSES.slice(1).map(([nom]) => nom));
  });

  /**
   * Le contrôle du contrôle : une émission qui, elle, ne doit JAMAIS être
   * dépouillée — l'identité est dans une CHAÎNE, pas dans un commentaire.
   */
  it("SENS 1 bis — une émission portée par une CHAÎNE reste découverte", () => {
    const PAR_CHAINE = `
      import { r } from "@/lib/moteur";
      export async function GET() {
        const scan = JSON.parse('{"x":1}');
        scan.off_chain = { case_id: caseFile.case_meta.case_id };
        return new Response(r(scan), { headers: { "Content-Disposition": "attachment" } });
      }`;
    expect(decouvrirPorteurs(corpusAvec(PAR_CHAINE)).map((p) => p.fichier)).toEqual([
      "src/app/api/a/route.ts",
    ]);
  });
});
