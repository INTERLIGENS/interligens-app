// --- BUILD 6 / PACK C — LE WRITER -----------------------------------------
//
// ██ LE STORE EST INJECTÉ. ██ Ce module n'importe ni prisma, ni réseau —
// l'invariant de frontière du module l'exige, et un writer qui tient sa base
// par un paramètre se prouve en dry-run sans qu'aucune ligne ne parte.
//
// ─── S6 N'EST PAS CONTOURNABLE ───────────────────────────────────────────
//
// Toute nature écrite passe par `assertNatureWritable`. Un INSERT qui la
// contournerait écrirait une nature que le registre n'a pas sanctionnée, et
// l'enforcement Data Nature ne servirait plus à rien puisqu'il suffirait de ne
// pas l'appeler.
//
// ─── UNE COLLISION N'EST PAS UN ÉCRASEMENT ───────────────────────────────
//
// Même clé, même contenu : rien à faire. C'est l'idempotence, et rejouer une
// extraction doit être sans effet. Même clé, contenu DIFFÉRENT : refus tracé.
// Écraser en silence ferait disparaître la divergence au moment précis où elle
// est visible.

import {
  assertNatureWritable,
  type NatureWriteTarget,
} from "@/lib/data-nature/writeGuard";
import { natureForTable } from "@/lib/data-nature/registry";
import type { InferenceEnvelopeV2 } from "@/lib/data-nature/inferenceEnvelope";
import type { CoExitGroup } from "./coExit";
import {
  COORDINATED_EXIT_METHOD_REF,
  COORDINATED_EXIT_POLICY_VERSION,
  assertSellProvenanceInvariant,
  type CoExitCharacterisation,
} from "./qualify";
import type { EvidenceProvenance, ExitEvent } from "./types";

export const EXIT_EVENT_TABLE = "ExitEvent";
export const CO_EXIT_QUALIFICATION_TABLE = "CoExitQualification";

// ═══ LES LIGNES ═══════════════════════════════════════════════════════════

export interface ExitEventRow {
  subjectWallet: string;
  mint: string;
  type: "OUTGOING_TRANSFER" | "SELL";
  amount: bigint;
  blockTimeSeconds: number;
  txSignature: string;
  observedCounterpartyAsset: string | null;
  /** BigInt, comme `amount` : une quantité de preuve ne s'arrondit pas. */
  observedCounterpartyAmount: bigint | null;
  observedCounterpartyMeaning: string | null;
  destination: string | null;
  venue: string | null;
  evidenceProvenance: EvidenceProvenance;
  rowNature: "PRIMARY_OBSERVATION";
  sourceContext: string;
}

export interface CoExitQualificationRow {
  contextRef: string;
  groupKey: string;
  mint: string;
  category: "NARROW_WINDOW_CLUSTER";
  distinctSubjects: number;
  pairsWithinWindow: number;
  windowSeconds: number;
  minGapSeconds: number | null;
  medianGapSeconds: number | null;
  spanSeconds: number;
  demonstratedVenue: string | null;
  demonstratedDestination: string | null;
  sellCount: number;
  outgoingCount: number;
  coverageAnyIncomplete: boolean;
  materialityStatus: "MEASURED" | "NOT_MEASURABLE";
  evidence: {
    subjects: string[];
    txSignatures: string[];
    gapsSeconds: number[];
    earliestBlockTimeSeconds: number;
    latestBlockTimeSeconds: number;
  };
  rowNature: "INFERENCE";
  natureBasis: InferenceEnvelopeV2["basis"];
  naturePolicyVersion: string;
  methodRef: string;
}

// ═══ LES CHECK DE LA BASE, EXÉCUTABLES CÔTÉ APPLICATION ═══════════════════

/** `exitevent_rownature_declared_chk`. Une observation EST sa propre piste. */
export function satisfiesExitEventChecks(row: { rowNature?: unknown }): { declared: boolean } {
  const n = row.rowNature;
  return { declared: n == null || n === "PRIMARY_OBSERVATION" };
}

/** `coexitqual_rownature_declared_chk` + `coexitqual_rownature_auditable_chk`. */
export function satisfiesCoExitQualificationChecks(row: {
  rowNature?: unknown;
  natureBasis?: unknown;
  naturePolicyVersion?: unknown;
}): { declared: boolean; auditable: boolean } {
  const n = row.rowNature;
  if (n == null) return { declared: true, auditable: true };
  const v = row.naturePolicyVersion;
  const b = row.natureBasis;
  return {
    declared: n === "INFERENCE",
    auditable:
      typeof v === "string" && v.length > 0 &&
      b != null && typeof b === "object" && !Array.isArray(b) &&
      Object.keys(b as object).length > 0,
  };
}

export class CoExitNatureRegistryMismatchError extends Error {
  constructor(table: string, expected: string, got: unknown) {
    super(
      `[coordinated-exit] ${table} — le registre Data Nature déclare ${String(got)}, ` +
        `le writer voulait écrire ${expected}. L'écriture s'arrête : choisir en silence ` +
        `ferait porter à la ligne une nature que le registre ne sanctionne pas.`,
    );
    this.name = "CoExitNatureRegistryMismatchError";
  }
}

/**
 * L'identité d'un groupe DANS son contexte.
 *
 * Dérivée du mint et de son instant le plus ancien — deux valeurs que le groupe
 * porte déjà. Un identifiant tiré d'un compteur aurait changé d'un run à
 * l'autre, et l'idempotence se serait évaporée au premier rejeu.
 */
export function groupKeyOf(group: CoExitGroup): string {
  return `${group.mint}@${group.earliestBlockTimeSeconds}`;
}

// ═══ CONSTRUCTION — LA NATURE PASSE PAR S6 ════════════════════════════════

export function buildExitEventRow(
  e: ExitEvent,
  sourceContext: string,
  where = "buildExitEventRow",
): ExitEventRow {
  // L'invariant R1, à la frontière d'écriture : une vente non démontrée ne
  // s'écrit pas. La persister lui donnerait l'autorité que la preuve lui refuse.
  assertSellProvenanceInvariant([e]);

  const declared = natureForTable(EXIT_EVENT_TABLE);
  if (declared !== "PRIMARY_OBSERVATION") {
    throw new CoExitNatureRegistryMismatchError(EXIT_EVENT_TABLE, "PRIMARY_OBSERVATION", declared);
  }
  const target: NatureWriteTarget = { ref: `${EXIT_EVENT_TABLE}:${e.txSignature}` };
  const nature = assertNatureWritable(target, { nature: "PRIMARY_OBSERVATION", scope: "row" }, where);
  if (nature !== "PRIMARY_OBSERVATION") {
    throw new CoExitNatureRegistryMismatchError(EXIT_EVENT_TABLE, "PRIMARY_OBSERVATION", nature);
  }
  return {
    subjectWallet: e.subjectWallet,
    mint: e.mint,
    type: e.type,
    amount: e.amount,
    blockTimeSeconds: e.blockTimeSeconds,
    txSignature: e.txSignature,
    observedCounterpartyAsset: e.observedCounterpartyAsset,
    // Math.trunc : on ne fabrique pas d'unité fractionnaire en passant au bigint.
    observedCounterpartyAmount:
      e.observedCounterpartyAmount === null ? null : BigInt(Math.trunc(e.observedCounterpartyAmount)),
    observedCounterpartyMeaning: e.observedCounterpartyMeaning,
    // ██ L'adresse est persistée SANS LABEL. ██ Une destination partagée est un
    // fait d'adresse ; lui coller une identité sémantique — « exchange »,
    // « treasury », « pool du projet » — serait une affirmation que rien ici ne
    // démontre, et elle voyagerait ensuite comme si elle l'était.
    destination: e.destination,
    venue: e.venue,
    evidenceProvenance: e.evidenceProvenance,
    rowNature: "PRIMARY_OBSERVATION",
    sourceContext,
  };
}

export function buildCoExitQualificationRow(
  c: CoExitCharacterisation,
  group: CoExitGroup,
  contextRef: string,
  where = "buildCoExitQualificationRow",
): CoExitQualificationRow {
  const declared = natureForTable(CO_EXIT_QUALIFICATION_TABLE);
  if (declared !== "INFERENCE") {
    throw new CoExitNatureRegistryMismatchError(CO_EXIT_QUALIFICATION_TABLE, "INFERENCE", declared);
  }
  const basis = c.natureBasis.basis;
  // Défense en profondeur : le type l'interdit déjà, un cast passerait au travers.
  if ((basis.inputNatures as readonly string[]).includes("INFERENCE")) {
    throw new Error(
      `[coordinated-exit] ${where} — inputNatures contient INFERENCE : une inférence ne peut pas se fonder sur elle-même.`,
    );
  }
  const methodRef = basis.inputs.methodology.methodRef;
  if (methodRef !== COORDINATED_EXIT_METHOD_REF) {
    throw new Error(
      `[coordinated-exit] ${where} — methodRef inattendu « ${methodRef} », attendu « ${COORDINATED_EXIT_METHOD_REF} ».`,
    );
  }
  const target: NatureWriteTarget = {
    ref: `${CO_EXIT_QUALIFICATION_TABLE}:${contextRef}:${groupKeyOf(group)}`,
  };
  const nature = assertNatureWritable(
    target, { nature: "INFERENCE", methodRef, natureBasis: basis, scope: "row" }, where,
  );
  if (nature !== "INFERENCE") {
    throw new CoExitNatureRegistryMismatchError(CO_EXIT_QUALIFICATION_TABLE, "INFERENCE", nature);
  }
  const d = c.dimensions;
  return {
    contextRef,
    groupKey: groupKeyOf(group),
    mint: c.mint,
    category: c.category,
    distinctSubjects: d.distinctSubjects,
    pairsWithinWindow: d.canonicalProximity.pairsWithinWindow,
    windowSeconds: d.canonicalProximity.windowSeconds,
    minGapSeconds: d.canonicalProximity.minGapSeconds,
    medianGapSeconds: d.canonicalProximity.medianGapSeconds,
    spanSeconds: d.spanSeconds,
    demonstratedVenue: d.demonstratedVenue,
    demonstratedDestination: d.demonstratedDestination,
    sellCount: d.composition.sell,
    outgoingCount: d.composition.outgoingTransfer,
    coverageAnyIncomplete: d.coverage.anyIncomplete,
    materialityStatus: d.materiality.status,
    evidence: {
      subjects: group.subjects,
      txSignatures: group.events.map((e) => e.txSignature),
      gapsSeconds: group.pairs.map((p) => p.deltaSeconds),
      earliestBlockTimeSeconds: group.earliestBlockTimeSeconds,
      latestBlockTimeSeconds: group.latestBlockTimeSeconds,
    },
    rowNature: "INFERENCE",
    natureBasis: basis,
    naturePolicyVersion: c.natureBasis.policyVersion ?? COORDINATED_EXIT_POLICY_VERSION,
    methodRef,
  };
}

// ═══ LA PERSISTANCE ═══════════════════════════════════════════════════════

export interface StoredExitEvent {
  subjectWallet: string; mint: string; type: string;
  amount: bigint; blockTimeSeconds: number;
}
export interface StoredCoExitQualification {
  category: string; distinctSubjects: number;
  pairsWithinWindow: number; spanSeconds: number;
}

/** La base, INJECTÉE. Aucune implémentation ici. */
export interface CoExitStore {
  findExitEvent(txSignature: string): Promise<StoredExitEvent | null>;
  insertExitEvent(row: ExitEventRow): Promise<void>;
  findQualification(key: {
    contextRef: string; groupKey: string; methodRef: string;
  }): Promise<StoredCoExitQualification | null>;
  insertQualification(row: CoExitQualificationRow): Promise<void>;
}

export interface CoExitKeyConflict {
  table: string; key: string; field: string; existing: string; incoming: string;
}

export interface CoExitPersistReport {
  contextRef: string;
  dryRun: boolean;
  events: { planned: number; inserted: number; alreadyPresent: number; refused: number };
  qualifications: { planned: number; inserted: number; alreadyPresent: number; refused: number };
  conflicts: CoExitKeyConflict[];
  plan: { events: ExitEventRow[]; qualifications: CoExitQualificationRow[] };
}

export interface PersistCoExitInput {
  contextRef: string;
  events: readonly ExitEvent[];
  qualifications: readonly { characterisation: CoExitCharacterisation; group: CoExitGroup }[];
  /** `true` par défaut : le writer n'écrit pas sans qu'on le lui demande. */
  dryRun?: boolean;
  store?: CoExitStore;
}

export async function persistCoExit(input: PersistCoExitInput): Promise<CoExitPersistReport> {
  const dryRun = input.dryRun ?? true;
  if (!dryRun && !input.store) {
    throw new Error("[coordinated-exit] persistCoExit — write réel demandé sans store.");
  }
  const store = input.store;

  // La construction passe par S6 dans les DEUX modes : un dry-run qui sauterait
  // le chokepoint validerait un plan que le réel refuserait.
  const eventRows = input.events.map((e) => buildExitEventRow(e, input.contextRef));
  const qualRows = input.qualifications.map((q) =>
    buildCoExitQualificationRow(q.characterisation, q.group, input.contextRef));

  const conflicts: CoExitKeyConflict[] = [];
  const r: CoExitPersistReport = {
    contextRef: input.contextRef, dryRun,
    events: { planned: eventRows.length, inserted: 0, alreadyPresent: 0, refused: 0 },
    qualifications: { planned: qualRows.length, inserted: 0, alreadyPresent: 0, refused: 0 },
    conflicts, plan: { events: eventRows, qualifications: qualRows },
  };
  if (dryRun) return r;

  for (const row of eventRows) {
    const existing = await store!.findExitEvent(row.txSignature);
    if (!existing) { await store!.insertExitEvent(row); r.events.inserted++; continue; }
    const diffs: Array<[string, string, string]> = [];
    if (existing.subjectWallet !== row.subjectWallet) diffs.push(["subjectWallet", existing.subjectWallet, row.subjectWallet]);
    if (existing.mint !== row.mint) diffs.push(["mint", existing.mint, row.mint]);
    if (existing.type !== row.type) diffs.push(["type", existing.type, row.type]);
    if (existing.amount !== row.amount) diffs.push(["amount", String(existing.amount), String(row.amount)]);
    if (existing.blockTimeSeconds !== row.blockTimeSeconds)
      diffs.push(["blockTimeSeconds", String(existing.blockTimeSeconds), String(row.blockTimeSeconds)]);
    if (diffs.length === 0) { r.events.alreadyPresent++; continue; }
    r.events.refused++;
    for (const [field, ex, inc] of diffs)
      conflicts.push({ table: EXIT_EVENT_TABLE, key: row.txSignature, field, existing: ex, incoming: inc });
  }

  for (const row of qualRows) {
    const key = { contextRef: row.contextRef, groupKey: row.groupKey, methodRef: row.methodRef };
    const existing = await store!.findQualification(key);
    if (!existing) { await store!.insertQualification(row); r.qualifications.inserted++; continue; }
    const diffs: Array<[string, string, string]> = [];
    if (existing.category !== row.category) diffs.push(["category", existing.category, row.category]);
    if (existing.distinctSubjects !== row.distinctSubjects)
      diffs.push(["distinctSubjects", String(existing.distinctSubjects), String(row.distinctSubjects)]);
    if (existing.pairsWithinWindow !== row.pairsWithinWindow)
      diffs.push(["pairsWithinWindow", String(existing.pairsWithinWindow), String(row.pairsWithinWindow)]);
    if (existing.spanSeconds !== row.spanSeconds)
      diffs.push(["spanSeconds", String(existing.spanSeconds), String(row.spanSeconds)]);
    if (diffs.length === 0) { r.qualifications.alreadyPresent++; continue; }
    r.qualifications.refused++;
    const k = `${row.contextRef}|${row.groupKey}|${row.methodRef}`;
    for (const [field, ex, inc] of diffs)
      conflicts.push({ table: CO_EXIT_QUALIFICATION_TABLE, key: k, field, existing: ex, incoming: inc });
  }
  return r;
}
