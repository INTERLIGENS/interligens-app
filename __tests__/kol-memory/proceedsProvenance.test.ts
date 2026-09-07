// ─── BUILD 8 / P2 — La provenance d'un chiffre se dérive, elle ne s'affirme pas
//
// Mesuré le 2026-09-07 sur les 32 profils publiés : 30 reproductibles,
// 1 sans chiffre, 1 divergent (141 594 $). Le défaut n'est pas la divergence —
// c'est que rien dans la charge utile ne disait lequel.

import { describe, it, expect } from "vitest";
import {
  buildProceedsProvenance,
  deriveReproducibility,
  REPRODUCIBILITY_STATES,
  WRITER_RULE_V1,
} from "@/lib/kol-memory/proceedsProvenance";

describe("BUILD 8 / P2 — les quatre états, et aucun défaut", () => {
  it("servi === source → REPRODUCIBLE", () => {
    expect(deriveReproducibility({ servedUsd: 1000, sourceUsd: 1000 })).toBe("REPRODUCIBLE");
  });

  it("le cas mesuré : 141 594 $ servis que la source ne rend pas → NOT_REPRODUCIBLE", () => {
    expect(deriveReproducibility({ servedUsd: 141_594, sourceUsd: 138_000 })).toBe(
      "NOT_REPRODUCIBLE",
    );
  });

  it("aucun chiffre servi, source lue → NO_FIGURE", () => {
    expect(deriveReproducibility({ servedUsd: null, sourceUsd: 0 })).toBe("NO_FIGURE");
  });

  it("source NON consultée → NOT_VERIFIED, jamais un succès implicite", () => {
    for (const input of [{}, { servedUsd: 1000 }, { servedUsd: 1000, sourceUsd: null }]) {
      expect(deriveReproducibility(input), JSON.stringify(input)).toBe("NOT_VERIFIED");
    }
  });

  it("NOT_VERIFIED l'emporte sur NO_FIGURE — on n'affirme pas une absence non constatée", () => {
    // Un profil dont la source n'a pas été lue ne doit pas ressortir comme un
    // profil sans chiffre : ce serait constater une absence qu'on n'a pas vue.
    expect(deriveReproducibility({ servedUsd: null })).toBe("NOT_VERIFIED");
  });

  it("un zéro servi est un CHIFFRE, pas une absence", () => {
    expect(deriveReproducibility({ servedUsd: 0, sourceUsd: 0 })).toBe("REPRODUCIBLE");
    expect(deriveReproducibility({ servedUsd: 0, sourceUsd: 5 })).toBe("NOT_REPRODUCIBLE");
  });
});

describe("BUILD 8 / P2 — la source n'est déclarée que si elle a été lue", () => {
  it("MUTANT — le littéral posé en dur devient rouge", () => {
    // `canonical.ts` pose proceedsSource: "KolProceedsEvent" sans jamais lire
    // la table. Ici, ne pas la lire rend `null`.
    const p = buildProceedsProvenance({ servedUsd: 1000 });
    expect(p.source).toBeNull();
    expect(p.rule).toBeNull();
    expect(p.reproducibility).toBe("NOT_VERIFIED");
  });

  it("lue, elle est nommée — avec la règle qui l'a interrogée", () => {
    const p = buildProceedsProvenance({ servedUsd: 1000, sourceUsd: 1000, eventCount: 42 });
    expect(p.source).toBe("KolProceedsEvent");
    expect(p.rule).toBe(WRITER_RULE_V1.id);
    expect(p.eventCount).toBe(42);
  });

  it("la règle dit où se relire, et n'usurpe pas la grammaire d'un methodRef", () => {
    // `<slug>/<composant>@v<N>` exige un artefact GELÉ. Aucune méthodologie ne
    // décrit cette agrégation ; en inventer une référence serait pire que rien.
    expect(WRITER_RULE_V1.id).not.toMatch(/@v[0-9]+$/);
    expect(WRITER_RULE_V1.source).toContain("sync-proceeds");
    expect(WRITER_RULE_V1.sql).toContain("ambiguous");
  });

  it("les deux chiffres sont rendus ENSEMBLE — sinon on ne peut pas vérifier", () => {
    const p = buildProceedsProvenance({ servedUsd: 141_594, sourceUsd: 138_000 });
    expect(p.servedUsd).toBe(141_594);
    expect(p.sourceUsd).toBe(138_000);
  });
});

describe("BUILD 8 / P2 — ce que la table voisine savait déjà est remonté", () => {
  it("coverageStatus et pricingQuality traversent au lieu d'être tus", () => {
    // Mesuré : 28/28 coverageStatus='partial', 24/28 pricingQuality='fallback'.
    const p = buildProceedsProvenance({
      servedUsd: 1000,
      sourceUsd: 1000,
      coverageStatus: "partial",
      pricingQuality: "fallback",
    });
    expect(p.coverageStatus).toBe("partial");
    expect(p.pricingQuality).toBe("fallback");
  });

  it("absents, ils rendent null — jamais une valeur rassurante par défaut", () => {
    const p = buildProceedsProvenance({ servedUsd: 1000, sourceUsd: 1000 });
    expect(p.coverageStatus).toBeNull();
    expect(p.pricingQuality).toBeNull();
    expect(p.summaryComputedAt).toBeNull();
  });

  it("une valeur non textuelle ou vide est refusée, pas castée", () => {
    const p = buildProceedsProvenance({
      servedUsd: 1,
      sourceUsd: 1,
      coverageStatus: "",
      pricingQuality: 42,
    });
    expect(p.coverageStatus).toBeNull();
    expect(p.pricingQuality).toBeNull();
  });
});

describe("BUILD 8 / P2 — aucun verdict, aucun score", () => {
  it("les états sont un vocabulaire fermé, sans ordre de qualité", () => {
    expect([...REPRODUCIBILITY_STATES]).toEqual([
      "REPRODUCIBLE",
      "NOT_REPRODUCIBLE",
      "NO_FIGURE",
      "NOT_VERIFIED",
    ]);
  });

  it("l'enveloppe ne porte ni score, ni seuil, ni pourcentage", () => {
    const p = buildProceedsProvenance({ servedUsd: 141_594, sourceUsd: 138_000 });
    const interdits = ["score", "confidence", "percent", "ratio", "threshold", "grade", "rank"];
    for (const k of Object.keys(p)) {
      for (const mot of interdits) {
        expect(k.toLowerCase(), `${k} ne doit pas exister`).not.toContain(mot);
      }
    }
  });
});
