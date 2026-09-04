// --- F2.2 — LES GATES MUTATION DU WRITER -----------------------------------

import { describe, it, expect } from "vitest";
import {
  EDGE_PROOF_FLOOR_MEANING,
  buildEdgeProofCoverage,
  FUNDING_EDGE_TABLE,
  FUNDING_RELATIONSHIP_TABLE,
  buildFundingEdgeRow,
  buildFundingRelationshipRow,
  persistFundingGraph,
  qualifyFundingRelationship,
  satisfiesFundingEdgeChecks,
  satisfiesFundingRelationshipChecks,
  type FundingEdge,
  type FundingEdgeRow,
  type FundingGraphStore,
  type FundingRelationshipRow,
  type QualifiedFundingRelationship,
  type StoredEdge,
  type StoredRelationship,
} from "../index";
import { resolveMethodRef } from "@/lib/methodology/registry";

const S1 = "Subject1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const S2 = "Subject2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FUNDER = "Funder1cccccccccccccccccccccccccccccccccccc";
const CTX = "CASE-2025-VINE-001";
const BIG = 3_000_000_000;

const edge = (to: string, lamports: number, sig: string, ts = 1_737_590_000): FundingEdge => ({
  fromWallet: FUNDER, toWallet: to, asset: "SOL",
  amountLamports: lamports, txSignature: sig, blockTimeSeconds: ts,
  rowNature: "PRIMARY_OBSERVATION",
});

function qualified(): QualifiedFundingRelationship {
  return qualifyFundingRelationship({
    funder: FUNDER, subjectsReached: [S1, S2],
    edges: [edge(S1, BIG, "sigA"), edge(S2, BIG, "sigB")],
    coverage: { complete: false, censoredBy: "page_cap" },
  });
}

/** Store en mémoire. Compte les insertions — un doublon se verrait. */
function memStore() {
  const edges = new Map<string, StoredEdge>();
  const rels = new Map<string, StoredRelationship>();
  const inserts = { edges: 0, rels: 0 };
  const store: FundingGraphStore = {
    async findEdge(sig) { return edges.get(sig) ?? null; },
    async insertEdge(row: FundingEdgeRow) {
      if (edges.has(row.txSignature)) throw new Error("UNIQUE violation txSignature");
      edges.set(row.txSignature, {
        fromWallet: row.fromWallet, toWallet: row.toWallet,
        amountLamports: row.amountLamports, blockTimeSeconds: row.blockTimeSeconds,
      });
      inserts.edges++;
    },
    async findRelationship(k) { return rels.get(`${k.funderWallet}|${k.contextRef}|${k.methodRef}`) ?? null; },
    async insertRelationship(row: FundingRelationshipRow) {
      const k = `${row.funderWallet}|${row.contextRef}|${row.methodRef}`;
      if (rels.has(k)) throw new Error("UNIQUE violation");
      rels.set(k, { subjectsReached: row.subjectsReached, category: row.category, coverageIsFloor: row.coverageIsFloor });
      inserts.rels++;
    },
  };
  return { store, edges, rels, inserts };
}

describe("F2.2 - la nature passe par S6, ou elle ne s'écrit pas", () => {
  it("l'arête est PRIMARY_OBSERVATION et satisfait son CHECK declared", () => {
    const row = buildFundingEdgeRow(edge(S1, BIG, "sigA"), CTX);
    expect(row.rowNature).toBe("PRIMARY_OBSERVATION");
    expect(row.asset).toBe("SOL");
    expect(typeof row.amountLamports).toBe("bigint");
    expect(row.amountLamports).toBe(3_000_000_000n);
    expect(satisfiesFundingEdgeChecks(row).declared).toBe(true);
  });

  it("la qualification est INFERENCE et satisfait declared ET auditable", () => {
    const row = buildFundingRelationshipRow(qualified(), CTX);
    expect(row.rowNature).toBe("INFERENCE");
    expect(satisfiesFundingRelationshipChecks(row)).toEqual({ declared: true, auditable: true });
    expect(row.naturePolicyVersion.length).toBeGreaterThan(0);
    expect(Object.keys(row.natureBasis).length).toBeGreaterThan(0);
  });

  // ═══ MUTATION 1 — DUPLICATION AU REJEU ═════════════════════════════════
  it("MUTATION : rejouer la même collecte n'insère rien de plus", async () => {
    const m = memStore();
    const input = {
      contextRef: CTX, dryRun: false, store: m.store,
      edges: [edge(S1, BIG, "sigA"), edge(S2, BIG, "sigB")],
      qualifications: [qualified()],
    };
    const first = await persistFundingGraph(input);
    expect(first.edges.inserted).toBe(2);
    expect(first.relationships.inserted).toBe(1);

    const second = await persistFundingGraph(input);
    expect(second.edges.inserted).toBe(0);
    expect(second.edges.alreadyPresent).toBe(2);
    expect(second.relationships.inserted).toBe(0);
    expect(second.relationships.alreadyPresent).toBe(1);
    expect(second.conflicts).toEqual([]);
    // Le store n'a JAMAIS revu d'insert : le compteur est la preuve.
    expect(m.inserts).toEqual({ edges: 2, rels: 1 });
  });

  // ═══ MUTATION 2 — ÉCRASEMENT SILENCIEUX SUR COLLISION ══════════════════
  it("MUTATION : même signature, montant différent → REFUS TRACÉ, pas écrasement", async () => {
    const m = memStore();
    await persistFundingGraph({
      contextRef: CTX, dryRun: false, store: m.store,
      edges: [edge(S1, BIG, "sigA")], qualifications: [],
    });
    const r = await persistFundingGraph({
      contextRef: CTX, dryRun: false, store: m.store,
      edges: [edge(S1, BIG + 1, "sigA")], qualifications: [],
    });
    expect(r.edges.refused).toBe(1);
    expect(r.edges.inserted).toBe(0);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({
      table: FUNDING_EDGE_TABLE, key: "sigA", field: "amountLamports",
      existing: "3000000000", incoming: "3000000001",
    });
    // La ligne en base est INCHANGÉE — l'écrasement aurait mis 3000000001.
    expect(m.edges.get("sigA")!.amountLamports).toBe(3_000_000_000n);
    expect(m.inserts.edges).toBe(1);
  });

  it("MUTATION : même clé de relation, catégorie différente → REFUS TRACÉ", async () => {
    const m = memStore();
    const base = qualified();
    await persistFundingGraph({
      contextRef: CTX, dryRun: false, store: m.store, edges: [], qualifications: [base],
    });
    // Une requalification qui change la catégorie sous la MÊME règle.
    const divergent: QualifiedFundingRelationship = { ...base, category: "KNOWN_EXCHANGE" };
    const r = await persistFundingGraph({
      contextRef: CTX, dryRun: false, store: m.store, edges: [], qualifications: [divergent],
    });
    expect(r.relationships.refused).toBe(1);
    expect(r.conflicts[0]).toMatchObject({
      table: FUNDING_RELATIONSHIP_TABLE, field: "category",
      existing: "PRIVATE_SHARED_FUNDER", incoming: "KNOWN_EXCHANGE",
    });
    expect(m.rels.get(`${FUNDER}|${CTX}|funding-relationship/qualify@v1`)!.category)
      .toBe("PRIVATE_SHARED_FUNDER");
    expect(m.inserts.rels).toBe(1);
  });

  it("une clé différente n'est PAS une collision — deux contextes coexistent", async () => {
    const m = memStore();
    const q = qualified();
    await persistFundingGraph({ contextRef: CTX, dryRun: false, store: m.store, edges: [], qualifications: [q] });
    const r = await persistFundingGraph({ contextRef: "AUTRE-CAS", dryRun: false, store: m.store, edges: [], qualifications: [q] });
    expect(r.relationships.inserted).toBe(1);
    expect(r.conflicts).toEqual([]);
    expect(m.inserts.rels).toBe(2);
  });

  // ═══ MUTATION 3 — INFERENCE DANS inputNatures ══════════════════════════
  it("MUTATION : INFERENCE dans inputNatures est REFUSÉ à l'écriture", () => {
    const q = qualified();
    const mutant = {
      ...q,
      natureBasis: {
        ...q.natureBasis,
        basis: { ...q.natureBasis.basis, inputNatures: ["PRIMARY_OBSERVATION", "INFERENCE"] },
      },
    } as unknown as QualifiedFundingRelationship;
    expect(() => buildFundingRelationshipRow(mutant, CTX)).toThrow(/INFERENCE/);
  });

  // ═══ MUTATION 4 — BASIS ABSENT OU VIDE ═════════════════════════════════
  it("MUTATION : un basis vide échoue le prédicat auditable", () => {
    for (const bad of [{}, null, undefined, []]) {
      expect(satisfiesFundingRelationshipChecks({
        rowNature: "INFERENCE", natureBasis: bad, naturePolicyVersion: "v1",
      }).auditable).toBe(false);
    }
    expect(satisfiesFundingRelationshipChecks({
      rowNature: "INFERENCE", natureBasis: { inputs: {} }, naturePolicyVersion: "",
    }).auditable).toBe(false);
  });

  it("MUTATION : rowNature INFERENCE sur une arête échoue son CHECK declared", () => {
    expect(satisfiesFundingEdgeChecks({ rowNature: "INFERENCE" }).declared).toBe(false);
    expect(satisfiesFundingEdgeChecks({ rowNature: "PRIMARY_OBSERVATION" }).declared).toBe(true);
    expect(satisfiesFundingEdgeChecks({ rowNature: null }).declared).toBe(true);
  });

  it("MUTATION : rowNature PRIMARY_OBSERVATION sur une relation échoue declared", () => {
    expect(satisfiesFundingRelationshipChecks({
      rowNature: "PRIMARY_OBSERVATION", natureBasis: { a: 1 }, naturePolicyVersion: "v1",
    }).declared).toBe(false);
  });

  // ═══ MUTATION 5 — methodRef FAUX OU NON RÉSOLVABLE ═════════════════════
  it("MUTATION : un methodRef non résolvable est REFUSÉ", () => {
    const q = qualified();
    for (const bad of ["funding-relationship/qualify@v2", "inventé", "", "funding-relationship/qualify"]) {
      const mutant = {
        ...q,
        natureBasis: {
          ...q.natureBasis,
          basis: {
            ...q.natureBasis.basis,
            inputs: { ...q.natureBasis.basis.inputs, methodology: { methodRef: bad } },
          },
        },
      } as unknown as QualifiedFundingRelationship;
      expect(() => buildFundingRelationshipRow(mutant, CTX)).toThrow(/methodRef/);
    }
  });

  it("le methodRef écrit RÉSOUT sur l'artefact gelé", () => {
    const row = buildFundingRelationshipRow(qualified(), CTX);
    expect(row.methodRef).toBe("funding-relationship/qualify@v1");
    const r = resolveMethodRef(row.methodRef);
    expect(r).not.toBeNull();
    expect(r!.artifact.contentSha256).toBe(
      "ac21ecef037e865c18b9e9de66984b8eff101e51bf2bdf86445873e915421947",
    );
  });

  // ═══ MUTATION 6 — WRITE CONTOURNANT S6 ═════════════════════════════════
  it("MUTATION : aucun chemin d'écriture ne construit une nature hors du writer", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");
    const dir = join(__dirname, "..");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src.split("\n").filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      }).join("\n");
      // Une ligne portant rowNature n'est fabriquée QUE dans persistence.ts,
      // qui appelle assertNatureWritable. Ailleurs, ce serait un contournement.
      if (/rowNature:\s*"(PRIMARY_OBSERVATION|INFERENCE)"/.test(code) && f !== "types.ts") {
        expect(f).toBe("persistence.ts");
        expect(code).toContain("assertNatureWritable");
      }
      // Et le module ne parle jamais directement à la base.
      const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
      expect(imports).not.toMatch(/prisma|@\/lib\/db/i);
    }
  });

  it("un write réel sans store est REFUSÉ, jamais silencieusement dégradé en dry-run", async () => {
    await expect(persistFundingGraph({
      contextRef: CTX, dryRun: false, edges: [edge(S1, BIG, "sigA")], qualifications: [],
    })).rejects.toThrow(/sans store/);
  });

  it("dryRun est le DÉFAUT — le writer n'écrit pas sans qu'on le demande", async () => {
    const m = memStore();
    const r = await persistFundingGraph({
      contextRef: CTX, store: m.store,
      edges: [edge(S1, BIG, "sigA")], qualifications: [qualified()],
    });
    expect(r.dryRun).toBe(true);
    expect(r.edges.inserted).toBe(0);
    expect(m.inserts).toEqual({ edges: 0, rels: 0 });
    // …mais le PLAN est complet, et il a traversé S6.
    expect(r.plan.edges).toHaveLength(1);
    expect(r.plan.relationships).toHaveLength(1);
    expect(r.plan.relationships[0].rowNature).toBe("INFERENCE");
  });

  it("le plan du dry-run est celui que le réel écrirait", async () => {
    const m = memStore();
    const input = {
      contextRef: CTX, edges: [edge(S1, BIG, "sigA")], qualifications: [qualified()],
    };
    const dry = await persistFundingGraph(input);
    const real = await persistFundingGraph({ ...input, dryRun: false, store: m.store });
    expect(real.plan).toEqual(dry.plan);
  });
});

// --- G2 — LA COUVERTURE DE PREUVE D'ARÊTE ----------------------------------

describe("G2 - edgeProofCoverage est distincte de coverageIsFloor", () => {
  it("FLOOR signifie persistable < observé, et le DIT dans la ligne", () => {
    const c = buildEdgeProofCoverage(46, 12);
    expect(c).toEqual({
      observedEdgeCount: 46,
      persistablePrimaryObservationCount: 12,
      completeness: "FLOOR",
      reason: "PRIMARY_SIGNATURE_UNAVAILABLE",
      meaning: EDGE_PROOF_FLOOR_MEANING,
    });
    // ██ FLOOR n'affirme RIEN sur la réalité. ██
    expect(c.meaning).toContain("does NOT assert a lower bound on reality");
  });

  it("COMPLETE quand tout l'observé est persistable, et pas de motif", () => {
    const c = buildEdgeProofCoverage(12, 12);
    expect(c.completeness).toBe("COMPLETE");
    expect(c.reason).toBeNull();
  });

  it("persister plus qu'observé est REFUSÉ", () => {
    expect(() => buildEdgeProofCoverage(12, 46)).toThrow(/plus d'arêtes qu'on n'en a observées/);
  });

  // ═══ MUTATION — LES DEUX COUVERTURES CONFONDUES ════════════════════════
  it("MUTATION : l'annotation ne touche PAS coverageIsFloor", () => {
    const q = qualified(); // coverage.complete=false → coverageIsFloor=true
    const sansAnnot = buildFundingRelationshipRow(q, CTX);
    const avecAnnot = buildFundingRelationshipRow(q, CTX, buildEdgeProofCoverage(46, 12));
    // coverageIsFloor est INCHANGÉ : il parle des SUJETS, pas des arêtes.
    expect(sansAnnot.coverageIsFloor).toBe(true);
    expect(avecAnnot.coverageIsFloor).toBe(sansAnnot.coverageIsFloor);

    // Et le contraire : sujets couverts, arêtes incomplètes → deux valeurs
    // DIFFÉRENTES sur la même ligne. C'est ce qu'un drapeau unique ne pourrait
    // pas exprimer.
    const complet = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1, S2],
      edges: [edge(S1, BIG, "sigA"), edge(S2, BIG, "sigB")],
      coverage: { complete: true },
    });
    const row = buildFundingRelationshipRow(complet, CTX, buildEdgeProofCoverage(46, 12));
    expect(row.coverageIsFloor).toBe(false);
    const po = row.natureBasis.inputs.primaryObservations.find((p) => p.kind === "funding_edge")!;
    expect((po.refs as Record<string, unknown>).edgeProofCoverage).toMatchObject({
      completeness: "FLOOR",
    });
  });

  it("l'annotation vit dans le basis, structurée, et n'écrase rien", () => {
    const q = qualified();
    const row = buildFundingRelationshipRow(q, CTX, buildEdgeProofCoverage(46, 12));
    const po = row.natureBasis.inputs.primaryObservations.find((p) => p.kind === "funding_edge")!;
    const refs = po.refs as Record<string, unknown>;
    // Ce que la règle avait mis est toujours là.
    expect(refs.funder).toBe(FUNDER);
    expect(Array.isArray(refs.txSignatures)).toBe(true);
    // …et l'annotation s'y ajoute, en objet, pas en chaîne à interpréter.
    const c = refs.edgeProofCoverage as Record<string, unknown>;
    expect(typeof c).toBe("object");
    expect(c.observedEdgeCount).toBe(46);
    expect(c.persistablePrimaryObservationCount).toBe(12);
    expect(c.completeness).toBe("FLOOR");
    expect(c.reason).toBe("PRIMARY_SIGNATURE_UNAVAILABLE");
    // Le CHECK auditable reste satisfait.
    expect(satisfiesFundingRelationshipChecks(row)).toEqual({ declared: true, auditable: true });
  });

  it("sans annotation, le basis reste exactement celui du qualifieur", () => {
    const q = qualified();
    expect(buildFundingRelationshipRow(q, CTX).natureBasis).toEqual(q.natureBasis.basis);
  });

  it("persistFundingGraph propage l'annotation à toutes les qualifications", async () => {
    const r = await persistFundingGraph({
      contextRef: CTX, edges: [edge(S1, BIG, "sigA")],
      qualifications: [qualified()],
      edgeProofCoverage: buildEdgeProofCoverage(46, 12),
    });
    for (const row of r.plan.relationships) {
      const po = row.natureBasis.inputs.primaryObservations.find((p) => p.kind === "funding_edge")!;
      expect((po.refs as Record<string, unknown>).edgeProofCoverage).toBeDefined();
    }
  });
});
