// ─── BUILD 10 · P3 — LA GARDE QUI EMPÊCHE UNE QUATRIÈME AUTORITÉ ───────────
//
// Le registre déclare les surfaces. Ce fichier REFUSE celles qui ne le sont
// pas.
//
// ─── Pourquoi cette garde, et pas une revue ───────────────────────────────
//
// La troisième autorité n'a pas échappé aux gates par négligence : elle a
// échappé parce qu'elle n'était dans AUCUNE carte. Une revue humaine ne trouve
// que ce qu'elle sait chercher ; un scan trouve ce que personne n'a déclaré.
//
// Si quelqu'un crée demain une page qui rend des claims de dossier sans la
// déclarer, ce test rougit — même si la page est parfaitement écrite, même si
// elle lit l'autorité canonique. Le point n'est pas qu'elle soit correcte,
// c'est qu'elle soit CONNUE.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CASEFILE_SURFACES,
  publicSurfaces,
  isDeclared,
  SURFACE_AUTHORITIES,
} from "@/lib/casefile/surfaceRegistry";

function fichiersSource(racine: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(racine)) {
    const p = join(racine, e);
    if (statSync(p).isDirectory()) out.push(...fichiersSource(p));
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

/**
 * Ce qui trahit une surface de dossier : une référence canonique, une lecture
 * de l'autorité, ou une lecture du JSON legacy.
 *
 * On ne cherche PAS « claim » ou « casefile » en général — trop de faux
 * positifs noieraient la garde, et une garde bruyante finit désactivée.
 */
const MARQUEURS: Array<{ motif: RegExp; quoi: string }> = [
  { motif: /IL-(?:PND|PON|SHILL|CONC)-[A-Z0-9]+-\d+/, quoi: "ref de dossier canonique" },
  { motif: /loadPublicProjection|loadCanonicalCaseFile|toInternalCaseView/, quoi: "lecteur canonique" },
  { motif: /data\/cases\/botify\.json|buildBotifyInput|buildVineInput/, quoi: "autorité legacy" },
  { motif: /tokenCaseFile\.|platformCaseFile\./, quoi: "table de dossier" },
];

describe("P3 — aucune surface CaseFile n'échappe au registre", () => {
  it("MUTANT — toute surface `src/app` qui touche un dossier est DÉCLARÉE", () => {
    const nonDeclarees: string[] = [];
    for (const f of fichiersSource("src/app")) {
      const src = readFileSync(f, "utf8");
      // Les commentaires ne comptent pas : un fichier qui MENTIONNE une ref
      // dans une note d'en-tête ne publie rien.
      const code = src
        .split("\n")
        .filter((l) => {
          const t = l.trimStart();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
        })
        .join("\n");
      const touche = MARQUEURS.some((m) => m.motif.test(code));
      if (touche && !isDeclared(f)) nonDeclarees.push(f);
    }
    expect(
      nonDeclarees,
      "surfaces non déclarées au registre — voir src/lib/casefile/surfaceRegistry.ts",
    ).toEqual([]);
  });

  it("toute surface déclarée EXISTE encore", () => {
    // Une entrée orpheline rend le registre faux dans l'autre sens.
    for (const s of CASEFILE_SURFACES) {
      expect(() => readFileSync(s.file, "utf8"), s.file).not.toThrow();
    }
  });

  it("les autorités déclarées appartiennent au vocabulaire fermé", () => {
    for (const s of CASEFILE_SURFACES) {
      expect(SURFACE_AUTHORITIES as readonly string[], s.file).toContain(s.authority);
    }
  });
});

describe("P3 — les surfaces PUBLIQUES lisent l'autorité canonique", () => {
  it("MUTANT — aucune surface publique ne déclare une autorité legacy", () => {
    for (const s of publicSurfaces()) {
      expect(s.authority, `${s.file} — surface publique sur autorité ${s.authority}`)
        .toBe("CANONICAL");
    }
  });

  it("et elles la lisent RÉELLEMENT — la déclaration ne suffit pas", () => {
    // Déclarer CANONICAL sans lire l'autorité ne tromperait que la prochaine
    // personne. On vérifie la lecture, pas l'intention.
    for (const s of publicSurfaces()) {
      const code = readFileSync(s.file, "utf8");
      expect(code, `${s.file} — déclarée CANONICAL sans lecteur canonique`).toMatch(
        /loadPublicProjection|loadCanonicalCaseFile|tokenCaseFile\.|platformCaseFile\./,
      );
    }
  });
});

// ═══ La troisième autorité, fermée ══════════════════════════════════════

describe("P3 — `/cases/botify/evidence` ne porte plus ses propres données", () => {
  const f = "src/app/en/cases/botify/evidence/page.tsx";
  const src = readFileSync(f, "utf8");
  const code = src
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

  it("MUTANT — plus aucun claim, wallet ou arête en dur", () => {
    expect(code).not.toMatch(/id: "C\d+"/);
    expect(code).not.toMatch(/\{ from: "/);
    expect(code).not.toContain("sybil1");
    expect(code).not.toContain("Raydium Pool");
  });

  it("MUTANT — aucun `CONFIRMED` écrit en dur", () => {
    // L'état d'un claim est porté par l'autorité. L'écrire ici serait
    // affirmer une publication que rien ne soutient.
    expect(code).not.toContain("CONFIRMED");
    expect(code).not.toContain("Confirmed");
    expect(code).toContain("{c.state}");
  });

  it("MUTANT — le mint synthétique a disparu", () => {
    // 43 caractères : `…UnZacja4…`. Le canonique en fait 44 : `…UnZacija4…`.
    expect(code).not.toContain("UnZacja4");
    expect(code).not.toContain("BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb");
  });

  it("MUTANT — le mot interdit par le contrat de wording a disparu", () => {
    expect(code).not.toContain("rug-pull");
    expect(code).not.toContain("rug_pull");
  });

  it("elle lit la projection canonique", () => {
    expect(code).toContain("loadPublicProjection(BOTIFY_CASEFILE_REF");
  });

  it("`tigerScore` NULL ne devient ni 0 ni « /100 »", () => {
    expect(code).toContain("dossier.tigerScore == null");
    expect(code).toContain("not established");
  });

  it("le graphe de wallets est RETIRÉ, avec sa raison nommée", () => {
    // `keyWallets` est vide sur BOTIFY, et c'est une valeur RATIFIÉE.
    // Reconstituer un graphe lui redonnerait une autorité locale.
    expect(code).toContain('champ="keyWallets"');
    expect(src).toContain("Reason: Insufficient provenance · Field:");
    expect(src.replace(/\s+/g, " ")).toContain("not a finding about the subject");
  });

  it("l'absence de claim publié est DITE, pas masquée", () => {
    expect(src.replace(/\s+/g, " ")).toContain("Absence of provenance is not a finding of falsity");
  });
});
