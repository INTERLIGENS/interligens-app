// ─── BUILD 8 / E2 — une seule vérité casefile ──────────────────────────────
//
// Validation T1 : /api/casefile acceptait le 43 caractères ET N'ACCEPTAIT QUE
// LUI. Le 44 canonique rendait GREEN/0, le 43 rendait RED/70 avec le récit
// retail complet. La clé qui n'existe dans aucune ligne portait le verdict.

import { describe, it, expect } from "vitest";
import {
  BOTIFY_MINT,
  BOTIFY_SYNTHETIC_ROUTE_KEY,
  casefileLookupKey,
  assertCanonicalKeys,
  SyntheticKeyAsMintError,
} from "@/lib/kol-memory/tokenIdentity";
import { MINT_TO_CASEFILE_PRESET, mintToCasefilePreset } from "@/lib/casefile/presets";
import { readFileSync } from "node:fs";

describe("BUILD 8 / E2 — la clé de lecture converge vers le canonique", () => {
  it("le mint canonique reste lui-même", () => {
    expect(casefileLookupKey(BOTIFY_MINT)).toBe(BOTIFY_MINT);
  });

  it("l'alias synthétique RÉSOUT vers le canonique — il n'est plus la clé", () => {
    expect(casefileLookupKey(BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe(BOTIFY_MINT);
  });

  it("les espaces d'habillage sont retirés", () => {
    expect(casefileLookupKey(`  ${BOTIFY_SYNTHETIC_ROUTE_KEY} `)).toBe(BOTIFY_MINT);
  });

  it("toute autre valeur passe INCHANGÉE — la carte décide, pas ce garde", () => {
    // Le contrat ne dit rien de la validité d'un mint en général : il ne
    // connaît que deux chaînes nommées.
    for (const v of ["So11111111111111111111111111111111111111112", "inconnu", "", null, undefined]) {
      expect(casefileLookupKey(v), String(v)).toBe((v ?? "").trim());
    }
  });
});

describe("BUILD 8 / E2 — aucune carte ne peut être clé sur l'alias", () => {
  it("`assertCanonicalKeys` laisse passer une carte saine", () => {
    expect(() => assertCanonicalKeys({ [BOTIFY_MINT]: "botify" }, "test")).not.toThrow();
  });

  it("MUTANT — reposer une entrée sur l'alias devient rouge", () => {
    expect(() =>
      assertCanonicalKeys({ [BOTIFY_SYNTHETIC_ROUTE_KEY]: "botify" }, "test"),
    ).toThrow(SyntheticKeyAsMintError);
  });
});

// ─── EXCLUSION DÉLIBÉRÉE — `src/lib/casefile/presets.ts` ───────────────────
//
// Cette carte a été RETIRÉE du périmètre E2 après mesure, et le test consigne
// pourquoi plutôt que de laisser l'exclusion sans trace.
//
// `MINT_TO_CASEFILE_PRESET` alimente `findCasefilePresetsByAddress`
// (src/lib/token-resolution/v3/sources/db.ts), dont le commentaire porte une
// position RATIFIÉE : « BOTIFY porte DEUX mints […] ils ne sont pas une
// coquille à corriger : on lit la table telle quelle, sans normaliser. »
//
// La recléer fait apparaître un candidat `casefile_preset` pour le mint
// canonique. Sous panne de provider, token-resolution v3 passait alors de
// AMBIGUOUS à RESOLVED — et 5 cas de ratified-doctrine.test.ts rougissaient.
//
// Ce n'est PAS l'autorité du verdict retail : cette carte sert la détection de
// PRÉSENCE DE RISQUE (PRE-BUY GUARD, surfaces admin/shadow). E2 vise le
// verdict retail, qui vit dans /api/casefile et /api/casefile/public. La
// toucher aurait modifié une doctrine ratifiée hors périmètre.
describe("BUILD 8 / E2 — l'exclusion de casefile/presets.ts est intentionnelle", () => {
  it("la carte de PRÉSENCE DE RISQUE reste sur l'alias, et c'est voulu", () => {
    expect(Object.keys(MINT_TO_CASEFILE_PRESET)).toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
    expect(Object.keys(MINT_TO_CASEFILE_PRESET)).not.toContain(BOTIFY_MINT);
  });

  it("token-resolution v3 lit donc la table INCHANGÉE — sa doctrine tient", () => {
    const db = readFileSync("src/lib/token-resolution/v3/sources/db.ts", "utf8");
    expect(db).toContain("mintToCasefilePreset");
    expect(db).toContain("sans normaliser");
  });

  it("et le canonique n'y ouvre RIEN — l'écart est nommé, pas masqué", () => {
    // Consigné au backlog : rapprocher cette carte demande un arbitrage sur
    // token-resolution v3, pas une correction d'identité.
    expect(mintToCasefilePreset(BOTIFY_MINT)).toBeNull();
    expect(mintToCasefilePreset(BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe("botify");
  });
});

describe("BUILD 8 / E2 — la carte caseDb, sur les deux copies vivantes", () => {
  it("src/lib/caseDb.ts et lib/caseDb.ts sont clé sur le canonique", () => {
    for (const p of ["src/lib/caseDb.ts", "lib/caseDb.ts"]) {
      const src = readFileSync(p, "utf8");
      expect(src, p).toContain("[BOTIFY_MINT]: \"botify.json\"");
      // L'alias ne doit plus apparaître comme clé littérale.
      const code = src.split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
      expect(code, p).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
      // Et la lecture passe par le contrat d'alias.
      expect(src, p).toContain("casefileLookupKey(mint)");
    }
  });
});

describe("BUILD 8 / E2 — l'interdiction doctrinale est tenue", () => {
  it("rien n'affirme que « 44 caractères = mint Solana valide »", () => {
    // Le correctif repose sur DEUX constantes nommées, pas sur une règle de
    // longueur. Un base58 de 44 caractères inconnu n'ouvre aucun dossier.
    const inconnu44 = "So1111111111111111111111111111111111111111ab";
    expect(inconnu44).toHaveLength(44);
    // Un base58 de 44 caractères inconnu traverse le contrat INCHANGÉ : il
    // n'est ni promu, ni reconnu, ni rejeté sur sa seule longueur.
    expect(casefileLookupKey(inconnu44)).toBe(inconnu44);
  });

  it("et le contrat ne connaît QUE les deux chaînes BOTIFY", () => {
    expect(casefileLookupKey(BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe(BOTIFY_MINT);
    // Une autre chaîne de 43 caractères n'est PAS traitée comme un alias.
    const autre43 = "So111111111111111111111111111111111111111ab";
    expect(autre43).toHaveLength(43);
    expect(casefileLookupKey(autre43)).toBe(autre43);
  });
});
