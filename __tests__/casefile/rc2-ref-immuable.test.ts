/**
 * __tests__/casefile/rc2-ref-immuable.test.ts
 *
 * RC-2 — UNE MISE À JOUR ORDINAIRE NE PEUT PAS PORTER LE `ref`.
 *
 * ██  Aujourd'hui la stabilité du ref est une COÏNCIDENCE DE LITTÉRAL.  ██
 *
 * `prisma/seed-lab.ts:470` écrit `upsert({ where: { ref: REF }, create: data,
 * update: data })` où `data` contient `ref: REF` (ligne 372). Le ref ne bouge
 * pas parce que les deux littéraux sont égaux — pas parce que la colonne est
 * exclue de la charge. Changer le littéral du `where` sans changer celui de
 * `data`, ou l'inverse, réécrirait l'identité du dossier sans qu'aucune règle
 * ne s'y oppose.
 *
 * ─── POURQUOI LA RÈGLE EST POSITIVE, ET NON « la charge ne contient pas ref » ─
 *
 * Une règle négative — « le littéral d'update ne porte pas la clef `ref` » —
 * est satisfaite par `update: data`, où `data` est un identifiant opaque dont
 * le contenu n'est pas lisible au point d'appel. C'est exactement la forme du
 * défaut actuel. La règle est donc POSITIVE :
 *
 *     la branche de mise à jour DOIT être un appel à `withoutRef(...)`.
 *
 * Cette forme tue les deux mutants sans jamais comparer de valeur — et c'est
 * précisément ce qui distingue la propriété de la coïncidence :
 *
 *   MUTANT 1  `update: { ref: "IL-AUTRE", ... }`  (valeur ≠ celle du where)
 *   MUTANT 2  `update: { ref: REF, ... }`         (valeur = celle du where)
 *
 * Une garde qui ne tuerait que le mutant 1 aurait ré-encodé la coïncidence :
 * elle prouverait « le ref ne change pas », alors que la propriété demandée
 * est « le ref n'est pas dans la charge ». Les deux mutants sont donc assertés
 * ci-dessous, et ils doivent produire le MÊME verdict.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const RACINE = path.resolve(__dirname, "../..");

// ── Entrées de migration HISTORIQUES ────────────────────────────────────────
//
// Ratifié : « Historical migration literals may remain historical migration
// inputs. » Elles ne revendiquent aucune autorité à l'exécution — elles
// émettent le SQL qui a CRÉÉ les lignes, et ne peuvent donc pas lire ce
// qu'elles écrivent. La liste est DÉCLARÉE, jamais implicite : sa taille est
// assertée plus bas pour qu'une entrée ajoutée en silence soit visible.
const ENTREES_MIGRATION_DECLAREES: readonly string[] = [
  "scripts/casefile/generate-migration-sql.mjs",
];

// ── Le scanner ──────────────────────────────────────────────────────────────
//
// Fonction PURE sur du texte source : c'est ce qui permet de lui soumettre les
// mutants comme des fixtures, au lieu de décrire leur effet en prose.

const AUTORITE = "tokenCaseFile";

export interface Violation {
  readonly fichier: string;
  readonly operation: string;
  readonly branche: string;
}

/** Extrait le texte de l'argument d'un appel, à parenthèses équilibrées. */
function argumentDe(src: string, depuis: number): string {
  let profondeur = 0;
  for (let i = depuis; i < src.length; i++) {
    const c = src[i];
    if (c === "(") profondeur++;
    else if (c === ")") {
      profondeur--;
      if (profondeur === 0) return src.slice(depuis, i + 1);
    }
  }
  return src.slice(depuis);
}

/** Isole l'expression d'une branche `update:` / `data:` au premier niveau. */
function brancheDe(arg: string, nom: string): string | null {
  const re = new RegExp(`\\b${nom}\\s*:`, "g");
  const m = re.exec(arg);
  if (!m) return null;
  const depuis = m.index + m[0].length;
  let profondeur = 0;
  for (let i = depuis; i < arg.length; i++) {
    const c = arg[i];
    if (c === "{" || c === "(" || c === "[") profondeur++;
    else if (c === "}" || c === ")" || c === "]") {
      if (profondeur === 0) return arg.slice(depuis, i).trim();
      profondeur--;
    } else if (c === "," && profondeur === 0) {
      return arg.slice(depuis, i).trim();
    }
  }
  return arg.slice(depuis).trim();
}

export function scannerRC2(src: string, fichier: string): Violation[] {
  const violations: Violation[] = [];
  const re = new RegExp(`${AUTORITE}\\s*\\.\\s*(update|updateMany|upsert)\\s*\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const operation = m[1];
    const arg = argumentDe(src, m.index + m[0].length - 1);
    // `update` / `updateMany` portent leur charge sous `data:` ; `upsert` sous `update:`.
    const nom = operation === "upsert" ? "update" : "data";
    const branche = brancheDe(arg, nom);
    if (branche === null) continue;
    // LA RÈGLE, POSITIVE : la branche doit être construite par la primitive.
    if (!/^withoutRef\s*\(/.test(branche)) {
      violations.push({ fichier, operation, branche });
    }
  }
  return violations;
}

// ── Les fixtures : les mutants, soumis au scanner ───────────────────────────

const MUTANT_1_VALEUR_DIFFERENTE = `
  await prisma.tokenCaseFile.upsert({
    where: { ref: REF },
    create: data,
    update: { ref: "IL-AUTRE-999", title: "x" },
  });
`;

const MUTANT_2_VALEUR_IDENTIQUE = `
  await prisma.tokenCaseFile.upsert({
    where: { ref: REF },
    create: data,
    update: { ref: REF, title: "x" },
  });
`;

const MUTANT_3_CHARGE_OPAQUE = `
  await prisma.tokenCaseFile.upsert({
    where: { ref: REF },
    create: data,
    update: data,
  });
`;

const CONFORME = `
  await prisma.tokenCaseFile.upsert({
    where: { ref: REF },
    create: assignRef(data),
    update: withoutRef(data),
  });
`;

describe("RC-2 · le critère a des dents — les deux mutants meurent, et de la même mort", () => {
  it("MUTANT 1 — ref dans la charge avec une valeur DIFFÉRENTE du where : tué", () => {
    expect(scannerRC2(MUTANT_1_VALEUR_DIFFERENTE, "fixture")).toHaveLength(1);
  });

  it("MUTANT 2 — ref dans la charge avec une valeur IDENTIQUE au where : tué AUSSI", () => {
    expect(scannerRC2(MUTANT_2_VALEUR_IDENTIQUE, "fixture")).toHaveLength(1);
  });

  it("les deux mutants produisent le MÊME verdict — la garde ne compare aucune valeur", () => {
    const v1 = scannerRC2(MUTANT_1_VALEUR_DIFFERENTE, "f").map((v) => v.operation);
    const v2 = scannerRC2(MUTANT_2_VALEUR_IDENTIQUE, "f").map((v) => v.operation);
    expect(v1).toEqual(v2);
  });

  it("MUTANT 3 — charge opaque (`update: data`) : tué, sinon la règle négative suffirait", () => {
    expect(scannerRC2(MUTANT_3_CHARGE_OPAQUE, "fixture")).toHaveLength(1);
  });

  it("CONTRÔLE NÉGATIF — une charge construite par `withoutRef` reste verte", () => {
    expect(scannerRC2(CONFORME, "fixture")).toEqual([]);
  });
});

describe("RC-2 · la propriété, sur le dépôt réel", () => {
  const fichiers = execSync(
    `git -C ${RACINE} ls-files '*.ts' '*.tsx' '*.mjs'`,
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter((f) => f && !f.startsWith("__tests__/"));

  it("aucune mise à jour de l'autorité CaseFile ne porte de charge non filtrée", () => {
    const violations = fichiers
      .filter((f) => !ENTREES_MIGRATION_DECLAREES.includes(f))
      .flatMap((f) => scannerRC2(readFileSync(path.join(RACINE, f), "utf8"), f));
    expect(violations).toEqual([]);
  });

  it("la liste des entrées de migration déclarées ne grossit pas en silence", () => {
    expect(ENTREES_MIGRATION_DECLAREES).toEqual([
      "scripts/casefile/generate-migration-sql.mjs",
    ]);
  });
});

describe("RC-2 · le siège de la propriété — `withoutRef`", () => {
  it("retire la clef `ref`, quelle que soit sa valeur", async () => {
    const { withoutRef } = await import("@/lib/casefile/ref");
    const differente = withoutRef({ ref: "IL-AUTRE-999", title: "x" });
    const identique = withoutRef({ ref: "IL-PND-LAB-001", title: "x" });
    expect("ref" in differente).toBe(false);
    expect("ref" in identique).toBe(false);
    expect(differente).toEqual(identique);
  });

  it("ne touche à rien d'autre", async () => {
    const { withoutRef } = await import("@/lib/casefile/ref");
    expect(withoutRef({ ref: "IL-X", title: "t", tigerScore: 91 })).toEqual({
      title: "t",
      tigerScore: 91,
    });
  });

  it("accepte une charge qui ne porte pas de ref sans la modifier", async () => {
    const { withoutRef } = await import("@/lib/casefile/ref");
    expect(withoutRef({ title: "t" })).toEqual({ title: "t" });
  });
});
