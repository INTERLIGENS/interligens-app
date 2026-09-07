// ─── BUILD 9 — les trois états, et le fait qu'aucun n'implique le suivant ──
//
// Le produit confondait trois questions dans un booléen. La mesure du
// 2026-09-07 montre ce que ça produit — deux corpus exactement inverses :
//
//     20 captures publiques : 0 sha256, 0 sourceUrl
//     50 captures VINE      : 50 sha256, 50 sourceUrl, 0 publique

import { describe, it, expect } from "vitest";
import {
  ARTIFACT_STATES,
  EXCLUSION_REASONS,
  isAttached,
  isAdmissible,
  isPublic,
  artifactState,
  whyNot,
  assertExclusionNoticeSafe,
  ExclusionLeakError,
} from "@/lib/casefile/publicationState";

const MINT = "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump";

/** Une des 20 : publiée, sans aucune provenance. */
const CAPTURE_PUBLIEE_SANS_PREUVE = {
  canonicalMint: null, sha256: null, sourceUrl: null,
  observedAt: new Date(), reviewStatus: "approved", isPublic: true,
};
/** Une des 50 : vérifiable, rattachée, non publiée. */
const CAPTURE_VINE = {
  canonicalMint: MINT, sha256: "a".repeat(64),
  sourceUrl: "https://x.com/…", observedAt: new Date(),
  reviewStatus: "approved", isPublic: false,
};

describe("BUILD 9 — les trois états sont distincts", () => {
  it("le vocabulaire est fermé et ordonné", () => {
    expect([...ARTIFACT_STATES]).toEqual(["ATTACHED", "ADMISSIBLE", "PUBLIC"]);
    expect([...EXCLUSION_REASONS]).toEqual([
      "EXCLUDED_FROM_PUBLICATION", "INSUFFICIENT_PROVENANCE",
    ]);
  });

  it("les 20 publiées ne sont même pas ATTACHED — elles n'ont pas de sujet", () => {
    expect(isAttached(CAPTURE_PUBLIEE_SANS_PREUVE)).toBe(false);
    expect(artifactState(CAPTURE_PUBLIEE_SANS_PREUVE)).toBeNull();
    // Le point qui compte : `isPublic = true` en base ne les rend PAS publiques
    // au sens du modèle. Publier n'est pas prouver.
    expect(isPublic(CAPTURE_PUBLIEE_SANS_PREUVE)).toBe(false);
  });

  it("les 50 VINE rattachées sont ADMISSIBLE mais PAS PUBLIC", () => {
    expect(isAttached(CAPTURE_VINE)).toBe(true);
    expect(isAdmissible(CAPTURE_VINE)).toBe(true);
    expect(isPublic(CAPTURE_VINE)).toBe(false);
    expect(artifactState(CAPTURE_VINE)).toBe("ADMISSIBLE");
  });

  it("rattacher n'est pas rendre admissible", () => {
    // Un sujet sans preuve d'intégrité s'arrête à ATTACHED.
    const a = { canonicalMint: MINT, sha256: null, sourceUrl: null, observedAt: null };
    expect(artifactState(a)).toBe("ATTACHED");
    expect(isAdmissible(a)).toBe(false);
  });

  it("MUTANT — une promotion silencieuse devient rouge", () => {
    for (const manquant of ["sha256", "sourceUrl", "observedAt"] as const) {
      const a = { ...CAPTURE_VINE, [manquant]: null, isPublic: true };
      expect(isPublic(a), manquant).toBe(false);
      expect(isAdmissible(a), manquant).toBe(false);
    }
  });

  it("`isPublic` est strict : ni `\"true\"`, ni `1`, ni undefined", () => {
    for (const v of ["true", 1, "1", undefined, null]) {
      expect(isPublic({ ...CAPTURE_VINE, isPublic: v }), String(v)).toBe(false);
    }
  });
});

describe("BUILD 9 — une exclusion nomme le CHAMP, jamais son contenu", () => {
  it("elle nomme le champ manquant", () => {
    expect(whyNot(CAPTURE_PUBLIEE_SANS_PREUVE, "PUBLIC")).toEqual({
      excluded: true, reason: "EXCLUDED_FROM_PUBLICATION", field: "canonicalMint",
    });
    expect(whyNot({ ...CAPTURE_VINE, sha256: null }, "ADMISSIBLE")).toEqual({
      excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "sha256",
    });
  });

  it("un artefact qui atteint l'état visé n'a pas d'avis", () => {
    expect(whyNot(CAPTURE_VINE, "ADMISSIBLE")).toBeNull();
  });

  it("MUTANT — un avis qui porte une VALEUR est refusé", () => {
    // Republier l'assertion pour expliquer son retrait annule le retrait.
    for (const mauvais of [
      { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "x", value: 604489 },
      { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "x", amountUsd: 1 },
      { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "x", claim: "…" },
      { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "montant 604489" },
      { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "604489" },
      { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "$604 489 USD" },
    ]) {
      expect(() => assertExclusionNoticeSafe(mauvais, "test"), JSON.stringify(mauvais))
        .toThrow(ExclusionLeakError);
    }
  });

  it("un avis bien formé passe — y compris sur un champ dont le NOM porte des chiffres", () => {
    // `sha256` a fait rougir une première version du garde, qui comptait les
    // chiffres. Ce n'est pas le nombre de chiffres qui distingue un nom d'un
    // contenu, c'est la forme d'identifiant.
    for (const champ of ["sha256", "sourceUrl", "canonicalMint", "case_meta.mint", "amountUsdNature"]) {
      expect(() =>
        assertExclusionNoticeSafe(
          { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: champ }, "test",
        ), champ,
      ).not.toThrow();
    }
  });

  it("un motif hors vocabulaire est refusé", () => {
    expect(() =>
      assertExclusionNoticeSafe({ excluded: true, reason: "PARCE_QUE", field: "x" }, "test"),
    ).toThrow(ExclusionLeakError);
  });
});
