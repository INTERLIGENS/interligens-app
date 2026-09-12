// ─── LES DEUX INVARIANTS GOUVERNÉS — LEURS TESTS D'APPLICATION ───────────
//
// L'INVARIANT PORTE SA DÉFINITION. CE FICHIER L'AFFIRME.
//
// Aucune citation en prose libre : chaque bloc va chercher l'entrée du
// registre par son identifiant, et le dernier `describe` vérifie que le lien
// tient dans les DEUX sens — un invariant sans test d'application ne vaut
// rien, un test qui affirmerait un invariant absent du registre non plus.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  INVARIANTS_GOUVERNES,
  invariant,
  type IdentifiantInvariant,
} from "@/lib/governance/invariants/registry";
import {
  PROFONDEURS_DE_PREUVE,
  PROFONDEUR_INDECIDABLE,
  estProfondeurConnue,
  profondeurLaPlusForte,
  rangDeProfondeur,
} from "@/lib/governance/invariants/evidenceDepth";
import {
  cleDeSujet,
  resoudreIdentite,
  type LigneDeSujet,
} from "@/lib/governance/invariants/canonicalSubjectHandle";
import { deriveSolidity, solidityCopy } from "@/lib/case/snapshotSelectors";

// ═══════════════════════════════════════════════════════════════════════════
// EVIDENCE_DEPTH_DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

describe("EVIDENCE_DEPTH_DOMAIN — le domaine, son ordre, et son fail-closed", () => {
  it("le registre porte la définition, et elle interdit explicitement le repli", () => {
    const i = invariant("EVIDENCE_DEPTH_DOMAIN");
    expect(i.version).toBe(1);
    expect(i.definition).toContain("Aucun repli");
    expect(i.primitive).toBe("src/lib/governance/invariants/evidenceDepth.ts");
  });

  it("l'ordre sémantique est celui du domaine, strictement croissant", () => {
    const rangs = PROFONDEURS_DE_PREUVE.map((p) => rangDeProfondeur(p));
    expect(rangs).toEqual([0, 1, 2, 3, 4]);
    for (let k = 1; k < rangs.length; k++) {
      expect(rangs[k] as number).toBeGreaterThan(rangs[k - 1] as number);
    }
  });

  // ── LE PRÉALABLE : LE PHÉNOMÈNE INTERDIT EXISTE ─────────────────────────
  //
  // « An absence guard is probative only if it independently proves that the
  //   prohibited phenomenon exists in its controlled positive witness. »
  //
  // Le témoin : `deep` est une valeur RÉELLE, présente une fois en base, et
  // elle porte le dossier le mieux documenté du corpus. Elle n'est pas du
  // domaine. Si elle était du domaine, tout ce qui suit ne mesurerait rien.
  it("TÉMOIN POSITIF — `deep` existe, et il est HORS DOMAINE", () => {
    expect(estProfondeurConnue("deep")).toBe(false);
    expect(rangDeProfondeur("deep")).toBeNull();
    // Et le contre-témoin : une valeur du domaine, elle, a bien un rang.
    expect(estProfondeurConnue("comprehensive")).toBe(true);
    expect(rangDeProfondeur("comprehensive")).toBe(4);
  });

  it("hors domaine, le rang est `null` — JAMAIS 0, parce que 0 est `none`", () => {
    // C'est tout le bug en une assertion : `?? 0` rendait l'ignorance
    // indistinguable de la mesure la plus basse.
    expect(rangDeProfondeur("none")).toBe(0);
    expect(rangDeProfondeur("deep")).toBeNull();
    expect(rangDeProfondeur("deep")).not.toBe(rangDeProfondeur("none"));
  });

  it("l'agrégation FERME sur une seule valeur inconnue, et rend laquelle", () => {
    const ok = profondeurLaPlusForte(["weak", "strong", "none"]);
    expect(ok).toEqual({ ok: true, valeur: "strong" });

    const ferme = profondeurLaPlusForte(["weak", "deep", "comprehensive"]);
    expect(ferme.ok).toBe(false);
    if (!ferme.ok) expect(ferme.horsDomaine).toEqual(["deep"]);
  });

  it("MUTATION DISCRIMINANTE — un repli sur 0 rendrait `comprehensive`, la primitive rend un refus", () => {
    // Le mutant : l'ancienne écriture, reproduite ici pour être opposée.
    const ancienne = (depths: string[]): string => {
      const ORDRE: Record<string, number> = { none: 0, weak: 1, moderate: 2, strong: 3, comprehensive: 4 };
      const INVERSE = ["none", "weak", "moderate", "strong", "comprehensive"];
      let best = 0;
      for (const d of depths) best = Math.max(best, ORDRE[d] ?? 0);
      return INVERSE[best] ?? "none";
    };
    // Sur un dossier dont la SEULE profondeur est `deep`, l'ancienne rendait
    // `none` — une affirmation — là où la nouvelle refuse.
    expect(ancienne(["deep"])).toBe("none");
    expect(profondeurLaPlusForte(["deep"]).ok).toBe(false);
  });

  it("le marqueur d'indécidabilité est LUI-MÊME hors domaine — le refus se propage", () => {
    // S'il avait un rang, le `?? 0` serait revenu par la porte de la correction.
    expect(rangDeProfondeur(PROFONDEUR_INDECIDABLE)).toBeNull();
    expect(estProfondeurConnue(PROFONDEUR_INDECIDABLE)).toBe(false);
  });

  it("RAVE-DUMP — le verdict public n'est plus SIGNAL, il est INDÉCIDABLE", () => {
    // Le dossier réel : `evidenceDepth = 'deep'`, documentationStatus absent du
    // calcul. Avant : « SIGNAL — Early signal, partial evidence ».
    const dossier = {
      title: "RAVE-DUMP-APR2026",
      summary: null,
      linkedActors: [],
      linkedActorsCount: 0,
      proceedsObservedTotal: null,
      proceedsCoverage: "partial",
      evidenceDepth: "deep",
      strongestFlags: [],
      documentationStatus: "partial",
      multiLaunchRecurrence: false,
    };
    expect(deriveSolidity(dossier)).toBe("INDECIDABLE");
    expect(solidityCopy("INDECIDABLE", "en").line).toContain("not computed");
    expect(solidityCopy("INDECIDABLE", "fr").line).toContain("non calculé");

    // Et le contre-témoin : une profondeur du domaine décide toujours.
    expect(deriveSolidity({ ...dossier, evidenceDepth: "strong", documentationStatus: "documented" })).toBe("CONFIRMED");
  });

  it("LA SÉMANTIQUE NE VIT PLUS QU'À UN ENDROIT — les deux tables sont parties", () => {
    // Sans cette assertion, la primitive serait un TROISIÈME exemplaire.
    const explorer = readFileSync("src/lib/explorer/explorerItems.ts", "utf8");
    const selectors = readFileSync("src/lib/case/snapshotSelectors.ts", "utf8");
    const codeSeul = (t: string) =>
      t.split("\n").filter((l) => {
        const x = l.trimStart();
        return !x.startsWith("//") && !x.startsWith("*") && !x.startsWith("/*");
      }).join("\n");
    expect(codeSeul(explorer)).not.toContain("comprehensive: 4");
    expect(codeSeul(selectors)).not.toContain("comprehensive: 4");
    expect(codeSeul(explorer)).toContain("rangDeProfondeur");
    expect(codeSeul(selectors)).toContain("rangDeProfondeur");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL_SUBJECT_HANDLE
// ═══════════════════════════════════════════════════════════════════════════

const ligne = (handle: string, wallets = 0, tokenLinks = 0, cases = 0): LigneDeSujet => ({
  handle,
  relations: { wallets, tokenLinks, cases },
});

describe("CANONICAL_SUBJECT_HANDLE — clé déterministe, et aucune élection", () => {
  it("le registre porte la définition, et elle dit que la résolution FERME", () => {
    const i = invariant("CANONICAL_SUBJECT_HANDLE");
    expect(i.version).toBe(1);
    expect(i.definition).toContain("n'elit jamais");
    expect(i.raison).toContain("0xsweep");
  });

  it("la clé est déterministe et se calcule AVANT tout lookup", () => {
    for (const saisie of ["@GordonGekko", "gordongekko", "  GORDONGEKKO  ", "@@gordonGekko"]) {
      expect(cleDeSujet(saisie)).toBe("gordongekko");
    }
    // NFKC : deux saisies visuellement identiques, encodées différemment.
    expect(cleDeSujet("\uFF4B\uFF4F\uFF4C")).toBe("kol");
  });

  it("la clé ne DÉCIDE PAS la forme d'affichage — elle ne rend jamais un handle", () => {
    // Elle rend une clé de recherche. Que `0xSweep` s'affiche « 0xSweep » ou
    // « SWEEP » n'est pas une question que cet invariant tranche.
    const r = resoudreIdentite([ligne("0xSweep", 1, 15)]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ligne.handle).toBe("0xSweep"); // la forme STOCKÉE, pas la clé
  });

  // ── LE TÉMOIN POSITIF : le conflit existe vraiment, et il est réparti ────
  it("TÉMOIN POSITIF — le cas 0xsweep, avec ses relations réelles, FERME", () => {
    // Mesuré en base le 2026-09-12 :
    //   0xsweep : 2 wallets, 0 liens de tokens
    //   0xSweep : 1 wallet, 15 liens de tokens
    // Les deux portent des relations. Aucune élection n'est sans perte.
    const r = resoudreIdentite([ligne("0xsweep", 2, 0), ligne("0xSweep", 1, 15)]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motif).toBe("RELATIONS_REPARTIES");
      expect(r.candidates).toEqual(["0xsweep", "0xSweep"]);
    }
  });

  it("MUTATION DISCRIMINANTE — une élection par la casse rendrait une ligne, et perdrait l'autre", () => {
    const lignes = [ligne("0xsweep", 2, 0), ligne("0xSweep", 1, 15)];
    // Le mutant « lowercase wins » : il rend une ligne, donc il a l'air de
    // marcher, et il jette 15 liens de tokens.
    const lowercaseWins = lignes.find((l) => l.handle === l.handle.toLowerCase());
    expect(lowercaseWins?.relations.tokenLinks).toBe(0);
    // Le mutant inverse jette 2 wallets.
    const mixedWins = lignes.find((l) => l.handle !== l.handle.toLowerCase());
    expect(mixedWins?.relations.wallets).toBe(1);
    // L'invariant, lui, n'en rend aucune.
    expect(resoudreIdentite(lignes).ok).toBe(false);
  });

  it("une seule ligne se résout, zéro ligne est ABSENT", () => {
    const une = resoudreIdentite([ligne("bkokoski", 3, 4, 1)]);
    expect(une.ok).toBe(true);

    const zero = resoudreIdentite([]);
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.motif).toBe("ABSENT");
  });

  it("deux lignes SANS relation ferment aussi — décider serait décider l'affichage", () => {
    const r = resoudreIdentite([ligne("Alpha"), ligne("alpha")]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motif).toBe("FORME_INDECIDABLE");
  });

  it("L'INVARIANT PORTE SUR LA PROPRIÉTÉ, PAS SUR UNE LISTE DE HANDLES", () => {
    // Une écriture de production a touché `0xSweep` le 2026-09-12 à 06:00:54
    // UTC — job non mesuré. La population de conflits BOUGE. Un invariant qui
    // connaîtrait les handles d'aujourd'hui serait périmé au prochain cron.
    const jamaisVu = resoudreIdentite([ligne("handle_qui_n_existe_pas_encore", 1), ligne("Handle_Qui_N_Existe_Pas_Encore", 0, 3)]);
    expect(jamaisVu.ok).toBe(false);
    const source = readFileSync("src/lib/governance/invariants/canonicalSubjectHandle.ts", "utf8");
    const code = source.split("\n").filter((l) => {
      const x = l.trimStart();
      return !x.startsWith("//") && !x.startsWith("*") && !x.startsWith("/*");
    }).join("\n");
    // Aucun handle en dur dans le CODE de la primitive.
    expect(code).not.toContain("0xsweep");
    expect(code).not.toContain("0xSweep");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LE REGISTRE — le lien tient dans les deux sens
// ═══════════════════════════════════════════════════════════════════════════

describe("LE REGISTRE — deux entrées, pas une plateforme", () => {
  it("exactement DEUX invariants", () => {
    expect(INVARIANTS_GOUVERNES.map((i) => i.id).sort()).toEqual([
      "CANONICAL_SUBJECT_HANDLE",
      "EVIDENCE_DEPTH_DOMAIN",
    ]);
  });

  it("chaque invariant porte une définition, une raison MESURÉE, et au moins un test", () => {
    for (const i of INVARIANTS_GOUVERNES) {
      expect(i.definition.length, i.id).toBeGreaterThan(80);
      expect(i.raison.length, i.id).toBeGreaterThan(80);
      // La raison est une MESURE : elle porte des chiffres.
      expect(i.raison, i.id).toMatch(/[0-9]/);
      expect(i.testsDApplication.length, i.id).toBeGreaterThan(0);
      // Et le test nommé est CE fichier — le lien va dans les deux sens.
      expect(i.testsDApplication).toContain("__tests__/governance/invariants-gouvernes.test.ts");
    }
  });

  it("chaque primitive nommée EXISTE réellement sur le disque", () => {
    for (const i of INVARIANTS_GOUVERNES) {
      expect(() => readFileSync(i.primitive, "utf8"), i.primitive).not.toThrow();
    }
  });

  it("le registre FERME sur un identifiant inconnu — il ne rend pas un invariant vide", () => {
    expect(() => invariant("N_EXISTE_PAS" as IdentifiantInvariant)).toThrow(/inconnu/);
  });
});
