// ─── CC-OFFLINE-242 · CF-2 — L'AUDIENCE GOUVERNE AVANT LE RENDU ────────────
//
// ██  Si le renderer reçoit déjà des assertions qu'il n'a pas le droit de    ██
// ██  présenter, la frontière d'audience est trop tardive.                   ██
//
// Ce qu'il ne reçoit pas, il ne peut pas le rendre par accident. Ces témoins
// tiennent cette propriété : la sélection se fait sur l'assemblage, par
// l'autorité de l'audience, et le renderer ne décide rien.

import { describe, it, expect } from "vitest";
import { projectAssembly, AUDIENCES } from "@/lib/casefile/audienceProjection";
import type {
  AssembledClaim,
  AssembledSource,
  CanonicalAuthorityAssembly,
} from "@/lib/casefile/authorityAssembly";

const SHA = "a".repeat(64);

const piece = (o: Partial<AssembledSource> = {}): AssembledSource => ({
  sourceId: "SRC-001", sourceType: "osint_x_search", caption: null,
  capturedAt: "2026-09-16", sourceUrl: "https://x.com/e/1", sha256: SHA,
  snapshotLinked: true, provenanceKind: "VERIFIED", journalId: "7",
  sourceLocator: "https://x.com/e/1", declaredBy: "Un Opérateur", ...o,
});

const claim = (o: Partial<AssembledClaim> = {}): AssembledClaim => ({
  claimId: "C-OBS", version: 1, rowNature: "PRIMARY_OBSERVATION", title: "t",
  titleFr: null, description: null, descriptionFr: null, category: null,
  severity: null, status: null, claimDate: null, state: "ATTACHED",
  evidenceRefs: ["SRC-001"], contentHash: "b".repeat(64), ...o,
});

const assemblage = (o: Partial<CanonicalAuthorityAssembly> = {}): CanonicalAuthorityAssembly => ({
  subject: { ref: "IL-SUJET-001", codename: "SUJET", ticker: "$SUJET", title: "t" },
  sources: [piece()],
  claims: [claim()],
  dependencies: [],
  ...o,
});

/** L'inférence du witness : aucune pièce, une dépendance versionnée. */
const INFERENCE = claim({
  claimId: "C-CONCLUSION", rowNature: "INFERENCE", evidenceRefs: [], contentHash: "c".repeat(64),
});
const DEP = {
  dependentClaimId: "C-CONCLUSION", dependentVersion: 1,
  sourceClaimId: "C-OBS", sourceVersion: 1, kind: "DERIVED_FROM",
};

describe("CF-2 · l'audience est explicite, et elle gouverne", () => {
  it("deux valeurs, et rien d'autre — aucune taxonomie générale", () => {
    expect([...AUDIENCES]).toEqual(["COUNSEL_INVESTOR", "PUBLIC"]);
  });

  it("le MÊME assemblage alimente les deux projections", () => {
    const a = assemblage();
    expect(projectAssembly(a, "COUNSEL_INVESTOR").subject).toEqual(projectAssembly(a, "PUBLIC").subject);
  });

  it("la projection est DÉTERMINISTE — deux appels, un résultat", () => {
    const a = assemblage();
    expect(JSON.stringify(projectAssembly(a, "COUNSEL_INVESTOR")))
      .toBe(JSON.stringify(projectAssembly(a, "COUNSEL_INVESTOR")));
  });
});

// ═══ LE TÉMOIN ESSENTIEL ════════════════════════════════════════════════════

describe("CF-2 · TÉMOIN — fondée côté counsel, absente côté public", () => {
  const a = assemblage({ claims: [claim(), INFERENCE], dependencies: [DEP] });

  it("l'inférence sans pièce est PRÉSENTE côté COUNSEL_INVESTOR", () => {
    const p = projectAssembly(a, "COUNSEL_INVESTOR");
    const inf = p.claims.find((c) => c.claimId === "C-CONCLUSION");
    expect(inf, "l'inférence doit être admise au fondement").toBeDefined();
    expect(inf?.admittedBy).toBe("COUNSEL_INVESTOR");
    // Et elle porte de quoi retrouver son fondement.
    expect(inf?.dependencies).toEqual([DEP]);
    expect(inf?.contentHash).toBe("c".repeat(64));
  });

  it("la MÊME inférence est ABSENTE côté PUBLIC", () => {
    const p = projectAssembly(a, "PUBLIC");
    expect(p.claims.find((c) => c.claimId === "C-CONCLUSION")).toBeUndefined();
  });

  it("le relâchement du fondement ne franchit PAS la frontière de publication", () => {
    // Même en PUBLIC état, sans pièce : la publication ne reçoit pas le compte
    // de dépendances, donc EVIDENCE_REFS_EMPTY. Aucun contournement.
    const b = assemblage({
      claims: [{ ...INFERENCE, state: "PUBLIC" }],
      dependencies: [DEP],
    });
    expect(projectAssembly(b, "PUBLIC").claims).toEqual([]);
  });
});

describe("CF-2 · aucune claim inéligible ne traverse", () => {
  it("COUNSEL — une claim non classée est ABSENTE", () => {
    const a = assemblage({ claims: [claim({ rowNature: null })] });
    expect(projectAssembly(a, "COUNSEL_INVESTOR").claims).toEqual([]);
  });

  it("COUNSEL — une observation SANS pièce est ABSENTE, même avec une dépendance", () => {
    const a = assemblage({
      claims: [claim({ evidenceRefs: [] })],
      dependencies: [{ ...DEP, dependentClaimId: "C-OBS" }],
    });
    expect(projectAssembly(a, "COUNSEL_INVESTOR").claims).toEqual([]);
  });

  it("COUNSEL — une pièce non qualifiée rend la claim ABSENTE", () => {
    const a = assemblage({ sources: [piece({ provenanceKind: "UNKNOWN" })] });
    expect(projectAssembly(a, "COUNSEL_INVESTOR").claims).toEqual([]);
  });

  it("PUBLIC — une claim ATTACHED est ABSENTE, même parfaitement fondée", () => {
    expect(projectAssembly(assemblage(), "PUBLIC").claims).toEqual([]);
    expect(projectAssembly(assemblage(), "COUNSEL_INVESTOR").claims).toHaveLength(1);
  });

  it("PUBLIC — une pièce OPERATOR_DECLARED ferme la porte publique, pas la counsel", () => {
    const a = assemblage({
      claims: [claim({ state: "PUBLIC" })],
      sources: [piece({ provenanceKind: "OPERATOR_DECLARED" })],
    });
    expect(projectAssembly(a, "PUBLIC").claims).toEqual([]);
    expect(projectAssembly(a, "COUNSEL_INVESTOR").claims).toHaveLength(1);
  });

  it("PUBLIC — une claim PUBLIC, citante et VERIFIED passe : l'existant est intact", () => {
    const a = assemblage({ claims: [claim({ state: "PUBLIC" })] });
    const p = projectAssembly(a, "PUBLIC");
    expect(p.claims.map((c) => c.claimId)).toEqual(["C-OBS"]);
    expect(p.claims[0].admittedBy).toBe("PUBLIC");
  });
});

describe("CF-2 · l'absence reste une absence", () => {
  it("aucune claim admissible → [] et une CARDINALITÉ, jamais un mot", () => {
    const p = projectAssembly(assemblage({ claims: [] }), "COUNSEL_INVESTOR");
    expect(p.claims).toEqual([]);
    expect(p.state).toBe("NO_GOVERNED_CLAIM");
    for (const mot of ["UNDETERMINED", "AVOID", "SAFE", "WARNING", "NOT_A_FINDING"]) {
      expect(JSON.stringify(p), mot).not.toContain(mot);
    }
  });

  it("la sortie ne porte AUCUN champ de synthèse", () => {
    expect(Object.keys(projectAssembly(assemblage(), "PUBLIC")).sort())
      .toEqual(["audience", "claims", "state", "subject"]);
  });
});

describe("CF-2 · chaque claim retenue porte de quoi retrouver son fondement", () => {
  it("les pièces citées sont RÉSOLUES, jamais des identifiants orphelins", () => {
    const c = projectAssembly(assemblage(), "COUNSEL_INVESTOR").claims[0];
    expect(c.citedSources).toHaveLength(1);
    expect(c.citedSources[0].sha256).toBe(SHA);
    expect(c.citedSources[0].sourceLocator).toBe("https://x.com/e/1");
  });

  it("une référence qui ne résout vers rien ne fabrique pas de pièce", () => {
    // Le contrat refuse d'abord — mais si un jour il passait, la projection ne
    // fabriquerait toujours rien.
    const a = assemblage({ claims: [claim({ evidenceRefs: ["SRC-INEXISTANTE"] })] });
    expect(projectAssembly(a, "COUNSEL_INVESTOR").claims).toEqual([]);
  });

  it("les dépendances d'une AUTRE version ne sont pas attribuées", () => {
    const a = assemblage({
      claims: [{ ...INFERENCE, version: 2 }],
      dependencies: [DEP], // épinglée sur la v1
    });
    // v2 ne trouve aucune dépendance → non admise au fondement.
    expect(projectAssembly(a, "COUNSEL_INVESTOR").claims).toEqual([]);
  });
});

describe("CF-2 · la projection RELAIE la qualification, elle ne la RÉSOUT pas", () => {
  it("aucun second résolveur : le journal n'est jamais relu ici", async () => {
    const { codeSeul } = await import("./codeSeul");
    const source = codeSeul("src/lib/casefile/audienceProjection.ts");
    expect(source).not.toContain("resolveJournalProvenance");
    expect(source).not.toContain("readLatestJournalRows");
    expect(source).not.toContain("evidence_provenance_journal");
    // Et aucune prose historique, ni le vecteur `any` par lequel elle revenait.
    for (const interdit of ["loadCaseByMint", "computeScore", "bodyMarkdown", "summary"]) {
      expect(source, interdit).not.toContain(interdit);
    }
    expect(source).not.toMatch(/\bas any\b/);
  });

  it("la qualification recopiée est EXACTEMENT celle de l'assemblage", () => {
    for (const kind of ["OPERATOR_DECLARED", "EXTRACTED", "VERIFIED", "MACHINE_MEASURED"]) {
      const a = assemblage({
        sources: [piece({ provenanceKind: kind })],
        claims: [claim({ state: "PUBLIC" })],
      });
      const c = projectAssembly(a, "COUNSEL_INVESTOR").claims[0];
      expect(c?.citedSources[0]?.provenanceKind, kind).toBe(kind);
    }
  });
});
