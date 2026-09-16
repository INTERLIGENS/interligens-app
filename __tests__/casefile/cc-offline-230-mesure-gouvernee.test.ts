// ─── CC-OFFLINE-230 — LES MUTANTS DU CONSTAT NÉGATIF GOUVERNÉ ───────────────
//
// ██  LA MESURE DOIT ÊTRE UN OBJET GOUVERNÉ, PAS UNE PROSE SIGNÉE.          ██
//
// Sans mutant rouge, la garde n'est pas prouvée. C'est la règle qui a validé
// l'horodatage RFC 3161 et l'atomicité IfNoneMatch ; elle vaut ici aussi.
//
// Trois altérations doivent être DÉTECTÉES — RESULT, SCOPE, INSTRUMENT IDENTITY
// — et deux gardes de la nouvelle autorité doivent REFUSER par leur nom.

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

import { serialiserCanonique, type ObjetDeMesure } from "@/scripts/casefile/mesure-vine-attribution";
import { validerQualification, INSTRUMENT_DECLARANT_FORM } from "@/lib/casefile/journalWriter";
import {
  isFoundationEligibleSource,
  isPublicationEligibleSource,
  FOUNDATION_TOLERATED_PROVENANCE,
} from "@/lib/casefile/governedWriter";
import type { PublicSource } from "@/lib/casefile/canonicalReader";

const DECLARANT = "instrument:il-measure-vine-wallet-attribution@1.0.0";

/** La mesure de référence — la forme réelle, sans la connexion. */
const mesure = (o: Partial<ObjetDeMesure> = {}): ObjetDeMesure => ({
  schema: "IL-SYSTEM-MEASUREMENT/1",
  question: "Existe-t-il un fondement permettant d'attribuer un wallet à l'un des quatre comptes ?",
  scope: {
    dossierRef: "IL-SHILL-VINE-001",
    canonicalMint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump",
    actors: ["0xSweep", "CookerFlips", "fuelkek", "solana_daily"],
    governedTables: ["token_casefiles", "CaseFileClaim", "CaseFileSource"],
    excluded: { ungovernedWalletBearingTables: 47, rationale: "hors univers par construction" },
  },
  instrument: {
    name: "il-measure-vine-wallet-attribution",
    version: "1.0.0",
    codeIdentitySha256: "a".repeat(64),
  },
  observedAt: "2026-09-16T09:00:00.000Z",
  result: "NOT_ESTABLISHED",
  causes: [
    "NO_FOUNDED_ACTOR_WALLET_ATTRIBUTION",
    "NO_GOVERNED_WALLET_CASE_TOKEN_BRIDGE",
    "WALLET_SHAPED_STRINGS_PRESENT_BUT_UNFOUNDED",
  ],
  input: { claimsExamined: 15, governedSourcesExamined: 5 },
  limitations: ["une forme n'est pas une attribution"],
  replay: { determinism: "lecture seule" },
  ...o,
});

const digest = (m: ObjetDeMesure) => createHash("sha256").update(serialiserCanonique(m)).digest("hex");

describe("CC-OFFLINE-230 · l'objet de mesure est GOUVERNÉ, pas une prose", () => {
  it("la sérialisation est CANONIQUE : l'ordre des clés ne change pas le digest", () => {
    const a = mesure();
    // Le même contenu, construit dans un ORDRE DE CLÉS différent.
    const b = mesure({ ...JSON.parse(JSON.stringify({ causes: a.causes, result: a.result })) });
    expect(digest(a)).toBe(digest(b));
    // Et la sérialisation est stable d'un appel à l'autre.
    expect(serialiserCanonique(a).equals(serialiserCanonique(mesure()))).toBe(true);
  });

  it("MUTANT 1 — altérer le RÉSULTAT est DÉTECTÉ par le digest", () => {
    const base = digest(mesure());
    const mutant = digest(mesure({ result: "ESTABLISHED" }));
    expect(mutant).not.toBe(base);
  });

  it("MUTANT 2 — altérer le PÉRIMÈTRE est DÉTECTÉ par le digest", () => {
    const base = digest(mesure());
    // Le même verdict, mais sur un univers de recherche élargi en douce : c'est
    // EXACTEMENT la fraude qu'un constat négatif rend possible si la borne ne
    // fait pas partie de l'objet scellé.
    const elargi = mesure({
      scope: { ...(mesure().scope as Record<string, unknown>), governedTables: ["token_casefiles"] },
    });
    expect(digest(elargi)).not.toBe(base);
  });

  it("MUTANT 3 — altérer l'IDENTITÉ DE L'INSTRUMENT est DÉTECTÉ par le digest", () => {
    const base = digest(mesure());
    const versionMutee = mesure({
      instrument: { ...(mesure().instrument as Record<string, unknown>), version: "1.0.1" },
    });
    const codeMute = mesure({
      instrument: { ...(mesure().instrument as Record<string, unknown>), codeIdentitySha256: "b".repeat(64) },
    });
    expect(digest(versionMutee)).not.toBe(base);
    expect(digest(codeMute)).not.toBe(base);
  });
});

describe("CC-OFFLINE-230 · les deux gardes qui DÉFINISSENT MACHINE_MEASURED", () => {
  const intention = (o: Record<string, unknown> = {}) => ({
    evidenceSnapshotId: "snap-1",
    provenanceKind: "MACHINE_MEASURED" as const,
    referenceKind: "DOCUMENT" as const,
    sourceLocator: "r2://interligens-evidence/evidence/d5/abc.json",
    sha256: "c".repeat(64),
    declaredBy: DECLARANT,
    declaredAt: new Date("2026-09-16T09:00:00Z"),
    ...o,
  });

  it("TÉMOIN POSITIF — MACHINE_MEASURED + DOCUMENT + instrument semver est ACCEPTÉ", () => {
    const v = validerQualification(intention());
    expect(v.ok, "ok" in v && !v.ok ? JSON.stringify(v) : "").toBe(true);
  });

  it("MUTANT 4 — MACHINE_MEASURED hors DOCUMENT est REFUSÉ, par son nom", () => {
    const v = validerQualification(
      intention({ referenceKind: "QUERY_CONTEXT", sourceLocator: "https://x.com/search?q=vine" }),
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.refusal.cause).toBe("MEASUREMENT_NOT_DOCUMENT");
  });

  it("MUTANT 5 — un DÉCLARANT HUMAIN est REFUSÉ : une mesure identifie son instrument", () => {
    for (const humain of ["David Douville", "david", "operator", "instrument:sans-version"]) {
      const v = validerQualification(intention({ declaredBy: humain }));
      expect(v.ok, humain).toBe(false);
      if (!v.ok) expect(v.refusal.cause, humain).toBe("MEASUREMENT_DECLARANT_NOT_INSTRUMENT");
    }
  });

  it("la forme du déclarant est un MIROIR du CHECK en base", () => {
    expect(INSTRUMENT_DECLARANT_FORM.test(DECLARANT)).toBe(true);
    expect(INSTRUMENT_DECLARANT_FORM.test("David Douville")).toBe(false);
    expect(INSTRUMENT_DECLARANT_FORM.test("instrument:il-measure@1.0")).toBe(false);
  });
});

describe("CC-OFFLINE-230 · l'asymétrie fonder / publier", () => {
  const piece = (kind: string): PublicSource => ({
    sourceId: "SRC-MEASURE-01",
    sourceType: "SYSTEM_MEASUREMENT",
    caption: null,
    capturedAt: "2026-09-16",
    sourceUrl: "r2://interligens-evidence/evidence/d5/abc.json",
    sha256: "c".repeat(64),
    evidenceLinked: true,
    provenanceKind: kind as PublicSource["provenanceKind"],
  });

  it("une mesure PEUT fonder", () => {
    expect(FOUNDATION_TOLERATED_PROVENANCE).toContain("MACHINE_MEASURED");
    expect(isFoundationEligibleSource(piece("MACHINE_MEASURED")).eligible).toBe(true);
  });

  it("une mesure ne peut JAMAIS publier — et aucune liste d'exclusion ne le garantit", () => {
    const p = isPublicationEligibleSource(piece("MACHINE_MEASURED"));
    expect(p.eligible).toBe(false);
    if (!p.eligible) expect(p.refusal.cause).toBe("SOURCE_PROVENANCE_NOT_VERIFIED");
  });

  it("les trois autorités existantes n'ont RIEN changé", () => {
    for (const kind of ["OPERATOR_DECLARED", "EXTRACTED"] as const) {
      expect(isFoundationEligibleSource(piece(kind)).eligible, kind).toBe(true);
      expect(isPublicationEligibleSource(piece(kind)).eligible, kind).toBe(false);
    }
    expect(isPublicationEligibleSource(piece("VERIFIED")).eligible).toBe(true);
    expect(isFoundationEligibleSource(piece("UNKNOWN")).eligible).toBe(false);
  });
});
