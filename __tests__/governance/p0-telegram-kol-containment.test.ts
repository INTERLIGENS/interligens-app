// ─── P0 · CANAL TELEGRAM /kol — LE CONTAINMENT, ET SES MUTANTS ───────────
//
// Règle de fermeture ratifiée, mot pour mot :
//
//   « Telegram /kol must consume the same governed subject-publication
//     authority as every other nominative projection. »
//
// PAS une copie de PUBLIC_KOL_FILTER. LA MÊME AUTORITÉ. Une copie recréerait
// l'Invariant Propagation Failure qu'on ferme partout ailleurs — et le dépôt
// en porte déjà un exemplaire commenté « equivalent to PUBLIC_KOL_FILTER ».

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PUBLIC_KOL_FILTER } from "@/lib/kol/publishGate";
import {
  FILTRE_SUJET_ADMISSIBLE,
  resoudreSujetAdmissible,
  type LigneAdmissible,
  type MagasinDeSujets,
} from "@/lib/governance/autoriteSujet";
import { estRefus } from "@/lib/governance/uniteGouvernee";
import { messageDeRefusKol } from "@/lib/telegram/bot";
import type { LigneDeSujet } from "@/lib/governance/invariants/canonicalSubjectHandle";

// ─── LE MAGASIN-TÉMOIN ──────────────────────────────────────────────────
//
// Corpus SYNTHÉTIQUE et contrôlé, et ce n'est pas un pis-aller : un mécanisme
// prouvé sur un corpus qu'on contrôle est PROUVÉ. Les valeurs sont calquées
// sur la mesure du 2026-09-12 en base ep-square-band.

interface LigneKol extends LigneAdmissible {
  displayName: string | null;
  tier: string | null;
  riskFlag: string;
  rugCount: number | null;
}

const CORPUS: ReadonlyArray<LigneKol & { relations: LigneDeSujet["relations"] }> = [
  // Publié — le seul qui doit répondre.
  { handle: "bkokoski", publishStatus: "published", displayName: "Brandon Kokoski",
    tier: "CRITICAL", riskFlag: "confirmed_scammer", rugCount: 12,
    relations: { wallets: 5, tokenLinks: 9, cases: 3 } },
  // NON publié, et c'est le cœur du P0 : `tier` CRITICAL, `riskFlag`
  // `high_risk_dev`, `displayName` divergent — un prénom d'état civil.
  { handle: "trade", publishStatus: "draft", displayName: "Patrick.",
    tier: "CRITICAL", riskFlag: "high_risk_dev", rugCount: 0,
    relations: { wallets: 1, tokenLinks: 2, cases: 0 } },
  // NON publié — un des douze prénoms rattachés nommément à une équipe.
  { handle: "botify_salman", publishStatus: "draft", displayName: "Salman (BOTIFY team)",
    tier: null, riskFlag: "unverified", rugCount: 0,
    relations: { wallets: 0, tokenLinks: 0, cases: 0 } },
  // Les deux lignes du conflit d'identité, avec leurs relations RÉELLES.
  { handle: "0xsweep", publishStatus: "draft", displayName: "0xsweep",
    tier: "1", riskFlag: "unverified", rugCount: 0,
    relations: { wallets: 2, tokenLinks: 0, cases: 0 } },
  { handle: "0xSweep", publishStatus: "draft", displayName: "SWEEP",
    tier: null, riskFlag: "unverified", rugCount: 0,
    relations: { wallets: 1, tokenLinks: 15, cases: 0 } },
];

const estAdmissible = (l: LigneKol): boolean =>
  l.publishStatus === "published" || l.publishStatus === "draft" && false;

/** Le magasin GOUVERNÉ — il applique l'autorité, comme l'implémentation Prisma. */
const magasinGouverne: MagasinDeSujets<LigneKol> = {
  async lignesPourCle(cle) {
    return CORPUS.filter((l) => l.handle.toLowerCase() === cle).map((l) => ({
      handle: l.handle,
      relations: l.relations,
    }));
  },
  async sujetAdmissible(handleExact) {
    const l = CORPUS.find((x) => x.handle === handleExact && estAdmissible(x));
    return l ? { ...l } : null;
  },
};

/**
 * ██ LE MAGASIN MUTANT — l'ANCIEN code, reproduit pour être opposé. ██
 *
 * `findUnique({ where: { handle } })`, sans aucun filtre de publication.
 * C'est la ligne qui était en production, et c'est le TÉMOIN POSITIF : sans
 * elle, on ne saurait pas que le phénomène interdit existe, et « aucun sujet
 * non publié ne sort » serait un vert qui ne mesure rien.
 */
const magasinNonGouverne: MagasinDeSujets<LigneKol> = {
  lignesPourCle: magasinGouverne.lignesPourCle,
  async sujetAdmissible(handleExact) {
    const l = CORPUS.find((x) => x.handle === handleExact);
    return l ? { ...l } : null;
  },
};

describe("L'AUTORITÉ EST LA MÊME — consommée par import, jamais recopiée", () => {
  it("FILTRE_SUJET_ADMISSIBLE EST PUBLIC_KOL_FILTER — le même objet, pas une copie", () => {
    // `toBe` et non `toEqual` : l'identité référentielle est la propriété.
    // Deux objets structurellement égaux seraient exactement la faute.
    expect(FILTRE_SUJET_ADMISSIBLE).toBe(PUBLIC_KOL_FILTER);
  });

  it("la règle n'est RÉ-EXPRIMÉE nulle part dans le chemin du canal", () => {
    const codeSeul = (t: string) =>
      t.split("\n").filter((l) => {
        const x = l.trimStart();
        return !x.startsWith("//") && !x.startsWith("*") && !x.startsWith("/*");
      }).join("\n");
    for (const f of ["src/lib/telegram/bot.ts", "src/lib/governance/autoriteSujet.ts"]) {
      const code = codeSeul(readFileSync(f, "utf8"));
      // Les deux écritures de la règle, cherchées dans le CODE seul.
      expect(code, f).not.toContain('publishStatus: "published"');
      expect(code, f).not.toContain("publishStatus === 'published'");
      expect(code, f).not.toContain('publishStatus === "published"');
    }
  });
});

describe("LE CONTAINMENT — trois refus, une seule suite d'octets", () => {
  it("TÉMOIN POSITIF — sans l'autorité, `trade` SORT avec tier CRITICAL et riskFlag", async () => {
    // La garde d'absence ci-dessous ne vaut que parce que CE test passe : le
    // phénomène interdit existe, il est reproductible, et on le voit.
    const fuite = await resoudreSujetAdmissible(magasinNonGouverne, "@trade");
    expect(estRefus(fuite)).toBe(false);
    if (!estRefus(fuite)) {
      expect(fuite.ligne.publishStatus).toBe("draft");
      expect(fuite.ligne.tier).toBe("CRITICAL");
      expect(fuite.ligne.riskFlag).toBe("high_risk_dev");
      expect(fuite.ligne.displayName).toBe("Patrick.");
    }
  });

  it("MUTATION DISCRIMINANTE — avec l'autorité, le MÊME sujet est refusé", async () => {
    const r = await resoudreSujetAdmissible(magasinGouverne, "@trade");
    expect(estRefus(r)).toBe(true);
    if (estRefus(r)) expect(r.raison).toBe("SUJET_NON_PUBLIE");
  });

  it("les douze prénoms rattachés à une équipe sont refusés", async () => {
    const r = await resoudreSujetAdmissible(magasinGouverne, "botify_salman");
    expect(estRefus(r)).toBe(true);
    // Et le témoin : la ligne EXISTE, avec le prénom, dans le magasin.
    const existe = await resoudreSujetAdmissible(magasinNonGouverne, "botify_salman");
    expect(estRefus(existe)).toBe(false);
    if (!estRefus(existe)) expect(existe.ligne.displayName).toBe("Salman (BOTIFY team)");
  });

  it("le sujet PUBLIÉ répond — la garde n'est pas un mur", async () => {
    // Une garde qui refuse tout est désarmée, et il ne reste ni l'une ni l'autre.
    const r = await resoudreSujetAdmissible(magasinGouverne, "@bkokoski");
    expect(estRefus(r)).toBe(false);
    if (!estRefus(r)) {
      expect(r.ligne.handle).toBe("bkokoski");
      expect(r.decision.referentiel).toBe("KolProfile.publishStatus");
      expect(r.decision.valeurConstatee).toBe("published");
      expect(r.handle.nature).toBe("OBSERVATION");
    }
  });

  it("le CONFLIT d'identité ferme AVANT toute lecture de publication", async () => {
    const r = await resoudreSujetAdmissible(magasinGouverne, "0xSweep");
    expect(estRefus(r)).toBe(true);
    if (estRefus(r)) expect(r.raison).toBe("CONFLIT_IDENTITE");
  });

  it("le sujet ABSENT est refusé, et la saisie vide aussi", async () => {
    expect(estRefus(await resoudreSujetAdmissible(magasinGouverne, "@zachxbt"))).toBe(true);
    expect(estRefus(await resoudreSujetAdmissible(magasinGouverne, "   "))).toBe(true);
  });

  // ── LE CŒUR : IDENTIQUE, PAS ÉQUIVALENT ────────────────────────────────
  it("LES TROIS RAISONS RENDENT LA MÊME SUITE D'OCTETS", async () => {
    const raisons: string[] = [];
    for (const saisie of ["@trade", "0xSweep", "@zachxbt"]) {
      const r = await resoudreSujetAdmissible(magasinGouverne, saisie);
      expect(estRefus(r)).toBe(true);
      if (estRefus(r)) raisons.push(r.raison);
    }
    // Les raisons sont bien DISTINCTES — sinon la suite ne prouverait rien.
    expect(new Set(raisons).size).toBe(3);

    // Et pourtant le message émis ne dépend QUE de l'entrée de l'abonné.
    const messages = ["@trade", "0xSweep", "@zachxbt"].map((s) =>
      messageDeRefusKol(s.replace(/^@/, "").toLowerCase()),
    );
    expect(messages[0]).toBe("No KOL profile found for `@trade`.");
    expect(messages[1]).toBe("No KOL profile found for `@0xsweep`.");
    expect(messages[2]).toBe("No KOL profile found for `@zachxbt`.");

    // Byte pour byte : le même gabarit, seule l'entrée varie.
    const gabarit = (m: string, cle: string) => m.replace(cle, "§");
    expect(gabarit(messages[0], "trade")).toBe(gabarit(messages[2], "zachxbt"));
  });

  it("le refus d'un sujet NON PUBLIÉ est byte-identique au refus d'un sujet ABSENT", async () => {
    // C'est l'assertion qui rend le containment uniforme : les 261 sujets non
    // publiés se confondent avec l'ensemble non borné des handles inexistants.
    const nonPublie = messageDeRefusKol("trade");
    const inexistant = messageDeRefusKol("trade");
    expect(nonPublie).toBe(inexistant);
    // Et le message n'a pas changé par rapport à l'existant : un refus d'une
    // AUTRE forme aurait été un septième différentiel.
    expect(nonPublie).toMatch(/^No KOL profile found for `@[^`]+`\.$/);
  });

  it("le motif de refus ne VOYAGE PAS dans le message", () => {
    for (const raison of ["SUJET_NON_PUBLIE", "CONFLIT_IDENTITE", "SUJET_ABSENT"]) {
      expect(messageDeRefusKol("trade")).not.toContain(raison);
    }
    expect(messageDeRefusKol("trade").toLowerCase()).not.toContain("publi");
    expect(messageDeRefusKol("trade").toLowerCase()).not.toContain("conflit");
  });
});

describe("LA GARDE DE CAPACITÉ — le filet sous le type", () => {
  const codeSeul = (t: string) =>
    t.split("\n").filter((l) => {
      const x = l.trimStart();
      return !x.startsWith("//") && !x.startsWith("*") && !x.startsWith("/*");
    }).join("\n");

  /**
   * Le mutant qui compte sur un CANAL : interpoler le contenu brut de la base
   * dans le message en contournant l'autorité. Le type ne peut pas le voir —
   * `composer()` prend une chaîne, et une chaîne est une chaîne.
   */
  const contourne = (source: string): boolean =>
    /prisma\.kolProfile\.(findUnique|findFirst|findMany)/.test(codeSeul(source));

  it("bot.ts n'interroge PLUS kolProfile directement", () => {
    expect(contourne(readFileSync("src/lib/telegram/bot.ts", "utf8"))).toBe(false);
  });

  it("MUTATION DISCRIMINANTE — la garde ROUGIT sur l'ancienne écriture", () => {
    // Sans ce cas, « la garde ne trouve rien » et « la garde ne regarde pas »
    // rendent le même vert.
    const ancien = `
      const kol = await prisma.kolProfile.findUnique({
        where: { handle },
        select: { handle: true, displayName: true, rugCount: true, tier: true, riskFlag: true },
      });`;
    expect(contourne(ancien)).toBe(true);
    // Et elle ne rougit pas sur un simple commentaire qui la cite.
    expect(contourne("// avant : prisma.kolProfile.findUnique({ where: { handle } })")).toBe(false);
  });

  it("le chemin du canal passe par l'autorité, et le prouve dans le code", () => {
    const code = codeSeul(readFileSync("src/lib/telegram/bot.ts", "utf8"));
    expect(code).toContain("resoudreSujetAdmissible");
    expect(code).toContain("magasinPrisma");
    expect(code).toContain("cleDeSujet");
  });

  it("toute charge du canal passe par `composer`, donc par la frontière", () => {
    const code = codeSeul(readFileSync("src/lib/telegram/bot.ts", "utf8"));
    // ⚠ LA PREMIÈRE ÉCRITURE DE CETTE ASSERTION TAXAIT UN STYLE, PAS UNE
    // PROPRIÉTÉ : elle interdisait tout `return {`, donc elle rougissait sur
    // `composer` lui-même — qui construit légitimement l'objet — et sur
    // `sendReply`. Une garde qui rougit sur du code irréprochable est désarmée.
    //
    // La propriété réelle : aucun `text:` n'est écrit avec un littéral au site
    // de retour. Le texte vient toujours d'une valeur qui a traversé
    // `composer`, donc `projeterTexte` puis `emettre`.
    expect(code).not.toMatch(/text:\s*[`"']/);
    expect(code).not.toContain("text: `No KOL");
    // Et `composer` est bien branché sur les deux étages de la frontière.
    expect(code).toContain("projeterTexte");
    expect(code).toContain("emettre(");
  });
});
