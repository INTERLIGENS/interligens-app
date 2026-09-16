// ─── CC-OFFLINE-256 · BOTIFY-FOUNDATION-0 — ACCEPTATION CAUSALE MINIMALE ───
//
// ██  LE MUTANT QUI COMPTE EST E :                                          ██
// ██  LES 8 ANCIENNES SOURCES BOTIFY NE PEUVENT PAS SAUVER LA NOUVELLE CLAIM.██
//
// Sept mutants, pas un harnais géant. Chacun porte une question, et une seule.

import { describe, it, expect } from "vitest";
import { decideFoundationContract, decidePublicationContract } from "@/lib/casefile/governedWriter";
import { projectAssembly } from "@/lib/casefile/audienceProjection";
import type { PublicSource } from "@/lib/casefile/canonicalReader";
import type { AssembledClaim, AssembledSource, CanonicalAuthorityAssembly } from "@/lib/casefile/authorityAssembly";
import {
  SOURCE_ID, CLAIM_ID, SNAPSHOT_ID, DESCRIPTION_RATIFIEE, TITRE_RATIFIE,
} from "@/scripts/casefile/fondement-botify-events";

const DIGEST = "3d87a6f1ab58944db479b6d00038802640cb5914c18e8f53338e19459656bb33";
const LOCATOR = `r2://interligens-evidence/evidence/3d/${DIGEST}.json`;

/** LA pièce : la mesure gouvernée, telle que BOTIFY-MEASURE-0 l'a produite. */
const mesure = (o: Partial<AssembledSource> = {}): AssembledSource => ({
  sourceId: SOURCE_ID, sourceType: "SYSTEM_MEASUREMENT", caption: null,
  capturedAt: "2026-09-16", sourceUrl: LOCATOR, sha256: DIGEST,
  snapshotLinked: true, provenanceKind: "MACHINE_MEASURED", journalId: "18",
  sourceLocator: LOCATOR,
  declaredBy: "instrument:il-measure-botify-proceeds-events@1.0.0", ...o,
});

/**
 * LES HUIT SOURCES HISTORIQUES, telles que le dépôt les a mesurées :
 * « 8 sources BOTIFY migrées — 0 sha256, 0 sourceUrl → jamais admissibles ».
 * Elles sont ici pour être PRÉSENTES et ne rien sauver.
 */
const HISTORIQUES: AssembledSource[] = Array.from({ length: 8 }, (_, i) => ({
  sourceId: `SRC-LEGACY-0${i + 1}`, sourceType: "screenshot", caption: null,
  capturedAt: null, sourceUrl: null, sha256: null, snapshotLinked: false,
  provenanceKind: "UNKNOWN", journalId: null, sourceLocator: null, declaredBy: null,
}));

const claim = (o: Partial<AssembledClaim> = {}): AssembledClaim => ({
  claimId: CLAIM_ID, version: 1, rowNature: "PRIMARY_OBSERVATION",
  title: TITRE_RATIFIE, titleFr: null, description: DESCRIPTION_RATIFIEE,
  descriptionFr: null, category: "METHODOLOGY", severity: "NONE",
  status: "OBSERVED", claimDate: null, state: "ATTACHED",
  evidenceRefs: [SOURCE_ID], contentHash: "b".repeat(64), ...o,
});

const registre = (sources: readonly AssembledSource[]) =>
  new Map<string, PublicSource>(
    sources.map((s) => [
      s.sourceId,
      {
        sourceId: s.sourceId, sourceType: s.sourceType, caption: s.caption,
        capturedAt: s.capturedAt, sourceUrl: s.sourceUrl, sha256: s.sha256,
        evidenceLinked: s.snapshotLinked,
        provenanceKind: s.provenanceKind as PublicSource["provenanceKind"],
      } as PublicSource,
    ]),
  );

const fondement = (c: AssembledClaim, sources: readonly AssembledSource[]) =>
  decideFoundationContract({ rowNature: c.rowNature, evidenceRefs: c.evidenceRefs }, registre(sources));

const assemblage = (c: AssembledClaim, sources: readonly AssembledSource[]): CanonicalAuthorityAssembly => ({
  subject: { ref: "IL-SHILL-BOTIFY-001", codename: "BOTIFY", ticker: "$BOTIFY", title: "t" },
  sources, claims: [c], dependencies: [],
});

// ═══ A · LE NOMINAL ═════════════════════════════════════════════════════════

describe("A · MUTANT — source + claim nominales ⇒ FOUNDATION MET", () => {
  it("la mesure gouvernée FONDE l'observation", () => {
    const v = fondement(claim(), [mesure()]);
    expect(v.verdict).toBe("MET");
    if (v.verdict !== "MET") return;
    expect(v.nature).toBe("PRIMARY_OBSERVATION");
    expect(v.refs).toEqual([SOURCE_ID]);
  });

  it("la pièce citée est bien la mesure BOTIFY — snapshot, digest, instrument", () => {
    const s = mesure();
    expect(s.sha256).toBe(DIGEST);
    expect(s.sourceLocator).toContain(DIGEST);
    expect(s.provenanceKind).toBe("MACHINE_MEASURED");
    expect(s.declaredBy).toBe("instrument:il-measure-botify-proceeds-events@1.0.0");
    expect(SNAPSHOT_ID).toBe("botifymeas-3d87a6f1ab58944d");
  });
});

// ═══ B · LA CITATION EST EXIGÉE ═════════════════════════════════════════════

describe("B · MUTANT — retirer l'evidenceRef ⇒ PRIMARY_OBSERVATION REFUSÉE", () => {
  it("une observation sans pièce n'est pas fondée", () => {
    const v = fondement(claim({ evidenceRefs: [] }), [mesure()]);
    expect(v.verdict).toBe("UNMET");
    if (v.verdict === "UNMET") expect(v.refusal.cause).toBe("EVIDENCE_REFS_EMPTY");
  });

  it("aucune dépendance ne peut compenser : le relâchement ne vaut que pour INFERENCE", () => {
    // Même en passant un compte de dépendances, une PRIMARY_OBSERVATION sans
    // pièce reste refusée. C'est la règle existante, pas une exception BOTIFY.
    const v = decideFoundationContract(
      { rowNature: "PRIMARY_OBSERVATION", evidenceRefs: [] }, registre([mesure()]), 3,
    );
    expect(v.verdict).toBe("UNMET");
  });
});

// ═══ C · LE FONDEMENT DE LA PIÈCE ═══════════════════════════════════════════

describe("C · MUTANT — casser le fondement snapshot/provenance ⇒ non éligible", () => {
  it("provenance non qualifiée ⇒ la claim n'est plus fondée", () => {
    const v = fondement(claim(), [mesure({ provenanceKind: "UNKNOWN" })]);
    expect(v.verdict).toBe("UNMET");
    if (v.verdict === "UNMET") expect(v.refusal.cause).toBe("SOURCE_PROVENANCE_UNQUALIFIED");
  });

  it("snapshot délié ⇒ la claim n'est plus fondée", () => {
    expect(fondement(claim(), [mesure({ snapshotLinked: false })]).verdict).toBe("UNMET");
  });

  it("digest absent ⇒ la claim n'est plus fondée", () => {
    expect(fondement(claim(), [mesure({ sha256: null })]).verdict).toBe("UNMET");
  });
});

// ═══ D · L'IDENTITÉ DE LA PIÈCE ═════════════════════════════════════════════

describe("D · MUTANT — mauvaise identité de source ⇒ refusée par le contrat existant", () => {
  it("une référence qui ne résout vers rien ne fabrique pas de pièce", () => {
    const v = fondement(claim({ evidenceRefs: ["SRC-BOTIFY-MEASURE-99"] }), [mesure()]);
    expect(v.verdict).toBe("UNMET");
    if (v.verdict === "UNMET") expect(v.refusal.cause).toBe("EVIDENCE_REF_UNRESOLVED");
  });

  it("la pièce présente sous un AUTRE identifiant ne répond pas à la citation", () => {
    expect(fondement(claim(), [mesure({ sourceId: "SRC-AUTRE-CHOSE" })]).verdict).toBe("UNMET");
  });
});

// ═══ E · LE MUTANT QUI COMPTE ═══════════════════════════════════════════════

describe("E · MUTANT DÉCISIF — les 8 sources historiques ne SAUVENT PAS la claim", () => {
  it("elles sont PRÉSENTES, et la claim reste fondée par la SEULE mesure", () => {
    const v = fondement(claim(), [mesure(), ...HISTORIQUES]);
    expect(v.verdict).toBe("MET");
    // Elle ne cite QU'ELLE. L'historique est là et ne participe à rien.
    if (v.verdict === "MET") expect(v.refs).toEqual([SOURCE_ID]);
  });

  it("⛔ retirer la mesure, garder les huit ⇒ la claim TOMBE", () => {
    // Le cas qui prouve que le fondement ne s'appuie pas accidentellement sur
    // l'historique : huit pièces disponibles, et aucune ne peut le remplacer.
    const v = fondement(claim(), HISTORIQUES);
    expect(v.verdict).toBe("UNMET");
    if (v.verdict === "UNMET") expect(v.refusal.cause).toBe("EVIDENCE_REF_UNRESOLVED");
  });

  it("citer une source historique à la place ⇒ REFUSÉE — 0 sha256, 0 sourceUrl", () => {
    const v = fondement(claim({ evidenceRefs: ["SRC-LEGACY-01"] }), [mesure(), ...HISTORIQUES]);
    expect(v.verdict).toBe("UNMET");
  });
});

// ═══ F · AUCUNE DÉPENDANCE N'EST REQUISE ════════════════════════════════════

describe("F · MUTANT — aucune dépendance ni inférence n'est nécessaire", () => {
  it("l'assemblage projette la claim avec ZÉRO dépendance", () => {
    const p = projectAssembly(assemblage(claim(), [mesure()]), "COUNSEL_INVESTOR");
    expect(p.claims).toHaveLength(1);
    expect(p.claims[0].dependencies).toEqual([]);
    expect(p.claims[0].rowNature).toBe("PRIMARY_OBSERVATION");
  });

  it("l'exécuteur n'est appelé avec NI dépendance NI inférence", async () => {
    const { codeSeul } = await import("./codeSeul");
    const source = codeSeul("src/scripts/casefile/fondement-botify-events.ts");
    for (const interdit of ["dependsOn", "DERIVED_FROM", "INFERENCE", "decidePublicRelease", "GRANT"]) {
      expect(source, interdit).not.toContain(interdit);
    }
  });
});

// ═══ G · LES DEUX AUDIENCES ═════════════════════════════════════════════════

describe("G · MUTANT — COUNSEL projette, PUBLIC ne projette pas", () => {
  it("COUNSEL_INVESTOR projette la claim", () => {
    const p = projectAssembly(assemblage(claim(), [mesure()]), "COUNSEL_INVESTOR");
    expect(p.claims.map((c) => c.claimId)).toEqual([CLAIM_ID]);
    expect(p.claims[0].admittedBy).toBe("COUNSEL_INVESTOR");
  });

  it("PUBLIC ne la projette PAS — ni par l'état, ni par la provenance", () => {
    const p = projectAssembly(assemblage(claim(), [mesure()]), "PUBLIC");
    expect(p.claims).toEqual([]);
    expect(p.state).toBe("NO_GOVERNED_CLAIM");
    // Même PUBLIC d'état, la publication exige VERIFIED : MACHINE_MEASURED ne
    // publie pas. L'asymétrie est celle du contrat, pas une règle BOTIFY.
    const force = projectAssembly(assemblage(claim({ state: "PUBLIC" }), [mesure()]), "PUBLIC");
    expect(force.claims).toEqual([]);
    expect(decidePublicationContract(
      { rowNature: "PRIMARY_OBSERVATION", evidenceRefs: [SOURCE_ID] }, registre([mesure()]),
    ).verdict).toBe("UNMET");
  });
});

// ═══ LA FRONTIÈRE SÉMANTIQUE DU LIBELLÉ ═════════════════════════════════════

describe("BOTIFY-FOUNDATION-0 · le libellé ne dépasse pas la mesure", () => {
  const texte = `${TITRE_RATIFIE} ${DESCRIPTION_RATIFIEE}`;

  /**
   * ⚠️ LE MOT « proceeds » EXISTE DANS LE LIBELLÉ, ET C'EST CORRECT.
   *
   * Il n'y apparaît que dans DEUX IDENTIFIANTS : l'identité de l'instrument —
   * forme imposée par le CHECK en base — et le NOM DE LA TABLE citée comme
   * borne de mesure. Nommer sa borne est exactement ce que le ruling exige ;
   * interdire le mot partout interdirait de la nommer.
   *
   *   MODEL NAME ≠ SEMANTIC AUTHORITY — et l'inverse est vrai aussi : citer un
   *   nom de modèle n'est pas prononcer une assertion.
   *
   * Le témoin scanne donc le texte PRIVÉ de ses identifiants, et vérifie
   * séparément que ce sont les SEULES occurrences.
   */
  const IDENTIFIANTS = [
    "instrument:il-measure-botify-proceeds-events@1.0.0",
    "KolProceedsEvent",
  ];
  const sansIdentifiants = IDENTIFIANTS.reduce((t, id) => t.split(id).join("⟦id⟧"), texte);

  it("aucun vocabulaire interdit par absence d'autorité, hors identifiants cités", () => {
    for (const mot of [
      "sale", "sold", "sell", "seller", "proceeds", "profit", "revenue",
      "cash-out", "cashout", "liquidation", "insider", "coordinated",
      "fraud", "manipulation", "dump", "USD", "$", "KOL", "actor",
    ]) {
      expect(sansIdentifiants.toLowerCase(), mot).not.toContain(mot.toLowerCase());
    }
  });

  it("« proceeds » n'apparaît QUE dans les deux identifiants, jamais comme assertion", () => {
    const occurrences = (texte.toLowerCase().match(/proceeds/g) ?? []).length;
    expect(occurrences).toBe(2);
    expect(sansIdentifiants.toLowerCase()).not.toContain("proceeds");
  });

  it("ni distribution d'étiquettes, ni total de tokens", () => {
    for (const mot of ["dex_sell", "cex_deposit", "261 rows labelled", "41139848", "41,139,848", "eventType"]) {
      expect(texte, mot).not.toContain(mot);
    }
  });

  it("la formule des adresses est EXACTEMENT celle qui est autorisée", () => {
    expect(texte).toContain("20 distinct walletAddress values");
    for (const mot of ["20 wallets", "20 KOL wallets", "20 actor wallets", "20 sellers", "20 controlled"]) {
      expect(texte, mot).not.toContain(mot);
    }
  });

  it("la cardinalité est celle de l'instrument scellé — jamais celle du balayage", () => {
    expect(texte).toContain("262 event rows");
    expect(texte).toContain("262 distinct");
    // EARLIER SELECTION-SCAN COUNT ≠ GOVERNED MEASUREMENT COUNT.
    expect(texte).not.toContain("258");
    expect(texte).not.toContain("264");
  });

  it("la précision capturée est DITE, jamais reconstruite", () => {
    expect(texte).toContain("261 rows carry second precision and 1 row carries day precision only");
    expect(texte).toContain("2026-04-15T00:00:00Z");
  });

  it("la borne de mesure voyage AVEC l'assertion", () => {
    expect(texte).toContain("bounded to KolProceedsEvent rows whose tokenAddress equals the canonical mint");
    expect(texte).toContain("to that table at that instant");
    expect(texte).toContain("instrument:il-measure-botify-proceeds-events@1.0.0");
  });
});
