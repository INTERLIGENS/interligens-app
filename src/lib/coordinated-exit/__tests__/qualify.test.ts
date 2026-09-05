// --- PACK B / G2 — LES GATES MUTATION DE LA CARACTÉRISATION ---------------

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CATEGORY_MEANING,
  COORDINATED_EXIT_METHOD_REF,
  OBSERVED_COUNTERPARTY_MEANING,
  SELL_PROVENANCE_INVARIANT,
  SellProvenanceInvariantError,
  assertSellProvenanceInvariant,
  observeCoExit,
  qualifyCoExit,
  summarizeCoverage,
  type CoExitGroup,
  type ExitCoverage,
  type ExitEvent,
} from "../index";
import { resolveMethodRef } from "@/lib/methodology/registry";
import {
  COORDINATED_EXIT_V1,
  COORDINATED_EXIT_V1_SHA256,
  serializeArtifactBody,
} from "@/lib/methodology/artifact";


/**
 * Le code EXÉCUTABLE d'un fichier : sans commentaires, et sans le contenu des
 * littéraux de chaîne.
 *
 * Retirer les chaînes n'est pas une facilité : les réserves NOMMENT ce qu'elles
 * refusent (« observedCounterpartyAmount IS NEVER SUMMED »), et un scan naïf
 * rougirait sur la phrase qui interdit l'usage au lieu de l'usage. Ce qu'on
 * cherche est un IDENTIFIANT lu ou écrit, pas un mot prononcé.
 */
function executableCode(path: string): string {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

const A = "WalletAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "WalletBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const MINT = "MintDddddddddddddddddddddddddddddddddddddd";
const WSOL = "So11111111111111111111111111111111111111112";
const T0 = 1_737_595_490;

const ev = (subject: string, at: number, p: Partial<ExitEvent> = {}): ExitEvent => ({
  subjectWallet: subject, mint: MINT, type: "SELL", amount: 100n,
  blockTimeSeconds: at, txSignature: `sig-${subject.slice(0, 7)}-${at}`,
  destination: null, venue: null,
  observedCounterpartyAsset: WSOL, observedCounterpartyAmount: 12,
  observedCounterpartyMeaning: OBSERVED_COUNTERPARTY_MEANING,
  rowNature: "PRIMARY_OBSERVATION",
  evidenceProvenance: {
    rule: "coordinated-exit/extract@v1", basis: "swap_counter_asset_same_tx",
    source: null, indexerType: "SWAP",
  },
  ...p,
});

const COMPLETE: ExitCoverage = summarizeCoverage(
  { subjectsAttempted: 15, subjectsCovered: 15, complete: true },
  { transactionsSeen: 3001, historyExhausted: true, censoredBy: null },
  { observedActCount: 458, materializedEventCount: 458, complete: true, reason: null },
);
const CENSORED: ExitCoverage = summarizeCoverage(
  { subjectsAttempted: 15, subjectsCovered: 9, complete: false },
  { transactionsSeen: 200, historyExhausted: false, censoredBy: "page_cap" },
  { observedActCount: 46, materializedEventCount: 12, complete: false, reason: "PRIMARY_SIGNATURE_UNAVAILABLE" },
);

function groupOf(events: ExitEvent[], coverage = COMPLETE): CoExitGroup {
  const r = observeCoExit({ events, windowSeconds: 60, coverage });
  if (!r.observed) throw new Error("le fixture doit produire un groupe");
  return r.groups[0];
}

describe("PACK B / G1 — l'artefact est gelé et résout", () => {
  it("coordinated-exit/qualify@v1 résout", () => {
    const r = resolveMethodRef(COORDINATED_EXIT_METHOD_REF);
    expect(r).not.toBeNull();
    expect(r!.componentId).toBe("qualify");
    expect(r!.artifact.version).toBe("v1");
  });

  it("trois sha concordants, miroir octet-pour-octet", () => {
    const md = readFileSync(join(process.cwd(), "content/methodologies/coordinated-exit/v1.md"), "utf8");
    const frozen = md.slice(md.indexOf("## qualify ")).replace(/\n+$/, "");
    const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
    const declared = /contentSha256: ([0-9a-f]{64})/.exec(md)?.[1];
    expect(declared).toBe(sha(frozen));
    expect(sha(serializeArtifactBody(COORDINATED_EXIT_V1))).toBe(declared);
    expect(COORDINATED_EXIT_V1_SHA256).toBe(declared);
    expect(md).toContain("status: FROZEN");
  });

  it("l'artefact PORTE l'invariant structurel et la non-équivalence", () => {
    const md = readFileSync(join(process.cwd(), "content/methodologies/coordinated-exit/v1.md"), "utf8");
    expect(md).toContain("SELL requires demonstrated transactional counterparty provenance");
    expect(md).toContain("Rent recovery is not sale consideration");
    expect(md).toContain("NARROW_WINDOW_CLUSTER IS NOT COORDINATED_EXIT");
    expect(md).toContain("observedCounterpartyAmount IS NEVER SUMMED");
  });
});

describe("PACK B / R1 — l'invariant SELL est exécutable, pas documentaire", () => {
  it("MUTATION : un SELL sans provenance démontrée est REFUSÉ, pas dégradé", () => {
    const faux = ev(A, T0, {
      observedCounterpartyAsset: null,
      evidenceProvenance: { rule: "coordinated-exit/extract@v1",
        basis: "counterparty_rejected_rent_recovery", source: null, indexerType: "CLOSE_ACCOUNT" },
    });
    expect(() => assertSellProvenanceInvariant([faux])).toThrow(SellProvenanceInvariantError);
    // …et il ne peut pas entrer dans une caractérisation.
    const g = groupOf([ev(A, T0), ev(B, T0 + 12)]);
    expect(() => qualifyCoExit({ group: { ...g, events: [...g.events, faux] }, coverage: COMPLETE }))
      .toThrow(SellProvenanceInvariantError);
  });

  it("le message porte le texte exact de l'invariant ratifié", () => {
    expect(SELL_PROVENANCE_INVARIANT).toContain("SELL requires demonstrated transactional counterparty provenance");
    expect(SELL_PROVENANCE_INVARIANT).toContain("Atomic co-occurrence alone is insufficient");
    expect(SELL_PROVENANCE_INVARIANT).toContain("Rent recovery is not sale consideration");
    try {
      assertSellProvenanceInvariant([ev(A, T0, { observedCounterpartyAsset: null })]);
      expect.unreachable("aurait dû lever");
    } catch (e) {
      expect((e as Error).message).toContain("Rent recovery is not sale consideration");
    }
  });

  it("un OUTGOING_TRANSFER sans contrepartie ne déclenche pas l'invariant", () => {
    const t = ev(A, T0, { type: "OUTGOING_TRANSFER", observedCounterpartyAsset: null,
      observedCounterpartyAmount: null, observedCounterpartyMeaning: null,
      evidenceProvenance: { rule: "coordinated-exit/extract@v1",
        basis: "token_leaves_wallet_no_counter_asset", source: null, indexerType: "TRANSFER" } });
    expect(() => assertSellProvenanceInvariant([t])).not.toThrow();
  });
});

describe("PACK B / G2 — les gates de la caractérisation", () => {
  const base = () => groupOf([ev(A, T0), ev(B, T0 + 12)]);

  // ═══ MUTATION — UN SCORE ÉMIS ══════════════════════════════════════════
  it("MUTATION : aucun score ni verdict ne sort du qualifieur", () => {
    const c = qualifyCoExit({ group: base(), coverage: COMPLETE });
    // Les réserves NOMMENT ce qu'elles refusent — les retirer avant de scanner.
    const denials = c.natureBasis.basis.reservations;
    let s = JSON.stringify(c, (_k, v) => (typeof v === "bigint" ? `${v}n` : v)).toLowerCase();
    for (const d of [...denials, CATEGORY_MEANING, OBSERVED_COUNTERPARTY_MEANING,
                     "coordinated-exit/qualify@v1", "coordinated-exit/extract@v1", "coordinated-exit@v1"]) {
      s = s.split(d.toLowerCase()).join("");
    }
    for (const forbidden of ["score", "risk", "severity", "verdict", "guilt", "dump",
                             "rug", "scam", "intent", "culpab", "suspici"]) {
      expect(s).not.toContain(forbidden); // 🔴
    }
  });

  // ═══ MUTATION — CLUSTER ASSIMILÉ À COORDINATED_EXIT ════════════════════
  it("MUTATION : la catégorie ne s'appelle ni ne signifie COORDINATED_EXIT", () => {
    const c = qualifyCoExit({ group: base(), coverage: COMPLETE });
    expect(c.category).toBe("NARROW_WINDOW_CLUSTER");
    expect(c.category).not.toBe("COORDINATED_EXIT"); // 🔴
    // Le démenti VOYAGE avec la catégorie.
    expect(c.categoryMeaning).toContain("IT IS NOT COORDINATED_EXIT");
    expect(c.natureBasis.basis.reservations.join(" "))
      .toContain("NARROW_WINDOW_CLUSTER IS NOT COORDINATED_EXIT");
  });

  it("MUTATION : la proximité seule n'affirme rien sur l'intention", () => {
    // Deux sujets à 0 seconde d'écart : le cas le plus serré possible.
    const c = qualifyCoExit({ group: groupOf([ev(A, T0), ev(B, T0)]), coverage: COMPLETE });
    expect(c.dimensions.canonicalProximity.minGapSeconds).toBe(0);
    // …et la sortie reste exactement la même catégorie, sans mot ajouté.
    expect(c.category).toBe("NARROW_WINDOW_CLUSTER");
    expect(Object.keys(c)).toEqual(
      ["ruleVersion", "category", "categoryMeaning", "mint", "dimensions", "natureBasis"]);
  });

  // ═══ MUTATION — VENUE / DESTINATION INVENTÉS ═══════════════════════════
  it("MUTATION : un venue non unanime n'est PAS nommé", () => {
    const partiel = qualifyCoExit({
      group: groupOf([ev(A, T0, { venue: "RAYDIUM" }), ev(B, T0 + 12, { venue: null })]),
      coverage: COMPLETE,
    });
    expect(partiel.dimensions.demonstratedVenue).toBeNull(); // 🔴 si RAYDIUM

    const divergent = qualifyCoExit({
      group: groupOf([ev(A, T0, { venue: "RAYDIUM" }), ev(B, T0 + 12, { venue: "JUPITER" })]),
      coverage: COMPLETE,
    });
    expect(divergent.dimensions.demonstratedVenue).toBeNull(); // 🔴 si le majoritaire gagnait

    const unanime = qualifyCoExit({
      group: groupOf([ev(A, T0, { venue: "RAYDIUM" }), ev(B, T0 + 12, { venue: "RAYDIUM" })]),
      coverage: COMPLETE,
    });
    expect(unanime.dimensions.demonstratedVenue).toBe("RAYDIUM");
  });

  // ═══ MUTATION — MATERIALITY AFFIRMÉE MESURÉE ═══════════════════════════
  it("MUTATION : NOT_MEASURABLE est le défaut et le reste", () => {
    const c = qualifyCoExit({ group: base(), coverage: COMPLETE });
    expect(c.dimensions.materiality.status).toBe("NOT_MEASURABLE"); // 🔴 si MEASURED
    expect(c.dimensions.materiality.reason).toContain("not demonstrable");
    expect(c.natureBasis.basis.reservations.join(" ")).toContain("MATERIALITY NOT_MEASURABLE");
    expect(c.natureBasis.basis.reservations.join(" ")).toContain("no material-exit claim");
  });

  // ═══ MUTATION — observedCounterpartyAmount UTILISÉ POUR UN TOTAL ═══════
  it("MUTATION : le qualifieur ne LIT PAS observedCounterpartyAmount", () => {
    const code = executableCode(join(__dirname, "..", "qualify.ts"));
    expect(code).not.toMatch(/observedCounterpartyAmount/); // 🔴
    expect(code).not.toMatch(/\bproceeds\b|\bpnl\b|profitAndLoss|totalReceived/i);
  });

  it("MUTATION : aucun montant de contrepartie ne sort dans la caractérisation", () => {
    const c = qualifyCoExit({
      group: groupOf([ev(A, T0, { observedCounterpartyAmount: 777_777 }),
                      ev(B, T0 + 12, { observedCounterpartyAmount: 888_888 })]),
      coverage: COMPLETE,
    });
    const s = JSON.stringify(c);
    expect(s).not.toContain("777777"); // 🔴
    expect(s).not.toContain("888888");
    expect(s).not.toContain("1666665"); // la somme, encore moins
  });

  // ═══ MUTATION — COMPOSITION MAL COMPTÉE ════════════════════════════════
  it("MUTATION : SELL et OUTGOING_TRANSFER sont comptés SÉPARÉMENT", () => {
    const t = ev(B, T0 + 12, { type: "OUTGOING_TRANSFER", observedCounterpartyAsset: null,
      observedCounterpartyAmount: null, observedCounterpartyMeaning: null,
      evidenceProvenance: { rule: "coordinated-exit/extract@v1",
        basis: "token_leaves_wallet_no_counter_asset", source: null, indexerType: "TRANSFER" } });
    const c = qualifyCoExit({ group: groupOf([ev(A, T0), t]), coverage: COMPLETE });
    expect(c.dimensions.composition).toEqual({ sell: 1, outgoingTransfer: 1, total: 2 });
    expect(c.dimensions.composition.sell + c.dimensions.composition.outgoingTransfer)
      .toBe(c.dimensions.composition.total); // 🔴 si un type était avalé par l'autre
  });

  // ═══ MUTATION — COUVERTURE CENSURÉE RAPPORTÉE COMPLÈTE ════════════════
  it("MUTATION : une couverture censurée reste censurée, et le DIT", () => {
    const c = qualifyCoExit({ group: base(), coverage: CENSORED });
    expect(c.dimensions.coverage.anyIncomplete).toBe(true); // 🔴
    expect(c.dimensions.coverage.subjects.complete).toBe(false);
    expect(c.dimensions.coverage.transactions.historyExhausted).toBe(false);
    expect(c.dimensions.coverage.primaryEvidence.complete).toBe(false);
    expect(c.natureBasis.basis.reservations.join(" ")).toContain("COVERAGE INCOMPLETE");
    expect(c.natureBasis.basis.reservations.join(" ")).toContain("FLOOR");
  });

  // ═══ MUTATION — NATURE / methodRef ═════════════════════════════════════
  it("MUTATION : nature INFERENCE, methodRef résolvable, INFERENCE jamais en base", () => {
    const c = qualifyCoExit({ group: base(), coverage: COMPLETE });
    expect(c.natureBasis.nature).toBe("INFERENCE");
    expect(c.natureBasis.basis.inputNatures).toContain("PRIMARY_OBSERVATION");
    expect(c.natureBasis.basis.inputNatures).not.toContain("INFERENCE"); // 🔴
    expect(c.natureBasis.basis.inputs.methodology.methodRef).toBe(COORDINATED_EXIT_METHOD_REF);
    expect(resolveMethodRef(c.natureBasis.basis.inputs.methodology.methodRef)).not.toBeNull();
    expect(c.natureBasis.policyVersion).toBe("coordinated-exit@v1");
  });

  it("la relation temporelle entre au basis comme DÉRIVÉE, avec ses écarts", () => {
    const c = qualifyCoExit({ group: base(), coverage: COMPLETE });
    const po = c.natureBasis.basis.inputs.primaryObservations;
    expect(po.map((p) => p.kind)).toEqual(["exit_event", "derived_temporal_relation"]);
    expect((po[1].refs as Record<string, unknown>).gapsSeconds).toEqual([12]);
    // Les signatures voyagent : la caractérisation est recontrôlable sur ses pièces.
    expect((po[0].refs as Record<string, unknown>).txSignatures).toHaveLength(2);
  });

  it("les 7 dimensions sont TOUTES présentes", () => {
    const c = qualifyCoExit({ group: base(), coverage: COMPLETE });
    expect(Object.keys(c.dimensions).sort()).toEqual([
      "canonicalProximity", "composition", "coverage", "demonstratedDestination",
      "demonstratedVenue", "distinctSubjects", "materiality", "spanSeconds",
    ]);
  });

  it("span et proximité sont rapportés SÉPARÉMENT — le chaînage étire", () => {
    const g = groupOf([ev(A, T0), ev(B, T0 + 50), ev(A, T0 + 100)]);
    const c = qualifyCoExit({ group: g, coverage: COMPLETE });
    expect(c.dimensions.spanSeconds).toBe(100);
    expect(c.dimensions.canonicalProximity.windowSeconds).toBe(60);
    // Aucune paire retenue au-delà de la fenêtre, span plus large ou non.
    expect(c.dimensions.canonicalProximity.minGapSeconds).toBeLessThanOrEqual(60);
  });

  it("la caractérisation est déterministe", () => {
    const g = base();
    expect(qualifyCoExit({ group: g, coverage: COMPLETE }))
      .toEqual(qualifyCoExit({ group: g, coverage: COMPLETE }));
  });

  it("le module reste pur : ni prisma, ni réseau", () => {
    const dir = join(__dirname, "..");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const imports = readFileSync(join(dir, f), "utf8")
        .split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
      expect(imports).not.toMatch(/prisma|@prisma\/client|helius|fetch|node-fetch/i);
    }
  });
});
