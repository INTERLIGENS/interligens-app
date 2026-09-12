// ─── P0 · DEUX PROPRIÉTÉS GOUVERNÉES, DEUX MUTANTS QUI COMPTENT ──────────
//
//   COLLECTION AUTHORITY    l'appartenance est une assertion
//   LLM INPUT ADMISSIBILITY un modèle n'est pas une frontière d'admissibilité

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  declarerCollection,
  projeterCollection,
} from "@/lib/governance/appartenance";
import {
  constaterDecision,
  estRefus,
  gouverner,
  type EnregistrementGouverne,
} from "@/lib/governance/uniteGouvernee";
import {
  entreeAdmissiblePourModele,
  fondationPossiblePour,
} from "@/lib/governance/admissibiliteModele";

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION AUTHORITY
// ═══════════════════════════════════════════════════════════════════════════

const decisionValide = () =>
  constaterDecision("KolProfile.publishStatus", "sujet", "published", true)!;

/** 107 membres IRRÉPROCHABLES — chacun porte sa propre décision. */
const cent_sept_membres: EnregistrementGouverne[] = Array.from({ length: 107 }, (_, i) => ({
  handle: gouverner("OBSERVATION", `membre_${i}`, decisionValide()),
  tier: gouverner("ASSERTION", "CRITICAL", decisionValide()),
}));

describe("COLLECTION AUTHORITY — l'appartenance est une assertion à part entière", () => {
  it("PRÉALABLE — les 107 membres sont bien gouvernés, un par un", () => {
    // Sans ce préalable, le mutant qui suit ne prouverait rien : on pourrait
    // croire que le refus vient d'un membre mal formé.
    expect(cent_sept_membres).toHaveLength(107);
    for (const m of cent_sept_membres) {
      expect(m.handle.fondeePar.referentiel).toBe("KolProfile.publishStatus");
      expect(m.tier.fondeePar.valeurConstatee).toBe("published");
    }
  });

  // ── ██ LE MUTANT QUI FONDE CE MODULE ██ ────────────────────────────────
  it("107 MEMBRES IRRÉPROCHABLES, ET LA COLLECTION EST QUAND MÊME REFUSÉE", () => {
    // « Une liste ne peut pas construire Watchlist<Member> en projetant
    //   individuellement 107 membres si l'appartenance à Watchlist est
    //   elle-même une assertion non autorisée. »
    //
    // C'est la Watchlist, exactement : figurer sous « UNDER ACTIVE
    // SURVEILLANCE » affirme quelque chose que la décision prise sur les
    // champs d'un membre ne fonde pas.
    const watchlist = declarerCollection("Watchlist", true, null);
    const r = projeterCollection(watchlist, cent_sept_membres);
    expect(estRefus(r)).toBe(true);
    if (estRefus(r)) expect(r.raison).toBe("APPARTENANCE_NON_AUTORISEE");
  });

  it("et le refus ne regarde PAS les membres — une liste VIDE rend le même refus", () => {
    // La propriété : la décision d'appartenance est examinée avant que les
    // membres ne soient seulement lus.
    const watchlist = declarerCollection("Watchlist", true, null);
    const vide = projeterCollection(watchlist, []);
    const pleine = projeterCollection(watchlist, cent_sept_membres);
    expect(vide).toEqual(pleine);
  });

  it("MUTATION DISCRIMINANTE — avec une décision d'appartenance, la même liste passe", () => {
    // Une garde qui refuserait toujours ne mesurerait rien.
    const autorisee = declarerCollection("DossiersPublies", true, decisionValide());
    const r = projeterCollection(autorisee, cent_sept_membres);
    expect(estRefus(r)).toBe(false);
    if (!estRefus(r)) {
      expect(r.collection).toBe("DossiersPublies");
      expect(r.membres).toHaveLength(107);
    }
  });

  it("une appartenance NON assertive sans décision ferme aussi — pas de fondation vide", () => {
    const r = projeterCollection(declarerCollection("Neutre", false, null), []);
    expect(estRefus(r)).toBe(true);
    if (estRefus(r)) expect(r.raison).toBe("AUCUNE_FONDATION_POSSIBLE");
  });

  it("LES DEUX AXES SONT INDÉPENDANTS — quatre combinaisons, quatre issues", () => {
    const d = decisionValide();
    const cas = [
      { nom: "assertive + fondée", a: declarerCollection("C", true, d), refuse: false },
      { nom: "assertive + non fondée", a: declarerCollection("C", true, null), refuse: true },
      { nom: "non assertive + fondée", a: declarerCollection("C", false, d), refuse: false },
      { nom: "non assertive + non fondée", a: declarerCollection("C", false, null), refuse: true },
    ] as const;
    for (const c of cas) {
      expect(estRefus(projeterCollection(c.a, cent_sept_membres)), c.nom).toBe(c.refuse);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LLM INPUT ADMISSIBILITY
// ═══════════════════════════════════════════════════════════════════════════

describe("LLM INPUT ADMISSIBILITY — le guard est en ENTRÉE, et il le reste", () => {
  it("TÉMOIN POSITIF — `KolCase.evidence` n'a AUCUNE fondation possible", () => {
    // Ce n'est pas une politique, c'est une mesure : `KolCase` ne porte ni
    // `publishStatus`, ni `visibility`, ni `isPublic`. Aucune des cinq
    // décisions du référentiel ne s'y applique.
    expect(fondationPossiblePour("KolCase.evidence")).toBeNull();
    // Et le contre-témoin : un chemin qui, LUI, a une fondation.
    expect(fondationPossiblePour("KolProfile.tier")).toBe("KolProfile.publishStatus");
  });

  it("le contenu réellement mesuré dans le prompt est REFUSÉ", () => {
    // Verbatim des quatre dossiers `KolCase` servis, mesurés en base.
    const verbatim = [
      "GHOST overlap with BK/SAM cluster. Under investigation.",
      "GHOST overlap — cross-ref @lynk0x ongoing.",
      "Promotion alongside @bkokoski during BOTIFY active period.",
      "12+ confirmed rug-linked promotions. Source: mariaqueennft Feb 2026.",
      "Master controller qiwu.eth … ZachXBT investigation APR 18 2026.",
    ];
    for (const brut of verbatim) {
      expect(entreeAdmissiblePourModele("KolCase.evidence", "CASE-1", brut, "published")).toBeUndefined();
    }
  });

  it("le refus est `undefined` — PAS une chaîne de remplacement", () => {
    // « [redacted] » serait un différentiel : ça dirait qu'il y avait quelque
    // chose. Le champ doit DISPARAÎTRE du pack, pas changer de valeur.
    const r = entreeAdmissiblePourModele("KolCase.evidence", "CASE-1", "n'importe quoi", "published");
    expect(r).toBeUndefined();
    expect(JSON.stringify({ summary: r })).toBe("{}");
  });

  it("MUTATION DISCRIMINANTE — un chemin FONDÉ passe, avec sa décision", () => {
    const r = entreeAdmissiblePourModele("KolProfile.tier", "bkokoski", "CRITICAL", "published");
    expect(r).toBeDefined();
    expect(r?.valeur).toBe("CRITICAL");
    expect(r?.fondeePar.referentiel).toBe("KolProfile.publishStatus");
    expect(r?.fondeePar.sujet).toBe("bkokoski");
  });

  it("et un chemin fondé SANS valeur de publication lue est refusé", () => {
    // Fail-closed : une décision qu'on n'a pas lue n'est pas une décision.
    expect(entreeAdmissiblePourModele("KolProfile.tier", "trade", "CRITICAL", null)).toBeUndefined();
  });

  it("LE PACK NE PORTE PLUS `c.evidence` — le câblage est dans le code", () => {
    const code = readFileSync("src/lib/vault/buildCaseIntelligencePack.ts", "utf8")
      .split("\n")
      .filter((l) => {
        const x = l.trimStart();
        return !x.startsWith("//") && !x.startsWith("*") && !x.startsWith("/*");
      })
      .join("\n");
    expect(code).not.toContain("summary: c.evidence");
    expect(code).toContain("entreeAdmissiblePourModele");
  });

  it("LE GUARD DE SORTIE N'EST PAS CONSTRUIT ICI, ET C'EST DÉCLARÉ", () => {
    // « Après le modèle, un output guard reste nécessaire — mais il NE
    //   REMPLACE JAMAIS l'input guard. Ne construis pas l'un en croyant faire
    //   l'autre. » Cette assertion existe pour qu'on ne puisse pas croire que
    //   ce lot a fait les deux.
    const doc = readFileSync("src/lib/governance/admissibiliteModele.ts", "utf8");
    expect(doc).toContain("NE REMPLACE JAMAIS");
    expect(doc).toContain("ATTESTEE, jamais RESTREINTE");
  });
});
