// --- PACK C / G2 — LES GATES MUTATION DU WRITER ---------------------------
//
// ██ POURQUOI CES TESTS SIMULENT LE REGISTRE ██
//
// Les deux tables n'existent pas encore en base, donc le registre Data Nature
// ne peut pas les nommer : l'invariant I5 exige qu'il ne référence que des
// tables présentes au snapshot. Le writer, lui, refuse d'écrire sur une table
// non déclarée — et c'est le comportement voulu.
//
// Le premier test PROUVE ce refus. Les suivants injectent les deux entrées
// pour éprouver le chemin d'écriture tel qu'il sera APRÈS la migration. La
// simulation est déclarée, bornée à ce fichier, et défaite après.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NATURE_REGISTRY } from "@/lib/data-nature/registry";
import { resolveMethodRef } from "@/lib/methodology/registry";
import {
  CO_EXIT_QUALIFICATION_TABLE,
  CoExitNatureRegistryMismatchError,
  EXIT_EVENT_TABLE,
  OBSERVED_COUNTERPARTY_MEANING,
  SellProvenanceInvariantError,
  buildCoExitQualificationRow,
  buildExitEventRow,
  groupKeyOf,
  observeCoExit,
  persistCoExit,
  qualifyCoExit,
  satisfiesCoExitQualificationChecks,
  satisfiesExitEventChecks,
  summarizeCoverage,
  type CoExitGroup,
  type CoExitQualificationRow,
  type CoExitStore,
  type ExitCoverage,
  type ExitEvent,
  type ExitEventRow,
  type StoredCoExitQualification,
  type StoredExitEvent,
} from "../index";

const A = "WalletAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "WalletBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const MINT = "MintDddddddddddddddddddddddddddddddddddddd";
const WSOL = "So11111111111111111111111111111111111111112";
const CTX = "CASE-2025-VINE-001";
const T0 = 1_737_595_490;

const ev = (subject: string, at: number, p: Partial<ExitEvent> = {}): ExitEvent => ({
  subjectWallet: subject, mint: MINT, type: "SELL", amount: 100n,
  blockTimeSeconds: at, txSignature: `sig-${subject.slice(0, 7)}-${at}`,
  destination: null, venue: null,
  observedCounterpartyAsset: WSOL, observedCounterpartyAmount: 12,
  observedCounterpartyMeaning: OBSERVED_COUNTERPARTY_MEANING,
  rowNature: "PRIMARY_OBSERVATION",
  evidenceProvenance: { rule: "coordinated-exit/extract@v1",
    basis: "swap_counter_asset_same_tx", source: null, indexerType: "SWAP" },
  ...p,
});

const COVERAGE: ExitCoverage = summarizeCoverage(
  { subjectsAttempted: 15, subjectsCovered: 15, complete: true },
  { transactionsSeen: 3001, historyExhausted: true, censoredBy: null },
  { observedActCount: 458, materializedEventCount: 458, complete: true, reason: null },
);

function groupOf(events: ExitEvent[]): CoExitGroup {
  const r = observeCoExit({ events, windowSeconds: 60, coverage: COVERAGE });
  if (!r.observed) throw new Error("fixture");
  return r.groups[0];
}

// ═══ LE REFUS, SANS SIMULATION ════════════════════════════════════════════

describe("PACK C — le writer refuse une table non déclarée", () => {
  it("FAIL-CLOSED : sans entrée au registre, aucune ligne n'est construite", () => {
    // Aucune injection ici : c'est l'état RÉEL du dépôt.
    expect(NATURE_REGISTRY[EXIT_EVENT_TABLE]).toBeUndefined();
    expect(NATURE_REGISTRY[CO_EXIT_QUALIFICATION_TABLE]).toBeUndefined();
    expect(() => buildExitEventRow(ev(A, T0), CTX)).toThrow(CoExitNatureRegistryMismatchError);
    expect(() => buildExitEventRow(ev(A, T0), CTX)).toThrow(/UNCLASSIFIED/);
  });
});

// ═══ LE CHEMIN D'ÉCRITURE, REGISTRE SIMULÉ ════════════════════════════════

describe("PACK C — le writer, une fois les tables déclarées", () => {
  beforeAll(() => {
    NATURE_REGISTRY[EXIT_EVENT_TABLE] = {
      regime: "DECLARED", rows: 0, nature: "PRIMARY_OBSERVATION", stage: "S6",
      why: "simulation de test — l'entrée réelle est appliquée après la migration",
    };
    NATURE_REGISTRY[CO_EXIT_QUALIFICATION_TABLE] = {
      regime: "DECLARED", rows: 0, nature: "INFERENCE",
      basis: ["PRIMARY_OBSERVATION"], stage: "S6",
      why: "simulation de test — l'entrée réelle est appliquée après la migration",
    };
  });
  afterAll(() => {
    delete NATURE_REGISTRY[EXIT_EVENT_TABLE];
    delete NATURE_REGISTRY[CO_EXIT_QUALIFICATION_TABLE];
  });

  const qual = () => {
    const g = groupOf([ev(A, T0), ev(B, T0 + 12)]);
    return { group: g, characterisation: qualifyCoExit({ group: g, coverage: COVERAGE }) };
  };

  function memStore() {
    const events = new Map<string, StoredExitEvent>();
    const quals = new Map<string, StoredCoExitQualification>();
    const inserts = { events: 0, quals: 0 };
    const store: CoExitStore = {
      async findExitEvent(sig) { return events.get(sig) ?? null; },
      async insertExitEvent(row: ExitEventRow) {
        if (events.has(row.txSignature)) throw new Error("P2002 unique txSignature");
        events.set(row.txSignature, { subjectWallet: row.subjectWallet, mint: row.mint,
          type: row.type, amount: row.amount, blockTimeSeconds: row.blockTimeSeconds });
        inserts.events++;
      },
      async findQualification(k) { return quals.get(`${k.contextRef}|${k.groupKey}|${k.methodRef}`) ?? null; },
      async insertQualification(row: CoExitQualificationRow) {
        const k = `${row.contextRef}|${row.groupKey}|${row.methodRef}`;
        if (quals.has(k)) throw new Error("P2002 unique");
        quals.set(k, { category: row.category, distinctSubjects: row.distinctSubjects,
          pairsWithinWindow: row.pairsWithinWindow, spanSeconds: row.spanSeconds });
        inserts.quals++;
      },
    };
    return { store, events, quals, inserts };
  }

  it("les natures et les CHECK sont satisfaits", () => {
    const e = buildExitEventRow(ev(A, T0), CTX);
    expect(e.rowNature).toBe("PRIMARY_OBSERVATION");
    expect(satisfiesExitEventChecks(e).declared).toBe(true);
    expect(typeof e.amount).toBe("bigint");
    expect(typeof e.observedCounterpartyAmount).toBe("bigint");

    const { characterisation, group } = qual();
    const q = buildCoExitQualificationRow(characterisation, group, CTX);
    expect(q.rowNature).toBe("INFERENCE");
    expect(satisfiesCoExitQualificationChecks(q)).toEqual({ declared: true, auditable: true });
    expect(q.category).toBe("NARROW_WINDOW_CLUSTER");
    expect(resolveMethodRef(q.methodRef)).not.toBeNull();
    expect(q.naturePolicyVersion.length).toBeGreaterThan(0);
  });

  // ═══ MUTATION 1 — DUPLICATION AU REJEU ═══════════════════════════════════
  it("MUTATION : rejouer n'insère rien de plus", async () => {
    const m = memStore();
    const q = qual();
    const input = { contextRef: CTX, dryRun: false, store: m.store,
      events: [ev(A, T0), ev(B, T0 + 12)], qualifications: [q] };
    const first = await persistCoExit(input);
    expect(first.events.inserted).toBe(2);
    expect(first.qualifications.inserted).toBe(1);

    const second = await persistCoExit(input);
    expect(second.events.inserted).toBe(0);
    expect(second.events.alreadyPresent).toBe(2);
    expect(second.qualifications.inserted).toBe(0);
    expect(second.qualifications.alreadyPresent).toBe(1);
    expect(second.conflicts).toEqual([]);
    expect(m.inserts).toEqual({ events: 2, quals: 1 }); // 🔴 si un insert de plus
  });

  // ═══ MUTATION 2 — ÉCRASEMENT SILENCIEUX ═════════════════════════════════
  it("MUTATION : même signature, montant différent → REFUS TRACÉ", async () => {
    const m = memStore();
    await persistCoExit({ contextRef: CTX, dryRun: false, store: m.store,
      events: [ev(A, T0)], qualifications: [] });
    const r = await persistCoExit({ contextRef: CTX, dryRun: false, store: m.store,
      events: [ev(A, T0, { amount: 999n })], qualifications: [] });
    expect(r.events.refused).toBe(1);
    expect(r.events.inserted).toBe(0);
    expect(r.conflicts[0]).toMatchObject({ table: EXIT_EVENT_TABLE, field: "amount",
      existing: "100", incoming: "999" });
    expect(m.events.get(`sig-${A.slice(0, 7)}-${T0}`)!.amount).toBe(100n); // inchangé
    expect(m.inserts.events).toBe(1);
  });

  it("MUTATION : même groupe, dimensions différentes → REFUS TRACÉ", async () => {
    const m = memStore();
    const q = qual();
    await persistCoExit({ contextRef: CTX, dryRun: false, store: m.store, events: [], qualifications: [q] });
    const divergent = { group: q.group, characterisation: { ...q.characterisation,
      dimensions: { ...q.characterisation.dimensions, distinctSubjects: 99 } } };
    const r = await persistCoExit({ contextRef: CTX, dryRun: false, store: m.store,
      events: [], qualifications: [divergent] });
    expect(r.qualifications.refused).toBe(1);
    expect(r.conflicts[0]).toMatchObject({ field: "distinctSubjects", existing: "2", incoming: "99" });
    expect(m.inserts.quals).toBe(1);
  });

  it("la clé de groupe est DÉRIVÉE, donc stable au rejeu", () => {
    const g = groupOf([ev(A, T0), ev(B, T0 + 12)]);
    expect(groupKeyOf(g)).toBe(`${MINT}@${T0}`);
    expect(groupKeyOf(g)).toBe(groupKeyOf(g)); // 🔴 si un compteur l'avait produite
  });

  // ═══ MUTATION 3 — INFERENCE DANS inputNatures ═══════════════════════════
  it("MUTATION : INFERENCE dans inputNatures est REFUSÉ", () => {
    const { characterisation, group } = qual();
    const mutant = { ...characterisation, natureBasis: { ...characterisation.natureBasis,
      basis: { ...characterisation.natureBasis.basis,
        inputNatures: ["PRIMARY_OBSERVATION", "INFERENCE"] } } } as never;
    expect(() => buildCoExitQualificationRow(mutant, group, CTX)).toThrow(/INFERENCE/);
  });

  // ═══ MUTATION 4 — BASIS ABSENT / methodRef FAUX ═════════════════════════
  it("MUTATION : un basis vide échoue le prédicat auditable", () => {
    for (const bad of [{}, null, undefined, []]) {
      expect(satisfiesCoExitQualificationChecks({ rowNature: "INFERENCE",
        natureBasis: bad, naturePolicyVersion: "v1" }).auditable).toBe(false);
    }
    expect(satisfiesCoExitQualificationChecks({ rowNature: "INFERENCE",
      natureBasis: { a: 1 }, naturePolicyVersion: "" }).auditable).toBe(false);
  });

  it("MUTATION : un methodRef non résolvable est REFUSÉ", () => {
    const { characterisation, group } = qual();
    for (const bad of ["coordinated-exit/qualify@v2", "inventé", "", "coordinated-exit/qualify"]) {
      const mutant = { ...characterisation, natureBasis: { ...characterisation.natureBasis,
        basis: { ...characterisation.natureBasis.basis,
          inputs: { ...characterisation.natureBasis.basis.inputs, methodology: { methodRef: bad } } } },
      } as never;
      expect(() => buildCoExitQualificationRow(mutant, group, CTX)).toThrow(/methodRef/);
    }
  });

  // ═══ MUTATION 5 — WRITE CONTOURNANT S6 ══════════════════════════════════
  it("MUTATION : la nature n'est fabriquée QUE dans persistence.ts, qui appelle S6", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");
    const dir = join(__dirname, "..");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src.split("\n").filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      }).join("\n");
      if (/rowNature:\s*"INFERENCE"/.test(code)) {
        expect(f).toBe("persistence.ts");
        expect(code).toContain("assertNatureWritable");
      }
      const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
      expect(imports).not.toMatch(/prisma|@prisma\/client|helius|fetch/i); // 🔴
    }
  });

  it("un write réel sans store est REFUSÉ, jamais dégradé en dry-run", async () => {
    await expect(persistCoExit({ contextRef: CTX, dryRun: false,
      events: [ev(A, T0)], qualifications: [] })).rejects.toThrow(/sans store/);
  });

  it("dryRun est le DÉFAUT, et son plan est celui du réel", async () => {
    const m = memStore();
    const q = qual();
    const input = { contextRef: CTX, events: [ev(A, T0), ev(B, T0 + 12)], qualifications: [q] };
    const dry = await persistCoExit({ ...input, store: m.store });
    expect(dry.dryRun).toBe(true);
    expect(m.inserts).toEqual({ events: 0, quals: 0 });
    const real = await persistCoExit({ ...input, dryRun: false, store: m.store });
    expect(real.plan).toEqual(dry.plan);
  });

  // ═══ MUTATION 6 — DESTINATION PROMUE EN IDENTITÉ SÉMANTIQUE ════════════
  it("MUTATION : la destination est une ADRESSE, jamais un label", () => {
    const DEST = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
    const row = buildExitEventRow(ev(A, T0, { destination: DEST, venue: "RAYDIUM" }), CTX);
    expect(row.destination).toBe(DEST); // recopiée telle quelle
    // bigint : JSON.stringify le refuse. Le convertir plutôt que l'omettre —
    // un champ absent du scan serait un champ non vérifié.
    // Et la chaîne de sens contient « exchange » au sens d'ÉCHANGE, pas de
    // plateforme : la retirer vise l'identité sémantique plutôt que le mot.
    const s = JSON.stringify(row, (_k, v) => (typeof v === "bigint" ? `${v}n` : v))
      .toLowerCase()
      .split(OBSERVED_COUNTERPARTY_MEANING.toLowerCase()).join("");
    for (const label of ["exchange", "treasury", "pool", "cex", "binance", "coinbase",
                         "team", "project", "deployer", "insider"]) {
      expect(s).not.toContain(label); // 🔴 si une identité s'y glissait
    }
    // Et la ligne ne porte aucun champ de label.
    expect(Object.keys(row)).not.toContain("destinationLabel");
    expect(Object.keys(row)).not.toContain("destinationType");
  });

  // ═══ MUTATION 7 — observedCounterpartyAmount SOMMÉ / P&L ═══════════════
  it("MUTATION : aucune somme de contrepartie n'est calculée", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const exe = readFileSync(join(__dirname, "..", "persistence.ts"), "utf8")
      .split("\n").filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      }).join("\n")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``");
    // Le champ est RECOPIÉ, jamais agrégé.
    expect(exe).not.toMatch(/reduce|\bsum\b|totalCounterparty|pnl|profitAndLoss/i); // 🔴

    // …et la ligne de qualification ne porte aucun montant de contrepartie.
    const { characterisation, group } = qual();
    const q = buildCoExitQualificationRow(characterisation, group, CTX);
    const keys = new Set<string>();
    const walk = (o: unknown) => { if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) { keys.add(k); walk(v); } } };
    walk(q);
    expect(keys.has("observedCounterpartyAmount")).toBe(false); // 🔴
    expect(keys.has("observedCounterpartyAsset")).toBe(false);
  });

  // ═══ L'INVARIANT SELL, À LA FRONTIÈRE D'ÉCRITURE ═══════════════════════
  it("MUTATION : un SELL sans provenance démontrée ne s'écrit PAS", () => {
    const faux = ev(A, T0, { observedCounterpartyAsset: null,
      evidenceProvenance: { rule: "coordinated-exit/extract@v1",
        basis: "counterparty_rejected_rent_recovery", source: null, indexerType: "CLOSE_ACCOUNT" } });
    expect(() => buildExitEventRow(faux, CTX)).toThrow(SellProvenanceInvariantError);
  });

  it("le démenti NARROW_WINDOW_CLUSTER ≠ COORDINATED_EXIT est PERSISTÉ", () => {
    const { characterisation, group } = qual();
    const q = buildCoExitQualificationRow(characterisation, group, CTX);
    expect(q.natureBasis.reservations.join(" "))
      .toContain("NARROW_WINDOW_CLUSTER IS NOT COORDINATED_EXIT");
    expect(q.category).not.toBe("COORDINATED_EXIT");
  });
});
