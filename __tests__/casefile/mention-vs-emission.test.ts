/**
 * __tests__/casefile/mention-vs-emission.test.ts
 *
 * LE CRITÈRE DES GARDES QUI LISENT DU TEXTE — dans les DEUX sens.
 *
 * ██  Une garde corrigée pour ne plus crier au faux positif, et qui ne  ██
 * ██  crie plus du tout, est PIRE que celle qu'on remplace.             ██
 *
 * Ce fichier ne défend aucune surface du produit : il défend le DÉPOUILLEMENT
 * dont dépendent `rc-resolveur-citation` et `porteurs-artefact-univers`. Il
 * pose les deux sens, systématiquement :
 *
 *   PROSE   → doit DISPARAÎTRE  (sinon la garde survit à sa propre correction)
 *   CODE    → doit SURVIVRE     (sinon la garde devient aveugle en silence)
 *
 * Le témoin `codeSeulLigneALigne` est l'idiome historique du dépôt. Les
 * assertions qui l'opposent à `codeSeul` ne sont pas décoratives : ce sont
 * elles qui MESURENT ce que le durcissement gagne, forme par forme.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { codeSeul, codeSeulLigneALigne } from "./codeSeul";

const RACINE = path.resolve(__dirname, "../..");

// ── SENS 1 — LA PROSE DISPARAÎT ─────────────────────────────────────────────

/** Les quatre formes de prose, et le témoin qui en laisse passer trois. */
const FORMES_DE_PROSE: ReadonlyArray<{
  readonly nom: string;
  readonly src: string;
  /** Le dépouillement ligne à ligne l'attrape-t-il ? */
  readonly temoinLAttrape: boolean;
}> = [
  {
    nom: "commentaire de ligne, seul sur sa ligne",
    src: `// on n'émet plus case_meta.case_id\nconst x = 1;`,
    temoinLAttrape: true,
  },
  {
    nom: "bloc JSDoc, lignes préfixées par `*`",
    src: `/**\n * on n'émet plus case_meta.case_id\n */\nconst x = 1;`,
    temoinLAttrape: true,
  },
  {
    nom: "commentaire de FIN DE LIGNE",
    src: `const x = dossier.ref; // ancien : case_meta.case_id`,
    temoinLAttrape: false,
  },
  {
    nom: "INTÉRIEUR de bloc, sans `*` en tête",
    src: `/* on n'émet plus\n   case_meta.case_id ici\n*/\nconst x = 1;`,
    temoinLAttrape: false,
  },
  {
    nom: "bloc refermé en MILIEU de ligne",
    src: `const x = /* case_meta.case_id */ dossier.ref;`,
    temoinLAttrape: false,
  },
];

describe("mention · la prose disparaît, et le témoin montre ce que ça gagne", () => {
  for (const f of FORMES_DE_PROSE) {
    it(`${f.nom} — retirée par codeSeul`, () => {
      expect(codeSeul(f.src)).not.toContain("case_meta.case_id");
    });
  }

  it("TROIS des cinq formes échappent au dépouillement ligne à ligne — c'est la mesure du gain", () => {
    const echappees = FORMES_DE_PROSE.filter((f) =>
      codeSeulLigneALigne(f.src).includes("case_meta.case_id"),
    ).map((f) => f.nom);
    expect(echappees).toEqual(FORMES_DE_PROSE.filter((f) => !f.temoinLAttrape).map((f) => f.nom));
    expect(echappees.length).toBeGreaterThan(0);
  });
});

// ── SENS 2 — LE CODE SURVIT ─────────────────────────────────────────────────

/**
 * Chaque entrée porte du texte que le dépouillement DOIT rendre intact. Un
 * dépouillement qui efface l'une de ces formes rend muette la garde qui s'en
 * sert — c'est la panne que ce fichier existe pour interdire.
 */
const FORMES_DE_CODE: ReadonlyArray<readonly [string, string, string]> = [
  [
    "une URL dans une chaîne",
    `const u = "https://mainnet.example.com/?k=1"; const v = 2;`,
    "https://mainnet.example.com/?k=1",
  ],
  [
    "un gabarit qui imprime une identité",
    "const h = `<div>${scan.off_chain.case_id}</div>`;",
    "${scan.off_chain.case_id}",
  ],
  [
    "un littéral de motif contenant `//`",
    String.raw`const re = /https?:\/\//; const z = 3;`,
    String.raw`/https?:\/\//`,
  ],
  [
    "une balise JSX fermante",
    `return <div>{caseId}</div>;`,
    "</div>",
  ],
  [
    "une division",
    `const r = total / 2; const s = a / b;`,
    "total / 2",
  ],
  [
    "un en-tête de production d'artefact",
    `headers: { "Content-Disposition": 'attachment; filename="x.pdf"' },`,
    "Content-Disposition",
  ],
  [
    "une chaîne qui CONTIENT une séquence de commentaire",
    `const s = "// ceci n'est pas un commentaire";`,
    "// ceci n'est pas un commentaire",
  ],
];

describe("émission · le code survit — la garde ne devient pas aveugle", () => {
  for (const [nom, src, attendu] of FORMES_DE_CODE) {
    it(`${nom} — conservée`, () => {
      expect(codeSeul(src)).toContain(attendu);
    });
  }

  it("CONTRÔLE NÉGATIF — un dépouillement qui efface tout échoue au critère", () => {
    const effaceTout = () => "";
    const survivants = FORMES_DE_CODE.filter(([, src, attendu]) =>
      effaceTout().includes(attendu) ? true : false,
    );
    expect(survivants).toEqual([]);
    // …et `codeSeul`, lui, les garde toutes.
    expect(FORMES_DE_CODE.filter(([, src, attendu]) => !codeSeul(src).includes(attendu))).toEqual(
      [],
    );
  });

  it("la ligne est préservée — autant de lignes en sortie qu'en entrée", () => {
    const src = `const a = 1; // x\n/* y\n   z */\nconst b = 2;`;
    expect(codeSeul(src).split("\n").length).toBe(src.split("\n").length);
  });
});

// ── LA PROPRIÉTÉ, SUR LE DÉPÔT RÉEL ────────────────────────────────────────

describe("dépôt réel · le dépouillement ne retire QUE du commentaire", () => {
  const fichiers = execSync(`git -C ${RACINE} ls-files 'src/**/*.ts' 'src/**/*.tsx'`, {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);

  it("le dépôt est bien lu — le corpus n'est pas vide", () => {
    expect(fichiers.length).toBeGreaterThan(100);
  });

  it("chaque ligne de sortie est une SOUS-SUITE de son entrée, et le compte de lignes est exact", () => {
    const fautes: string[] = [];
    for (const f of fichiers) {
      const brut = readFileSync(path.join(RACINE, f), "utf8");
      const sorti = codeSeul(brut);
      const a = brut.split("\n");
      const b = sorti.split("\n");
      if (a.length !== b.length) {
        fautes.push(`${f} : ${a.length} lignes → ${b.length}`);
        continue;
      }
      for (let i = 0; i < a.length; i++) {
        if (!estSousSuite(b[i], a[i])) fautes.push(`${f}:${i + 1} n'est pas une sous-suite`);
      }
    }
    expect(fautes.slice(0, 10)).toEqual([]);
  });

  /**
   * L'ORACLE est une SECONDE implémentation, indépendante de l'analyseur : on
   * blanchit les blocs `/* … *\/` par expression régulière, en gardant les
   * sauts de ligne. Elle sert UNIQUEMENT à savoir quelles lignes sont hors
   * bloc — c'est un croisement, pas une copie de la logique testée.
   */
  const blanchirBlocs = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

  it("une ligne HORS bloc et sans `//` ressort IDENTIQUE — le dépouillement n'efface pas de code", () => {
    const fautes: string[] = [];
    for (const f of fichiers) {
      const brut = readFileSync(path.join(RACINE, f), "utf8");
      const a = brut.split("\n");
      const oracle = blanchirBlocs(brut).split("\n");
      const b = codeSeul(brut).split("\n");
      for (let i = 0; i < a.length && i < b.length; i++) {
        if (a[i].includes("//")) continue; // commentaire de fin de ligne : retrait attendu
        if (oracle[i] !== a[i]) continue; // ligne touchée par un bloc : retrait attendu
        if (a[i] !== b[i]) fautes.push(`${f}:${i + 1} :: ${JSON.stringify(a[i].slice(0, 60))}`);
      }
    }
    expect(fautes.slice(0, 10)).toEqual([]);
  });
});

function estSousSuite(petit: string, grand: string): boolean {
  let j = 0;
  for (const c of petit) {
    j = grand.indexOf(c, j);
    if (j === -1) return false;
    j++;
  }
  return true;
}
