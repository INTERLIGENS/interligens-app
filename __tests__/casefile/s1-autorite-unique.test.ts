// ─── S1 · PHASE A — LA RÈGLE N'EST ÉCRITE QU'À UN SEUL ENDROIT ─────────────
//
// « Je ne veux pas deux implémentations indépendantes de
//   publishStatus === published. »
//
// Ce témoin parcourt `src/` et, dans tout fichier qui touche un DOSSIER
// (`token_casefiles` / `platform_casefiles`, par Prisma, par SQL brut ou par
// le lecteur canonique), refuse toute comparaison directe de `publishStatus`
// et tout littéral `published`. La seule exception est la primitive.
//
// Il lit le CODE, pas les commentaires : un en-tête qui explique pourquoi la
// règle a été centralisée cite forcément la règle.
//
// Périmètre volontairement borné aux dossiers : `KolProfile.publishStatus`
// porte une autre règle (`publishGate.ts`, avec le repli `publishable`), qui
// n'est pas l'objet de S1.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CASEFILE_SURFACES } from "@/lib/casefile/surfaceRegistry";

const PRIMITIVE = "src/lib/casefile/publicationAuthority.ts";

function fichiersSource(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "__tests__" || e === "node_modules") continue;
      fichiersSource(p, out);
    } else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

function codeSeul(src: string): string {
  return src
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    // Un commentaire de FIN de ligne n'est pas du code non plus. `://` est
    // épargné : une URL dans une chaîne n'est pas un commentaire.
    .map((l) => l.replace(/(^|[^:\\])\/\/.*$/, "$1"))
    .join("\n");
}

/** Un fichier est « de dossier » s'il touche l'une des deux tables, par n'importe quelle voie. */
const MARQUEURS_DOSSIER = [
  /tokenCaseFile\./,
  /platformCaseFile\./,
  /token_casefiles/,
  /platform_casefiles/,
  /loadCanonicalCaseFile|loadPublicProjection/,
];

/** Les formes d'une règle réécrite. Chacune a son témoin positif plus bas. */
const REECRITURES: ReadonlyArray<readonly [string, RegExp]> = [
  ["comparaison directe", /publishStatus\s*(?:===|!==|==|!=)\s*["'`]/],
  ["filtre Prisma littéral", /publishStatus\s*:\s*["'`]/],
  ["filtre SQL littéral", /"publishStatus"\s*(?:=|<>|!=)\s*'/],
  ["littéral published", /["'`]published["'`]/],
];

describe("S1 — aucune surface de dossier ne réécrit la règle de publication", () => {
  const dossiers = fichiersSource("src").filter((f) => {
    const code = codeSeul(readFileSync(f, "utf8"));
    return MARQUEURS_DOSSIER.some((m) => m.test(code));
  });

  it("le périmètre scanné n'est pas vide et contient les surfaces publiques connues", () => {
    expect(dossiers.length).toBeGreaterThan(5);
    for (const s of CASEFILE_SURFACES.filter((s) => s.public)) {
      expect(dossiers, s.file).toContain(s.file);
    }
  });

  for (const [nom, re] of REECRITURES) {
    it(`${nom} : 0 occurrence hors de la primitive`, () => {
      const fautifs: string[] = [];
      for (const f of dossiers) {
        if (f === PRIMITIVE) continue;
        if (re.test(codeSeul(readFileSync(f, "utf8")))) fautifs.push(f);
      }
      expect(fautifs, `règle réécrite (${nom}) dans : ${fautifs.join(", ")}`).toEqual([]);
    });
  }

  it("la primitive porte le littéral exactement UNE fois, dans son code", () => {
    const code = codeSeul(readFileSync(PRIMITIVE, "utf8"));
    const n = (code.match(/["'`]published["'`]/g) ?? []).length;
    expect(n).toBe(1);
  });
});

describe("S1 — témoin positif : les détecteurs voient chaque forme de réécriture", () => {
  const CORPUS: ReadonlyArray<readonly [string, string]> = [
    ["comparaison directe", `if (r.publishStatus !== "published") return null;`],
    ["comparaison directe", `r.publishStatus === 'published'`],
    ["filtre Prisma littéral", `where: { publishStatus: "published" },`],
    ["filtre Prisma littéral", `where: { publishStatus: 'published' }`],
    ["filtre SQL littéral", `WHERE "publishStatus" = 'published'`],
    ["filtre SQL littéral", `AND c."publishStatus" = 'published'`],
    ["littéral published", `const x = "published";`],
  ];
  for (const [nom, extrait] of CORPUS) {
    it(`${nom} — vu`, () => {
      const re = REECRITURES.find(([n]) => n === nom)![1];
      expect(re.test(extrait)).toBe(true);
    });
  }

  it("la forme consommée n'est PAS vue comme une réécriture", () => {
    const legitimes = [
      `const d = decidePublication(r); if (d.decision !== "PUBLISHABLE") return null;`,
      `where: PUBLISHED_ONLY_WHERE,`,
      `keepPublishable(rows)`,
      `select: { publishStatus: true }`,
      `publishStatus: row.publishStatus,`,
    ];
    for (const l of legitimes) {
      for (const [nom, re] of REECRITURES) expect(re.test(l), `${nom} sur « ${l} »`).toBe(false);
    }
  });
});

// ─── La dette gelée, NOMMÉE ─────────────────────────────────────────────────
//
// Une surface publique qui projette un dossier doit passer par
// `loadPublicProjectionIfPublished`. Celles qui appellent encore
// `loadPublicProjection` sans autorité sont sous `^src/app/api/` — chemin gelé.
// Elles sont listées ICI pour que la liste ne puisse que RÉTRÉCIR : une
// nouvelle surface publique sans autorité rougit ; une surface gelée qui
// serait câblée dans une fenêtre doit être retirée de la liste, sinon le
// témoin rougit aussi (il exige que chaque entrée soit encore fautive).

const DETTE_GELEE_SANS_AUTORITE = ["src/app/api/casefile/public/route.ts"] as const;

describe("S1 — les surfaces publiques consomment l'autorité, sauf la dette gelée nommée", () => {
  const APPEL_SANS_AUTORITE = /\bloadPublicProjection\(/;

  for (const s of CASEFILE_SURFACES.filter((s) => s.public)) {
    it(`${s.file}`, () => {
      const code = codeSeul(readFileSync(s.file, "utf8"));
      const sansAutorite = APPEL_SANS_AUTORITE.test(code);
      const attendu = (DETTE_GELEE_SANS_AUTORITE as readonly string[]).includes(s.file);
      expect(sansAutorite, attendu ? "la dette gelée doit encore être fautive, ou sortir de la liste" : "surface publique sans autorité de publication").toBe(attendu);
    });
  }
});
