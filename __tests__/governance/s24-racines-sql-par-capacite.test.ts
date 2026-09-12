// ─── BUILD 12 · S24 — LA RACINE GOUVERNÉE SE DÉCOUVRE, ELLE NE SE LISTE PAS ─
//
// ██  GOVERNED DATA ROOTS ARE DISCOVERED BY THE CAPABILITY TO READ THE      ██
// ██  GOVERNED PROPERTY, NOT BY MEMBERSHIP IN AN ORM SCHEMA.                ██
//
// LE DÉFAUT QUE CETTE GARDE EMPÊCHE DE REVENIR
//
// `KolProceedsEvent` et `KolProceedsSummary` existent en production et sont
// lues par le code livré. Aucun modèle Prisma ne les déclare. Une découverte
// qui part du schéma ne les voit pas — elles n'étaient pas hors PÉRIMÈTRE,
// elles étaient hors INVENTAIRE.
//
// La réponse de build12 avait été d'ajouter sept noms à la main. Mesuré :
// deux de ces sept n'étaient pas des tables (`CaseFileShiller`,
// `CaseFileSmokingGun` sont des types TypeScript), et six tables gouvernées
// réellement lues n'y figuraient pas. Une liste tenue à la main se trompe
// dans LES DEUX SENS à la fois.
//
// ─── CE QUE CE FICHIER PROUVE, ET OÙ ────────────────────────────────────
//
//   LES MUTANTS   sur CORPUS SYNTHÉTIQUE, jamais sur le disque. Un mécanisme
//                 prouvé sur un corpus qu'on contrôle est PROUVÉ.
//   LA GARDE      sur le dépôt. Elle MESURE le dépôt, ce qui est une autre
//                 question : elle rougit si une racine gouvernée découverte
//                 par capacité n'est pas déclarée.
//
// Aucune route touchée. Aucune classification d'audience. Aucune fenêtre.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  MECANISMES_SQL,
  decouvrirSitesSqlBruts,
  classerTablesAtteintes,
  verifierInventaire,
  lireModelesOrm,
  INVENTAIRE_RACINES_SQL,
} from "@/lib/governance/racinesSqlParCapacite";

// ═══════════════════════════════════════════════════════════════════════════
// CORPUS SYNTHÉTIQUE — le schéma ORM y déclare DEUX modèles, et deux seulement
// ═══════════════════════════════════════════════════════════════════════════

const SCHEMA_SYNTHETIQUE = `
model KolProfile {
  id     String @id
  handle String
}

model PriceCache {
  id     String @id
  symbol String
  @@map("price_cache")
}
`;

const MODELES_SYNTH = lireModelesOrm(SCHEMA_SYNTHETIQUE);

const analyser = (corpus: Record<string, string>) =>
  classerTablesAtteintes(decouvrirSitesSqlBruts(new Map(Object.entries(corpus))), MODELES_SYNTH);

const INVENTAIRE_SYNTH = {
  KolProfile: { statut: "RACINE_GOUVERNEE" as const, classe: "nominatif" as const },
  price_cache: {
    statut: "HORS_GOUVERNANCE" as const,
    raison: "donnée de marché ; aucun sujet identifié",
  },
};

describe("S24 · le mécanisme, sur corpus synthétique", () => {
  it("le corpus de référence est vert : tout ce qui est gouverné est déclaré", () => {
    const racines = analyser({
      "src/conforme.ts": `
        export async function lire() {
          return prisma.$queryRaw\`SELECT "handle" FROM "KolProfile" WHERE id = \${x}\`;
        }
        export async function prix() {
          return prisma.$queryRaw\`SELECT "symbol" FROM price_cache LIMIT 1\`;
        }`,
    });
    const v = verifierInventaire(racines, INVENTAIRE_SYNTH);
    expect(v.manquantes).toEqual([]);
    expect(v.sansRaison).toEqual([]);
  });

  // ── MUTANT 1 — LE MOTIF EXACT DE LA DETTE ────────────────────────────
  // Une table ABSENTE DU SCHÉMA, lue en SQL brut, portant une colonne
  // gouvernée. C'est `KolProceedsEvent` reproduit en laboratoire.
  it("MUTANT 1 — une table hors schéma lisant une propriété gouvernée ROUGIT", () => {
    const racines = analyser({
      "src/mutant1.ts": `
        export async function total(h: string) {
          return prisma.$queryRaw\`
            SELECT "kolHandle", "amountUsd" FROM "KolProceedsEvent" WHERE "kolHandle" = \${h}\`;
        }`,
    });
    const v = verifierInventaire(racines, INVENTAIRE_SYNTH);
    expect(v.manquantes.map((r) => r.table)).toContain("KolProceedsEvent");

    const trouvee = v.manquantes.find((r) => r.table === "KolProceedsEvent")!;
    expect(trouvee.modeleOrm).toBeNull();
    expect(trouvee.classe).toBe("proceeds");
  });

  // ── MUTANT 2 — LA CAPACITÉ, PAS LE VERBE ─────────────────────────────
  // Le même accès par un client SQL direct. Changer de mécanisme ne doit
  // pas faire disparaître la racine : ce qui compte est la capacité de lire
  // la propriété, pas le nom de la méthode qui la lit.
  it("MUTANT 2 — le même accès par un client SQL direct ROUGIT aussi", () => {
    const racines = analyser({
      "src/mutant2.ts": `
        export async function total(client: Client, h: string) {
          return client.query('SELECT "kolHandle", "amountUsd" FROM "KolProceedsSummary" WHERE "kolHandle" = $1', [h]);
        }`,
    });
    const v = verifierInventaire(racines, INVENTAIRE_SYNTH);
    expect(v.manquantes.map((r) => r.table)).toContain("KolProceedsSummary");
  });

  // ── MUTANT 3 — LA CLAUSE N'EST PAS TOUJOURS `FROM` ───────────────────
  // L'inventaire précédent ne regardait que `FROM`. Une table atteinte par
  // JOIN était invisible alors que la requête lit bel et bien ses colonnes.
  it("MUTANT 3 — une table atteinte par JOIN, et non par FROM, ROUGIT", () => {
    const racines = analyser({
      "src/mutant3.ts": `
        export async function q() {
          return prisma.$queryRawUnsafe(\`
            SELECT p."handle", r."previousValue"
              FROM "KolProfile" p
              JOIN "Retraction" r ON r."kolHandle" = p."handle"\`);
        }`,
    });
    const v = verifierInventaire(racines, INVENTAIRE_SYNTH);
    expect(v.manquantes.map((r) => r.table)).toContain("Retraction");
  });

  // ── MUTANT 4 — LA TABLE EST AU SCHÉMA, MAIS LUE EN BRUT ──────────────
  // Le point aveugle le plus profond : la découverte suivait la FORME DE
  // L'ACCESSEUR (`prisma.<modèle>.`). Un fichier qui ne parle que SQL n'était
  // pas une racine, même sur un modèle parfaitement déclaré.
  it("MUTANT 4 — un fichier qui ne touche un modèle gouverné QU'EN SQL est une racine", () => {
    const racines = analyser({
      "src/mutant4.ts": `
        export async function q(h: string) {
          return prisma.$queryRaw\`SELECT "handle", "displayName" FROM "KolProfile" WHERE handle = \${h}\`;
        }`,
    });
    const kol = racines.find((r) => r.table === "KolProfile")!;
    expect(kol).toBeDefined();
    expect(kol.classe).toBe("nominatif");
    expect(kol.reconnuePar).toBe("modèle");
    expect(kol.fichiers).toContain("src/mutant4.ts");
  });

  // ── MUTANT 5 — LE FAUX POSITIF QUI A FAILLI PASSER ───────────────────
  // Trouvé en vérifiant les racines qui surprenaient : une pièce en prose
  // passée en PARAMÈTRE LIÉ contenait « … from distributor B82pBSD4 ». Recoller
  // les littéraux de tous les arguments fabriquait une lecture d'une table
  // `distributor` qui n'a jamais existé. Seul le PREMIER argument est du SQL.
  it("MUTANT 5 — de la prose dans un paramètre lié ne fabrique PAS de racine", () => {
    const racines = analyser({
      "src/mutant5.ts": `
        export async function seed() {
          return prisma.$queryRawUnsafe(
            'UPDATE "KolProfile" SET notes = $1 WHERE handle = $2',
            '[VERIFIED] wallet received 300,000 BOTIFY from distributor B82pBSD4',
            'bkokoski',
          );
        }`,
    });
    expect(racines.map((r) => r.table)).not.toContain("distributor");
    expect(racines.map((r) => r.table)).toContain("KolProfile");
  });

  // ── MUTANT 6 — UNE TABLE ÉPHÉMÈRE N'EST PAS UNE RACINE ───────────────
  it("MUTANT 6 — une CTE ne compte pas pour une table", () => {
    const racines = analyser({
      "src/mutant6.ts": `
        export async function q() {
          return prisma.$queryRawUnsafe(\`
            WITH lot AS (SELECT id FROM "KolProfile" LIMIT 10)
            SELECT * FROM lot\`);
        }`,
    });
    expect(racines.map((r) => r.table)).not.toContain("lot");
    expect(racines.map((r) => r.table)).toContain("KolProfile");
  });

  // ── MUTANT 7 — UNE ENTRÉE QUI N'EST MÊME PAS UNE TABLE ───────────────
  // `CaseFileShiller` et `CaseFileSmokingGun` figuraient dans la liste tenue à
  // la main. Ce sont des types TypeScript. Une liste qui ne perd jamais rien
  // finit par affirmer l'existence de tables imaginaires.
  it("MUTANT 7 — une entrée d'inventaire que plus aucun site ne touche est signalée MORTE", () => {
    const racines = analyser({
      "src/vivant.ts": `export const q = () => prisma.$queryRaw\`SELECT "handle" FROM "KolProfile"\`;`,
    });
    const v = verifierInventaire(racines, {
      ...INVENTAIRE_SYNTH,
      CaseFileShiller: { statut: "RACINE_GOUVERNEE" as const, classe: "dossier" as const },
    });
    expect(v.mortes).toContain("CaseFileShiller");
  });

  // ── MUTANT 8 — UN SILENCE N'EST PAS UNE DÉCISION ─────────────────────
  it("MUTANT 8 — une exclusion sans raison ROUGIT", () => {
    const racines = analyser({
      "src/m8.ts": `export const q = () => prisma.$queryRaw\`SELECT "symbol" FROM price_cache\`;`,
    });
    const v = verifierInventaire(racines, {
      ...INVENTAIRE_SYNTH,
      price_cache: { statut: "HORS_GOUVERNANCE" as const },
    });
    expect(v.sansRaison).toContain("price_cache");
  });

  it("le balayage énumère des VERBES, jamais des tables", () => {
    const source = readFileSync("src/lib/governance/racinesSqlParCapacite.ts", "utf8");
    const declaration = source.slice(
      source.indexOf("export const MECANISMES_SQL"),
      source.indexOf("export type AccesTable"),
    );
    for (const table of Object.keys(INVENTAIRE_RACINES_SQL)) {
      expect(declaration).not.toContain(table);
    }
    expect(MECANISMES_SQL.length).toBeGreaterThanOrEqual(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LA GARDE — sur le dépôt réel
// ═══════════════════════════════════════════════════════════════════════════

function corpusDuDepot(): Map<string, string> {
  const out = new Map<string, string>();
  const marcher = (d: string) => {
    let entrees;
    try {
      entrees = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entrees.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!/node_modules|\.next|\.git/.test(p)) marcher(p);
      } else if (/\.(tsx?|mjs|cjs|js)$/.test(p) && !/\.d\.ts$/.test(p)) {
        out.set(p, readFileSync(p, "utf8"));
      }
    }
  };
  for (const racine of ["src", "scripts", "prisma"]) marcher(racine);
  return out;
}

describe("S24 · la garde, sur le dépôt", () => {
  const racines = classerTablesAtteintes(
    decouvrirSitesSqlBruts(corpusDuDepot()),
    lireModelesOrm(readFileSync("prisma/schema.prod.prisma", "utf8")),
  );

  it("aucune racine gouvernée atteinte en SQL brut n'est hors inventaire", () => {
    const { manquantes } = verifierInventaire(racines);
    const detail = manquantes
      .map(
        (r) =>
          `  ${r.table} [${r.classe} · ${r.reconnuePar}` +
          `${r.colonneTemoin ? ` : ${r.colonneTemoin}` : ""}] — ${r.fichiers[0]}`,
      )
      .join("\n");
    expect(
      manquantes,
      `Racines gouvernées découvertes par capacité et ABSENTES de INVENTAIRE_RACINES_SQL :\n${detail}\n` +
        `Une racine ne s'ajoute pas parce qu'on l'a remarquée : déclarez-la, ou déclarez-la ` +
        `HORS_GOUVERNANCE AVEC SA RAISON.`,
    ).toEqual([]);
  });

  it("aucune exclusion n'est muette", () => {
    expect(verifierInventaire(racines).sansRaison).toEqual([]);
  });

  it("l'inventaire ne porte aucune entrée morte", () => {
    const { mortes } = verifierInventaire(racines);
    expect(
      mortes,
      `Entrées d'inventaire que plus aucun site de SQL brut ne touche : ${mortes.join(", ")}. ` +
        `Vérifiez que ce sont bien des TABLES — deux entrées de la liste précédente ` +
        `(CaseFileShiller, CaseFileSmokingGun) étaient des types TypeScript.`,
    ).toEqual([]);
  });

  it("les deux proceeds sont bien découvertes, et par la capacité", () => {
    for (const t of ["KolProceedsEvent", "KolProceedsSummary"]) {
      const r = racines.find((x) => x.table === t);
      expect(r, `${t} doit être découverte`).toBeDefined();
      expect(r!.modeleOrm, `${t} est absente du schéma ORM`).toBeNull();
      expect(r!.classe).toBe("proceeds");
      expect(r!.lectures).toBeGreaterThan(0);
    }
  });
});
