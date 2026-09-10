/**
 * __tests__/casefile/rc3-capacite-creation.test.ts
 *
 * RC-3 — AUCUNE CAPACITÉ DE CRÉATION HORS DE LA FRONTIÈRE GOUVERNÉE.
 *
 * ██  Ce n'est PAS un allocateur. La primitive n'invente aucun ref.  ██
 *
 * Il n'existe aujourd'hui aucun chemin de création de dossier en production :
 * dans `src/`, `tokenCaseFile` n'apparaît que sous `findUnique` et `findMany`.
 * La règle porte donc sur le chemin QUI N'EXISTE PAS ENCORE. Elle s'écrit comme
 * une garde qui MORD si un tel chemin apparaît sans elle.
 *
 * ─── LE CONTRÔLE NÉGATIF EST OBLIGATOIRE ────────────────────────────────────
 *
 * Une garde « aucune création nulle part » est satisfaite par le dépôt
 * d'aujourd'hui, où aucun écrivain n'existe. Elle serait VERTE sans rien
 * prouver, et resterait verte en vidant la frontière de son contenu : c'est une
 * garde satisfiable en la vidant. Deux assertions sont donc exigées, et aucune
 * ne suffit seule :
 *
 *   MUTANT           une création APPARAÎT hors frontière        → doit être ROUGE
 *   CONTRÔLE NÉGATIF la MÊME création, routée par `assignRef`    → doit rester VERTE
 *
 * Sans la seconde, la garde ne mesure pas la frontière : elle mesure l'absence.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const RACINE = path.resolve(__dirname, "../..");

/** Entrées de migration historiques — voir rc2-ref-immuable.test.ts. */
const ENTREES_MIGRATION_DECLAREES: readonly string[] = [
  "scripts/casefile/generate-migration-sql.mjs",
];

/** Le seul fichier autorisé à PORTER la frontière (il ne la traverse pas). */
const FRONTIERE = "src/lib/casefile/ref.ts";

const AUTORITE = "tokenCaseFile";
const TABLE = "token_casefiles";

export interface Creation {
  readonly fichier: string;
  readonly capacite: string;
  readonly routee: boolean;
}

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

/**
 * Recense toute CAPACITÉ DE CRÉATION sur l'autorité, et dit si elle est routée.
 *
 * `upsert` compte comme création : sa branche `create` en est une.
 * Le SQL brut compte aussi — une frontière que l'on contourne en changeant de
 * langage n'est pas une frontière.
 */
export function scannerRC3(src: string, fichier: string): Creation[] {
  const trouvees: Creation[] = [];

  const rePrisma = new RegExp(`${AUTORITE}\\s*\\.\\s*(create|createMany|upsert)\\s*\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = rePrisma.exec(src)) !== null) {
    const arg = argumentDe(src, m.index + m[0].length - 1);
    trouvees.push({
      fichier,
      capacite: `prisma.${AUTORITE}.${m[1]}`,
      routee: /\bassignRef\s*\(/.test(arg),
    });
  }

  const reSql = new RegExp(`INSERT\\s+INTO\\s+"?${TABLE}"?`, "gi");
  while ((m = reSql.exec(src)) !== null) {
    trouvees.push({ fichier, capacite: `INSERT INTO ${TABLE}`, routee: false });
  }

  return trouvees;
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const MUTANT_CREATION_HORS_FRONTIERE = `
  await prisma.tokenCaseFile.create({
    data: { ref: "IL-SHILL-NOUVEAU-001", codename: "NOUVEAU" },
  });
`;

const CONTROLE_NEGATIF_CREATION_ROUTEE = `
  await prisma.tokenCaseFile.create({
    data: assignRef({ ref: "IL-SHILL-NOUVEAU-001", codename: "NOUVEAU" }),
  });
`;

const MUTANT_CONTOURNEMENT_SQL = `
  await prisma.$executeRawUnsafe(\`INSERT INTO token_casefiles (ref) VALUES ('IL-X')\`);
`;

describe("RC-3 · le critère a des dents, ET il n'est pas satisfiable en le vidant", () => {
  it("MUTANT — une création hors frontière est vue", () => {
    const t = scannerRC3(MUTANT_CREATION_HORS_FRONTIERE, "fixture");
    expect(t).toHaveLength(1);
    expect(t[0].routee).toBe(false);
  });

  it("CONTRÔLE NÉGATIF — la MÊME création routée par `assignRef` reste verte", () => {
    const t = scannerRC3(CONTROLE_NEGATIF_CREATION_ROUTEE, "fixture");
    expect(t).toHaveLength(1);
    expect(t[0].routee).toBe(true);
  });

  it("le SQL brut ne contourne pas la frontière en changeant de langage", () => {
    const t = scannerRC3(MUTANT_CONTOURNEMENT_SQL, "fixture");
    expect(t).toHaveLength(1);
    expect(t[0].routee).toBe(false);
  });
});

describe("RC-3 · la propriété, sur le dépôt réel", () => {
  const fichiers = execSync(
    `git -C ${RACINE} ls-files '*.ts' '*.tsx' '*.mjs'`,
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter((f) => f && !f.startsWith("__tests__/"));

  it("toute capacité de création sur l'autorité passe par la frontière", () => {
    const horsFrontiere = fichiers
      .filter((f) => f !== FRONTIERE && !ENTREES_MIGRATION_DECLAREES.includes(f))
      .flatMap((f) => scannerRC3(readFileSync(path.join(RACINE, f), "utf8"), f))
      .filter((c) => !c.routee);
    expect(horsFrontiere).toEqual([]);
  });
});

describe("RC-3 · le siège de la frontière — `assignRef` n'alloue rien", () => {
  it("refuse une création qui ne FOURNIT pas de ref — aucun allocateur spéculatif", async () => {
    const { assignRef } = await import("@/lib/casefile/ref");
    expect(() => assignRef({ codename: "NOUVEAU" })).toThrow();
  });

  it("n'invente aucune forme `IL-${famille}` — la valeur rendue est celle fournie", async () => {
    const { assignRef } = await import("@/lib/casefile/ref");
    const sortie = assignRef({ ref: "IL-SHILL-NOUVEAU-001", codename: "N" });
    expect(sortie.ref).toBe("IL-SHILL-NOUVEAU-001");
  });

  it("refuse une seconde assignation sur la même charge — assignation UNE seule fois", async () => {
    const { assignRef } = await import("@/lib/casefile/ref");
    const une = assignRef({ ref: "IL-SHILL-NOUVEAU-001" });
    expect(() => assignRef(une)).toThrow();
  });
});
