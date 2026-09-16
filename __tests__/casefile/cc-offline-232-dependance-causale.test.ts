// ─── CC-OFFLINE-232 — LA DÉPENDANCE CAUSALE CLAIM → CLAIM ───────────────────
//
// ██  UNE SOURCE PROBANTE ET UNE ASSERTION INTERMÉDIAIRE                     ██
// ██  NE SONT PAS LA MÊME CHOSE.                                            ██
//
//   evidenceRefs   « quelles PIÈCES fondent cette observation ? »
//   dependsOn      « quelles ASSERTIONS GOUVERNÉES cette inférence consomme-t-elle ? »
//
// Le contrat devient SÉMANTIQUE SELON `rowNature`, et il le devient EN
// FAIL-CLOSED : ce n'est pas « si INFERENCE alors evidenceRefs optionnel »,
// c'est « si INFERENCE alors un ensemble de dépendances gouvernées valide est
// EXIGÉ ».
//
// ⚠️ LE TÉMOIN ESSENTIEL DE CE FICHIER est le premier : une PRIMARY_OBSERVATION
// sans pièce reste REFUSÉE, même entourée de dépendances. C'est lui qui prouve
// que E n'a pas affaibli le contrat historique.

import { describe, it, expect } from "vitest";
import { decideFoundation, FOUNDATION_REFUSAL_CAUSES } from "@/lib/casefile/governedWriter";
import type { FoundationRequest } from "@/lib/casefile/governedWriter";
import { VINE_CASEFILE_REF, VINE_MINT } from "@/lib/casefile/publicProjection";

const SHA = "a".repeat(64);

const snapshot = () => ({
  id: "snap-1", canonicalMint: VINE_MINT, sha256: SHA,
  sourceUrl: "https://x.com/e/1", observedAt: "2026-09-16T09:00:00.000Z",
  provenanceKind: "OPERATOR_DECLARED",
});

const sourceDep = (o: Record<string, unknown> = {}) => ({
  casefileRef: VINE_CASEFILE_REF, claimId: "C-OBS", version: 1,
  rowNature: "PRIMARY_OBSERVATION", evidenceRefs: ["SRC-001"], ...o,
});

const requete = (claim: Record<string, unknown>, deps: unknown[] = []): FoundationRequest =>
  ({
    dossier: { ref: VINE_CASEFILE_REF, canonicalMint: VINE_MINT },
    snapshots: [snapshot()],
    sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-001", snapshotId: "snap-1", sourceType: "screenshot" }],
    existingClaims: [],
    dependencySources: deps,
    claim: { casefileRef: VINE_CASEFILE_REF, claimId: "C-INF", title: "t", claimDate: null, ...claim },
  }) as unknown as FoundationRequest;

const refus = (r: FoundationRequest) => {
  const d = decideFoundation(r);
  return d.decision === "REFUSED" ? d.refusal : null;
};

describe("CC-OFFLINE-232 · LE TÉMOIN ESSENTIEL — le contrat historique n'est pas affaibli", () => {
  it("PRIMARY_OBSERVATION sans evidenceRefs reste REFUSÉE — une dépendance ne la sauve PAS", () => {
    // Sans dépendance : le refus historique, mot pour mot.
    expect(refus(requete({ rowNature: "PRIMARY_OBSERVATION", evidenceRefs: [] }))).toEqual({
      cause: "EVIDENCE_REFS_EMPTY", at: "evidenceRefs",
    });
    // AVEC une dépendance parfaitement valide : le MÊME refus. Une dépendance ne
    // transforme jamais une observation sans pièce en observation fondée.
    expect(
      refus(
        requete(
          { rowNature: "PRIMARY_OBSERVATION", evidenceRefs: [], dependsOn: [{ claimId: "C-OBS", version: 1 }] },
          [sourceDep()],
        ),
      ),
    ).toEqual({ cause: "EVIDENCE_REFS_EMPTY", at: "evidenceRefs" });
  });

  it("les autres natures ne bénéficient d'aucun relâchement", () => {
    // Le vocabulaire fermé, moins INFERENCE : aucune autre nature ne gagne quoi
    // que ce soit à porter une dépendance.
    for (const nature of ["PRIMARY_OBSERVATION", "THIRD_PARTY_DATA", "ESTIMATE", "EDITORIAL_ASSERTION"]) {
      const r = refus(requete({ rowNature: nature, evidenceRefs: [], dependsOn: [{ claimId: "C-OBS", version: 1 }] }, [sourceDep()]));
      expect(r?.cause, nature).toBe("EVIDENCE_REFS_EMPTY");
    }
  });
});

describe("CC-OFFLINE-232 · l'INFERENCE est fondée par des ASSERTIONS, et il en faut", () => {
  it("INFERENCE sans dépendance ET sans pièce → DEPENDENCY_REQUIRED_FOR_INFERENCE", () => {
    expect(refus(requete({ rowNature: "INFERENCE", evidenceRefs: [] }))).toEqual({
      cause: "DEPENDENCY_REQUIRED_FOR_INFERENCE", at: "claim.dependsOn",
    });
  });

  it("INFERENCE AVEC des pièces mais SANS dépendance → REFUSÉE quand même", () => {
    // Le point délicat : ce n'est pas un assouplissement mais une EXIGENCE DE
    // PLUS. Porter des pièces ne dispense pas une inférence de consommer une
    // assertion.
    expect(refus(requete({ rowNature: "INFERENCE", evidenceRefs: ["SRC-001"] }))?.cause).toBe(
      "DEPENDENCY_REQUIRED_FOR_INFERENCE",
    );
  });

  it("TÉMOIN POSITIF — INFERENCE sans pièce, fondée ENTIÈREMENT par sa dépendance", () => {
    const d = decideFoundation(
      requete(
        { rowNature: "INFERENCE", evidenceRefs: [], dependsOn: [{ claimId: "C-OBS", version: 1 }] },
        [sourceDep()],
      ),
    );
    expect(d.decision, d.decision === "REFUSED" ? JSON.stringify(d.refusal) : "").toBe("FOUNDED");
    if (d.decision !== "FOUNDED") return;
    expect(d.foundation.claimToInsert.evidenceRefs).toEqual([]);
    expect(d.foundation.dependenciesToInsert).toEqual([
      {
        casefileRef: VINE_CASEFILE_REF,
        dependentClaimId: "C-INF",
        dependentVersion: 1,
        sourceClaimId: "C-OBS",
        sourceVersion: 1,
        dependencyKind: "DERIVED_FROM",
      },
    ]);
  });

  it("LA VERSION EST ÉPINGLÉE — une conclusion historique reste explicable contre ses entrées historiques", () => {
    const d = decideFoundation(
      requete(
        { rowNature: "INFERENCE", evidenceRefs: [], dependsOn: [{ claimId: "C-OBS", version: 3 }] },
        [sourceDep({ version: 3 })],
      ),
    );
    expect(d.decision).toBe("FOUNDED");
    if (d.decision !== "FOUNDED") return;
    // La ligne vise la v3 NOMMÉMENT. Une v4 qui naîtrait demain ne changerait
    // rien à ce fondement.
    expect(d.foundation.dependenciesToInsert[0].sourceVersion).toBe(3);
  });
});

describe("CC-OFFLINE-232 · l'existence ne suffit pas — le contrat de la source est ÉVALUÉ", () => {
  const cas: ReadonlyArray<readonly [string, unknown[], string]> = [
    ["source jamais lue", [], "DEPENDENCY_UNRESOLVED"],
    ["source d'une autre version", [sourceDep({ version: 2 })], "DEPENDENCY_UNRESOLVED"],
    ["source non classée", [sourceDep({ rowNature: null })], "DEPENDENCY_NOT_FOUNDABLE"],
    ["source UNCLASSIFIED", [sourceDep({ rowNature: "UNCLASSIFIED" })], "DEPENDENCY_NOT_FOUNDABLE"],
    ["source observation sans pièce", [sourceDep({ evidenceRefs: [] })], "DEPENDENCY_NOT_FOUNDABLE"],
  ];
  for (const [nom, deps, cause] of cas) {
    it(`${nom} → ${cause}`, () => {
      const r = refus(requete({ rowNature: "INFERENCE", evidenceRefs: [], dependsOn: [{ claimId: "C-OBS", version: 1 }] }, deps));
      expect(r?.cause, nom).toBe(cause);
    });
  }

  it("auto-dépendance → DEPENDENCY_SELF, jamais confondue avec supersedes", () => {
    const r = refus(requete({ rowNature: "INFERENCE", evidenceRefs: [], dependsOn: [{ claimId: "C-INF", version: 1 }] }));
    expect(r?.cause).toBe("DEPENDENCY_SELF");
  });

  it("une source d'un AUTRE dossier → DOSSIER_MIX", () => {
    const r = refus(
      requete({ rowNature: "INFERENCE", evidenceRefs: [], dependsOn: [{ claimId: "C-OBS", version: 1 }] },
        [sourceDep({ casefileRef: "IL-AUTRE-001" })]),
    );
    expect(r?.cause).toBe("DOSSIER_MIX");
  });

  it("une INFERENCE peut dépendre d'une autre INFERENCE fondée — sans pièce, légitimement", () => {
    const d = decideFoundation(
      requete({ rowNature: "INFERENCE", evidenceRefs: [], dependsOn: [{ claimId: "C-OBS", version: 1 }] },
        [sourceDep({ rowNature: "INFERENCE", evidenceRefs: [] })]),
    );
    expect(d.decision).toBe("FOUNDED");
  });
});

describe("CC-OFFLINE-232 · les quatre causes existent dans le vocabulaire fermé", () => {
  it("chacune est nommée", () => {
    for (const c of [
      "DEPENDENCY_REQUIRED_FOR_INFERENCE", "DEPENDENCY_UNRESOLVED",
      "DEPENDENCY_SELF", "DEPENDENCY_NOT_FOUNDABLE",
    ]) {
      expect(FOUNDATION_REFUSAL_CAUSES as readonly string[]).toContain(c);
    }
  });
});

// ═══ LE MUTANT QUI COMPTE — L'EXÉCUTEUR CONSOMME-T-IL VRAIMENT ? ════════════
//
// Les témoins ci-dessus éprouvent le DÉCIDEUR, à qui les sources sont remises.
// Ils resteraient tous verts si l'exécuteur cessait d'aller LIRE ces sources en
// base — c'est-à-dire si la dépendance redevenait déclarative.
//
//   UNE LIGNE DE DÉPENDANCE QUE LE PRODUCTEUR NE LIT PAS N'EST PAS UNE AUTORITÉ.
//
// Ce bloc branche donc l'exécuteur RÉEL sur une connexion scriptée, et vérifie
// deux choses qu'aucun test pur ne peut voir : que la lecture sous verrou a
// lieu, et que la ligne de dépendance est écrite DANS la même transaction.

import { executeFoundation, type SqlRunner, type SqlTransactor } from "@/lib/casefile/governedExecutor";

class DbScriptee implements SqlTransactor {
  readonly journal: string[] = [];
  constructor(private readonly reponses: ReadonlyArray<readonly [RegExp, Record<string, unknown>[]]>) {}
  async transaction<T>(fn: (db: SqlRunner) => Promise<T>): Promise<T> {
    const db: SqlRunner = {
      query: async <R extends Record<string, unknown>>(sql: string) => {
        const compact = sql.replace(/\s+/g, " ").trim();
        this.journal.push(compact);
        for (const [re, rows] of this.reponses) if (re.test(compact)) return rows as R[];
        return [] as R[];
      },
    };
    return fn(db);
  }
  count(re: RegExp): number { return this.journal.filter((l) => re.test(l)).length; }
}

const LECTURE_DEPS = /FROM "CaseFileClaim" WHERE "casefileRef" = \$1 AND \("claimId" \|\| '@' \|\| version::text\)/;
const INSERT_DEP = /INSERT INTO casefile_claim_dependencies/;

const intention = {
  dossier: { ref: VINE_CASEFILE_REF, canonicalMint: VINE_MINT },
  sources: [],
  claim: {
    casefileRef: VINE_CASEFILE_REF, claimId: "C-INF", rowNature: "INFERENCE",
    title: "t", claimDate: null, evidenceRefs: [],
    dependsOn: [{ claimId: "C-OBS", version: 1 }],
  },
} as never;

describe("CC-OFFLINE-232 · la consommation causale est dans l'EXÉCUTEUR", () => {
  it("TÉMOIN — la source est LUE sous verrou, et la dépendance écrite dans la MÊME transaction", async () => {
    const db = new DbScriptee([
      [/FROM token_casefiles/, [{ ref: VINE_CASEFILE_REF }]],
      [LECTURE_DEPS, [sourceDep()]],
    ]);
    const r = await executeFoundation(db, intention);
    expect(r.outcome, "refusal" in r ? JSON.stringify(r.refusal) : "").toBe("EXECUTED");
    expect(db.count(LECTURE_DEPS), "la source DOIT être lue").toBe(1);
    expect(db.count(INSERT_DEP), "la dépendance DOIT être écrite").toBe(1);
  });

  it("MUTANT — si la lecture ne rend RIEN, l'inférence est REFUSÉE et rien n'est écrit", async () => {
    // C'est exactement l'effet qu'aurait le retrait de la lecture dans
    // l'exécuteur : le décideur ne reçoit plus de source, et refuse.
    const db = new DbScriptee([[/FROM token_casefiles/, [{ ref: VINE_CASEFILE_REF }]]]);
    const r = await executeFoundation(db, intention);
    expect(r.outcome).toBe("REFUSED");
    if (r.outcome !== "REFUSED") return;
    expect(r.refusal.cause).toBe("DEPENDENCY_UNRESOLVED");
    expect(db.count(INSERT_DEP)).toBe(0);
  });
});
