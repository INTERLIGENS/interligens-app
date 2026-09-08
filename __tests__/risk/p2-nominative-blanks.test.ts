// ─── BUILD 10 · P2 — LA FICHE NOMINATIVE NE MENT PLUS PAR OMISSION ─────────
//
// Règle ratifiée :
//
//   « Une surface qui nomme une personne ne doit JAMAIS transformer un échec
//     de collecte en absence de signal. »
//
// Et la règle d'instrumentation qui la sous-tend :
//
//   « Une mesure n'est valide que si le champ mesuré représente réellement le
//     phénomène annoncé. » — ne jamais inférer `empty result → no risk`.
//
// ─── Ce que ces tests doivent prouver ─────────────────────────────────────
//
// Que TROIS situations qui rendaient le même écran sont désormais
// distinguables — et qu'aucune des trois n'a été écrasée par les deux autres.
// D'où le mutant de SUR-CORRECTION : signaler une dégradation sur une absence
// RÉELLEMENT mesurée doit tuer un test. Un produit qui crie « panne » sur
// chaque section vide est aussi inutilisable qu'un produit qui se tait.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  classifyResponse,
  thrownState,
  isNonConstat,
  degradationFor,
  SECTION_STATES,
  NOMINATIVE_DENIED_CODE,
} from "@/lib/risk/sectionState";

const PAGES_KOL = [
  "src/app/en/kol/[handle]/page.tsx",
  "src/app/fr/kol/[handle]/page.tsx",
];

const codeSeul = (chemin: string): string =>
  readFileSync(chemin, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

// ═══ Les trois états sont distinguables ══════════════════════════════════

describe("P2 — succès vide, panne et rétention ne se ressemblent plus", () => {
  it("MUTANT — une charge vide sur réponse `ok` est une ABSENCE MESURÉE", () => {
    expect(classifyResponse(true, 200, { wallets: [] }, true)).toBe("MEASURED_EMPTY");
  });

  it("MUTANT — la MÊME charge vide sur un 500 est une PANNE", () => {
    // C'est le cœur de P2 : charge identique, verdict opposé, parce que le
    // statut dit si le vide porte sur la personne ou sur le transport.
    expect(classifyResponse(false, 500, { wallets: [] }, true)).toBe("PROVIDER_FAILURE");
  });

  it("MUTANT — un 401 nominatif est une RÉTENTION, pas une panne", () => {
    // Ranger un refus délibéré en incident ferait sonner une alarme là où le
    // produit fait exactement ce qu'on lui demande.
    expect(
      classifyResponse(false, 401, { code: NOMINATIVE_DENIED_CODE }, true),
    ).toBe("INTENTIONALLY_UNAVAILABLE");
  });

  it("le code de refus est reconnu même sans le statut 401", () => {
    expect(classifyResponse(false, 403, { code: NOMINATIVE_DENIED_CODE }, true))
      .toBe("INTENTIONALLY_UNAVAILABLE");
  });

  it("l'ordre des tests compte : le refus est examiné AVANT l'échec", () => {
    // Inverser rangerait tout 401 en PROVIDER_FAILURE.
    expect(classifyResponse(false, 401, null, true)).toBe("INTENTIONALLY_UNAVAILABLE");
    expect(classifyResponse(false, 401, null, true)).not.toBe("PROVIDER_FAILURE");
  });

  it("une charge NON vide sur réponse `ok` est mesurée", () => {
    expect(classifyResponse(true, 200, { wallets: ["0xabc"] }, false)).toBe("MEASURED");
  });

  it("un appel qui LÈVE est une panne — jamais une absence", () => {
    expect(thrownState()).toBe("PROVIDER_FAILURE");
    expect(thrownState()).not.toBe("MEASURED_EMPTY");
  });

  it("le vocabulaire des états est FERMÉ", () => {
    expect([...SECTION_STATES]).toEqual([
      "LOADING", "MEASURED", "MEASURED_EMPTY",
      "PROVIDER_FAILURE", "INTENTIONALLY_UNAVAILABLE",
    ]);
  });
});

// ═══ SUR-CORRECTION — une absence réelle n'est pas une dégradation ═══════

describe("P2 — le mutant de SUR-CORRECTION", () => {
  it("MUTANT — une absence MESURÉE ne produit AUCUNE dégradation", () => {
    // Si `MEASURED_EMPTY` remontait une dégradation, chaque section vide
    // crierait « panne », et le signal deviendrait inaudible. C'est la
    // symétrie du mutant de P0 : ne pas détruire une observation réelle en
    // fermant la coercition.
    expect(degradationFor("laundry", "MEASURED_EMPTY")).toBeNull();
    expect(isNonConstat("MEASURED_EMPTY")).toBe(false);
  });

  it("un résultat mesuré non vide non plus", () => {
    expect(degradationFor("cluster", "MEASURED")).toBeNull();
    expect(isNonConstat("MEASURED")).toBe(false);
  });

  it("les deux non-constats, eux, sont signalés — et distinctement", () => {
    expect(degradationFor("laundry", "PROVIDER_FAILURE")).toEqual({
      field: "laundry", reason: "PROVIDER_UNAVAILABLE",
    });
    expect(degradationFor("laundry", "INTENTIONALLY_UNAVAILABLE")).toEqual({
      field: "laundry", reason: "NOT_EVALUATED",
    });
    expect(isNonConstat("PROVIDER_FAILURE")).toBe(true);
    expect(isNonConstat("INTENTIONALLY_UNAVAILABLE")).toBe(true);
  });

  it("la dégradation nomme le CHAMP, jamais la valeur", () => {
    const d = degradationFor("transparency", "PROVIDER_FAILURE");
    expect(Object.keys(d!).sort()).toEqual(["field", "reason"]);
    expect(d!.field).toMatch(/^[A-Za-z_][A-Za-z0-9_.]*$/);
  });
});

// ═══ Les deux fiches sont recâblées ═════════════════════════════════════

describe("P2 — les cinq appels muets ont disparu des deux fiches", () => {
  it("MUTANT — plus aucun `.catch(() => {})` sur les cinq sections", () => {
    for (const p of PAGES_KOL) {
      const code = codeSeul(p);
      // Le seul `.catch(() => {})` toléré est celui du narratif secondaire,
      // qui n'est pas une section de la fiche mais un enrichissement.
      const muets = code.split(".catch(() => {})").length - 1;
      expect(muets, `${p} — catch muets restants`).toBeLessThanOrEqual(1);
    }
  });

  it("`r.ok` est enfin testé — c'est lui qui porte la distinction", () => {
    for (const p of PAGES_KOL) {
      expect(codeSeul(p), p).toContain("classifyResponse(r.ok, r.status, d,");
    }
  });

  it("les cinq sections sont suivies, nommément", () => {
    for (const p of PAGES_KOL) {
      const code = codeSeul(p);
      for (const champ of ["laundry", "cluster", "coordination", "transparency", "shill"]) {
        expect(code, `${p}/${champ}`).toContain(`appel('${champ}'`);
      }
    }
  });

  it("MUTANT — les deux fiches RENDENT le non-constat, elles ne le stockent pas", () => {
    // Mesurer la dégradation sans la montrer laisserait le blanc silencieux
    // intact : le lecteur verrait toujours la même page.
    for (const p of PAGES_KOL) {
      const src = readFileSync(p, "utf8");
      expect(src, p).toMatch(/SIGNAL NOT AVAILABLE|SIGNAL INDISPONIBLE/);
      expect(src, p).toContain("isNonConstat(sectionState[x.champ])");
    }
  });

  it("le rendu DISTINGUE la rétention de la panne", () => {
    for (const p of PAGES_KOL) {
      const src = readFileSync(p, "utf8");
      expect(src, p).toContain('sectionState[x.champ] === "INTENTIONALLY_UNAVAILABLE"');
    }
  });

  it("le texte refuse explicitement la conclusion sur la personne", () => {
    for (const p of PAGES_KOL) {
      const src = readFileSync(p, "utf8").replace(/\s+/g, " ");
      expect(src, p).toMatch(
        /not a finding about this person|pas un constat sur cette personne/,
      );
    }
  });
});
