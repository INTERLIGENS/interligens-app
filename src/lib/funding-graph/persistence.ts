// --- F2.2 — LE WRITER ------------------------------------------------------
//
// Persiste deux choses de natures différentes, et ne les mélange jamais :
//
//   FundingEdge                     un transfert CONSTATÉ   PRIMARY_OBSERVATION
//   FundingRelationshipObservation  une règle APPLIQUÉE     INFERENCE
//
// ██ LE STORE EST INJECTÉ. ██ Ce module n'importe ni prisma, ni réseau. Deux
// raisons, et la seconde compte autant que la première : l'invariant de
// frontière de F0 l'exige, et un writer qui tient sa base par un paramètre se
// prouve en dry-run sans qu'aucune ligne ne parte.
//
// ─── S6 N'EST PAS CONTOURNABLE ───────────────────────────────────────────
//
// Toute nature écrite ici passe par `assertNatureWritable`. Un INSERT qui la
// contournerait écrirait une nature que le registre n'a pas sanctionnée — et
// l'enforcement Data Nature ne servirait plus à rien, puisqu'il suffirait de
// ne pas l'appeler. Le fragment de nature ne se construit QUE là.
//
// ─── UNE COLLISION N'EST PAS UN ÉCRASEMENT ───────────────────────────────
//
// Clé déjà présente avec le MÊME contenu : rien à faire, la ligne existe déjà.
// C'est l'idempotence, et rejouer une collecte doit être sans effet.
//
// Clé déjà présente avec un contenu DIFFÉRENT : REFUS TRACÉ. Écraser en
// silence ferait disparaître la divergence au moment précis où elle est
// visible — et une divergence sur clé est le seul endroit où l'on apprend que
// deux collectes ne racontent pas la même histoire. Le writer la remonte ;
// c'est à un humain de trancher.

import {
  assertNatureWritable,
  type NatureWriteTarget,
} from "@/lib/data-nature/writeGuard";
import { natureForTable } from "@/lib/data-nature/registry";
import type { InferenceEnvelopeV2 } from "@/lib/data-nature/inferenceEnvelope";
import type { FundingEdge } from "./types";
import {
  FUNDING_RELATIONSHIP_METHOD_REF,
  FUNDING_RELATIONSHIP_POLICY_VERSION,
  type FundingRelationshipCategory,
  type QualifiedFundingRelationship,
} from "./qualify";

export const FUNDING_EDGE_TABLE = "FundingEdge";
export const FUNDING_RELATIONSHIP_TABLE = "FundingRelationshipObservation";

// ═══ LES LIGNES, TELLES QUE LA BASE LES ATTEND ════════════════════════════

export interface FundingEdgeRow {
  fromWallet: string;
  toWallet: string;
  asset: "SOL";
  /** BigInt : les lamports dépassent le Number sûr sur les gros transferts. */
  amountLamports: bigint;
  txSignature: string;
  blockTimeSeconds: number;
  rowNature: "PRIMARY_OBSERVATION";
  sourceContext: string;
}

export interface FundingRelationshipRow {
  funderWallet: string;
  contextRef: string;
  subjectsReached: number;
  category: FundingRelationshipCategory;
  /**
   * La forme RÉELLE de la preuve, pas un `Record<string, unknown>`.
   * L'effacer derrière un cast aurait fait perdre au writer la seule
   * information qui permet de vérifier ce qu'il persiste — et masqué toute
   * divergence future entre le qualifieur et la colonne.
   */
  evidence: QualifiedFundingRelationship["evidence"];
  coverageIsFloor: boolean;
  rowNature: "INFERENCE";
  natureBasis: InferenceEnvelopeV2["basis"];
  naturePolicyVersion: string;
  methodRef: string;
}

// ═══ LES DEUX CHECK DE LA BASE, EXÉCUTABLES CÔTÉ APPLICATION ══════════════
//
// Miroirs des contraintes posées le 2026-09-04. Les vérifier ici fait échouer
// en TEST plutôt qu'au premier INSERT réel — et un CHECK NOT VALID ne protège
// que les écritures à venir, donc autant qu'elles soient conformes du premier
// coup.

/** `fundingedge_rownature_declared_chk`. Pas de CHECK auditable : une arête EST la piste. */
export function satisfiesFundingEdgeChecks(row: {
  rowNature?: unknown;
}): { declared: boolean } {
  const n = row.rowNature;
  return { declared: n == null || n === "PRIMARY_OBSERVATION" };
}

/** `fundingrelobs_rownature_declared_chk` + `fundingrelobs_rownature_auditable_chk`. */
export function satisfiesFundingRelationshipChecks(row: {
  rowNature?: unknown;
  natureBasis?: unknown;
  naturePolicyVersion?: unknown;
}): { declared: boolean; auditable: boolean } {
  const n = row.rowNature;
  if (n == null) return { declared: true, auditable: true };
  const declared = n === "INFERENCE";
  const v = row.naturePolicyVersion;
  const b = row.natureBasis;
  const auditable =
    typeof v === "string" &&
    v.length > 0 &&
    b != null &&
    typeof b === "object" &&
    !Array.isArray(b) &&
    Object.keys(b as object).length > 0;
  return { declared, auditable };
}

// ═══ CONSTRUCTION — LA NATURE PASSE PAR S6 ════════════════════════════════

export class FundingNatureRegistryMismatchError extends Error {
  constructor(table: string, expected: string, got: unknown) {
    super(
      `[funding-graph] ${table} — le registre Data Nature déclare ${String(got)}, ` +
        `le writer voulait écrire ${expected}. L'écriture s'arrête : choisir en ` +
        `silence ferait porter à la ligne une nature que le registre ne sanctionne pas.`,
    );
    this.name = "FundingNatureRegistryMismatchError";
  }
}

export function buildFundingEdgeRow(
  edge: FundingEdge,
  sourceContext: string,
  where = "buildFundingEdgeRow",
): FundingEdgeRow {
  const declared = natureForTable(FUNDING_EDGE_TABLE);
  if (declared !== "PRIMARY_OBSERVATION") {
    throw new FundingNatureRegistryMismatchError(FUNDING_EDGE_TABLE, "PRIMARY_OBSERVATION", declared);
  }
  const target: NatureWriteTarget = { ref: `${FUNDING_EDGE_TABLE}:${edge.txSignature}` };
  // ██ S6 ██ — refuse une nature absente/invalide, un artefact mixte, ou une
  // remontée d'échelle (I1).
  const nature = assertNatureWritable(target, { nature: "PRIMARY_OBSERVATION", scope: "row" }, where);
  if (nature !== "PRIMARY_OBSERVATION") {
    throw new FundingNatureRegistryMismatchError(FUNDING_EDGE_TABLE, "PRIMARY_OBSERVATION", nature);
  }
  return {
    fromWallet: edge.fromWallet,
    toWallet: edge.toWallet,
    asset: "SOL",
    amountLamports: BigInt(edge.amountLamports),
    txSignature: edge.txSignature,
    blockTimeSeconds: edge.blockTimeSeconds,
    rowNature: "PRIMARY_OBSERVATION",
    sourceContext,
  };
}

export function buildFundingRelationshipRow(
  q: QualifiedFundingRelationship,
  contextRef: string,
  where = "buildFundingRelationshipRow",
): FundingRelationshipRow {
  const declared = natureForTable(FUNDING_RELATIONSHIP_TABLE);
  if (declared !== "INFERENCE") {
    throw new FundingNatureRegistryMismatchError(FUNDING_RELATIONSHIP_TABLE, "INFERENCE", declared);
  }
  const basis = q.natureBasis.basis;
  // Défense en profondeur : l'enveloppe l'interdit déjà, mais une valeur venue
  // d'un cast passerait au travers du compilateur. Une inférence n'est jamais
  // sa propre preuve.
  if ((basis.inputNatures as readonly string[]).includes("INFERENCE")) {
    throw new Error(
      `[funding-graph] ${where} — inputNatures contient INFERENCE : une inférence ne peut pas se fonder sur elle-même.`,
    );
  }
  const methodRef = q.natureBasis.basis.inputs.methodology.methodRef;
  if (methodRef !== FUNDING_RELATIONSHIP_METHOD_REF) {
    throw new Error(
      `[funding-graph] ${where} — methodRef inattendu « ${methodRef} », attendu « ${FUNDING_RELATIONSHIP_METHOD_REF} ».`,
    );
  }
  const target: NatureWriteTarget = {
    ref: `${FUNDING_RELATIONSHIP_TABLE}:${q.funder}:${contextRef}`,
  };
  const nature = assertNatureWritable(
    target,
    { nature: "INFERENCE", methodRef, natureBasis: basis, scope: "row" },
    where,
  );
  if (nature !== "INFERENCE") {
    throw new FundingNatureRegistryMismatchError(FUNDING_RELATIONSHIP_TABLE, "INFERENCE", nature);
  }
  return {
    funderWallet: q.funder,
    contextRef,
    subjectsReached: q.evidence.subjectsReached.length,
    category: q.category,
    evidence: q.evidence,
    coverageIsFloor: q.coverage.resultIsFloor,
    rowNature: "INFERENCE",
    natureBasis: basis,
    naturePolicyVersion: q.natureBasis.policyVersion ?? FUNDING_RELATIONSHIP_POLICY_VERSION,
    methodRef,
  };
}

// ═══ LA PERSISTANCE — IDEMPOTENTE, ET QUI REFUSE PLUTÔT QUE D'ÉCRASER ═════

/** Ce qu'une ligne déjà en base rend, réduit aux champs qui décident d'une collision. */
export interface StoredEdge {
  fromWallet: string; toWallet: string;
  amountLamports: bigint; blockTimeSeconds: number;
}
export interface StoredRelationship {
  subjectsReached: number; category: string; coverageIsFloor: boolean;
}

/** La base, INJECTÉE. Aucune implémentation ici — le dry-run n'en fournit aucune. */
export interface FundingGraphStore {
  findEdge(txSignature: string): Promise<StoredEdge | null>;
  insertEdge(row: FundingEdgeRow): Promise<void>;
  findRelationship(key: {
    funderWallet: string; contextRef: string; methodRef: string;
  }): Promise<StoredRelationship | null>;
  insertRelationship(row: FundingRelationshipRow): Promise<void>;
}

export interface KeyConflict {
  table: string;
  key: string;
  field: string;
  existing: string;
  incoming: string;
}

export interface PersistReport {
  contextRef: string;
  dryRun: boolean;
  edges: { planned: number; inserted: number; alreadyPresent: number; refused: number };
  relationships: { planned: number; inserted: number; alreadyPresent: number; refused: number };
  /** ██ Les divergences, remontées. Jamais avalées. ██ */
  conflicts: KeyConflict[];
  /** Ce qui serait écrit, en dry-run comme en réel — pour être relu avant. */
  plan: { edges: FundingEdgeRow[]; relationships: FundingRelationshipRow[] };
}

export interface PersistFundingGraphInput {
  contextRef: string;
  edges: readonly FundingEdge[];
  qualifications: readonly QualifiedFundingRelationship[];
  /** `true` par défaut : le writer n'écrit pas sans qu'on le lui demande. */
  dryRun?: boolean;
  /** Requis dès que `dryRun` est faux. */
  store?: FundingGraphStore;
}

export async function persistFundingGraph(
  input: PersistFundingGraphInput,
): Promise<PersistReport> {
  const dryRun = input.dryRun ?? true;
  if (!dryRun && !input.store) {
    throw new Error("[funding-graph] persistFundingGraph — write réel demandé sans store.");
  }
  const store = input.store;

  // La construction passe par S6 dans les DEUX modes : un dry-run qui
  // sauterait le chokepoint validerait un plan que le réel refuserait.
  const edgeRows = input.edges.map((e) => buildFundingEdgeRow(e, input.contextRef));
  const relRows = input.qualifications.map((q) => buildFundingRelationshipRow(q, input.contextRef));

  const conflicts: KeyConflict[] = [];
  const r: PersistReport = {
    contextRef: input.contextRef,
    dryRun,
    edges: { planned: edgeRows.length, inserted: 0, alreadyPresent: 0, refused: 0 },
    relationships: { planned: relRows.length, inserted: 0, alreadyPresent: 0, refused: 0 },
    conflicts,
    plan: { edges: edgeRows, relationships: relRows },
  };
  if (dryRun) return r;

  for (const row of edgeRows) {
    const existing = await store!.findEdge(row.txSignature);
    if (!existing) { await store!.insertEdge(row); r.edges.inserted++; continue; }
    const diffs: Array<[string, string, string]> = [];
    if (existing.fromWallet !== row.fromWallet) diffs.push(["fromWallet", existing.fromWallet, row.fromWallet]);
    if (existing.toWallet !== row.toWallet) diffs.push(["toWallet", existing.toWallet, row.toWallet]);
    if (existing.amountLamports !== row.amountLamports)
      diffs.push(["amountLamports", String(existing.amountLamports), String(row.amountLamports)]);
    if (existing.blockTimeSeconds !== row.blockTimeSeconds)
      diffs.push(["blockTimeSeconds", String(existing.blockTimeSeconds), String(row.blockTimeSeconds)]);
    if (diffs.length === 0) { r.edges.alreadyPresent++; continue; }
    // ██ REFUS, pas écrasement. ██
    r.edges.refused++;
    for (const [field, ex, inc] of diffs)
      conflicts.push({ table: FUNDING_EDGE_TABLE, key: row.txSignature, field, existing: ex, incoming: inc });
  }

  for (const row of relRows) {
    const key = { funderWallet: row.funderWallet, contextRef: row.contextRef, methodRef: row.methodRef };
    const existing = await store!.findRelationship(key);
    if (!existing) { await store!.insertRelationship(row); r.relationships.inserted++; continue; }
    const diffs: Array<[string, string, string]> = [];
    if (existing.category !== row.category) diffs.push(["category", existing.category, row.category]);
    if (existing.subjectsReached !== row.subjectsReached)
      diffs.push(["subjectsReached", String(existing.subjectsReached), String(row.subjectsReached)]);
    if (existing.coverageIsFloor !== row.coverageIsFloor)
      diffs.push(["coverageIsFloor", String(existing.coverageIsFloor), String(row.coverageIsFloor)]);
    if (diffs.length === 0) { r.relationships.alreadyPresent++; continue; }
    r.relationships.refused++;
    const k = `${row.funderWallet}|${row.contextRef}|${row.methodRef}`;
    for (const [field, ex, inc] of diffs)
      conflicts.push({ table: FUNDING_RELATIONSHIP_TABLE, key: k, field, existing: ex, incoming: inc });
  }

  return r;
}
