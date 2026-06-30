/**
 * src/lib/osint/review/reviewActions.ts
 *
 * SPRINT B — Les VRAIS handlers de review (logique métier, zéro IO direct).
 * Tout IO est injecté (`deps.store`, `deps.verifyMint`, `deps.now`) → testable
 * sur mock. L'UI les appelle via les routes API admin ; elle ne contient AUCUNE
 * logique métier.
 *
 * DOCTRINE (défendue en code, pas seulement par le plan) :
 *   - RESOLVE : on ne fait pas confiance à la saisie humaine — la CA saisie est
 *     RE-VÉRIFIÉE on-chain (Helius) ; si le mint n'existe pas → REFUS, l'item
 *     reste pending. Si OK → état traité SHADOW (jamais public).
 *   - REJECT : marque rejeté, evidence CONSERVÉE (aucune suppression).
 *   - ESCALATE : pose un audit action=ESCALATE ; sort de la file standard.
 *   - INVARIANT : aucune action ne pose isPublic=true / visibility='public' /
 *     reviewStatus='approved_public' / publishStatus='published'.
 *   - Chaque action écrit une ligne d'audit (qui/quoi/quand/avant/après).
 */

import { SubmissionStatus } from "../contracts";
import {
  ReviewAction,
  ReviewItemType,
  RESOLVED_CLAIM_STATUS,
  assertShadowClaimStatus,
  type ReviewItemRef,
  type ReviewDeps,
  type ReviewItemState,
  type ReviewAuditRecord,
  type ReviewStamp,
} from "./reviewContracts";

export interface ResolveInput {
  /** CA saisie/corrigée par le réviseur — re-vérifiée on-chain avant acceptation. */
  contractAddress: string;
  /** Chain de la CA ('solana' | 'ethereum'). */
  chain: string;
  /** Justification courte (audit). */
  reason: string;
}

export interface RejectInput {
  reason: string; // requis
}

export interface EscalateInput {
  reason: string; // requis (ex: "P0 forensique")
}

export interface ReviewActionResult {
  ok: boolean;
  action: ReviewAction;
  ref: ReviewItemRef;
  /** Statut/état résultant côté item (après mutation), ou null si refus. */
  resultingStatus: string | null;
  /** Palier de vérification atteint (RESOLVE only) — toujours shadow. */
  claimStatus: string | null;
  /** On-chain check (RESOLVE only). */
  mint: { status: string; symbol: string | null } | null;
  audit?: ReviewAuditRecord | null;
  error?: string;
}

const SOLANA_CA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ETH_CA = /^0x[a-fA-F0-9]{40}$/;

function caLooksValid(ca: string, chain: string): boolean {
  if (chain === "ethereum") return ETH_CA.test(ca);
  if (chain === "solana") return SOLANA_CA.test(ca);
  return false;
}

function stamp(deps: ReviewDeps, nowIso: string, note: string): ReviewStamp {
  return { reviewedBy: deps.actor, reviewedAt: nowIso, reviewNote: note };
}

async function fetchOrFail(
  deps: ReviewDeps,
  ref: ReviewItemRef,
): Promise<ReviewItemState> {
  const item = await deps.store.getItem(ref);
  if (!item) throw new Error(`review item not found: ${ref.type}:${ref.id}`);
  return item;
}

/**
 * RESOLVE — saisir/corriger la CA, RE-VÉRIFIER on-chain, accepter en shadow.
 * Refuse (item reste pending) si la CA est mal formée ou si le mint n'existe pas
 * (`exists` est le SEUL verdict qui résout — `unavailable`/`not_found` refusent).
 */
export async function resolveItem(
  ref: ReviewItemRef,
  input: ResolveInput,
  deps: ReviewDeps,
): Promise<ReviewActionResult> {
  const nowIso = deps.now ? deps.now() : new Date(0).toISOString();
  const before = await fetchOrFail(deps, ref);

  const fail = (error: string, mint: ReviewActionResult["mint"] = null): ReviewActionResult => ({
    ok: false, action: ReviewAction.RESOLVE, ref, resultingStatus: before.status, claimStatus: null, mint, error,
  });

  const ca = input.contractAddress?.trim();
  if (!ca) return fail("contractAddress is required to resolve");
  if (!caLooksValid(ca, input.chain)) {
    return fail(`malformed ${input.chain} contract address — not re-checked on-chain`);
  }

  // ── Re-vérification on-chain OBLIGATOIRE (on ne fait pas confiance à la saisie) ──
  const v = await deps.verifyMint(ca);
  if (v.status !== "exists") {
    // not_found = CA factice ; unavailable = check impossible → on NE résout PAS.
    return fail(
      v.status === "not_found"
        ? "on-chain check: mint not found — CA rejected, item stays pending"
        : "on-chain check unavailable — cannot resolve, item stays pending",
      { status: v.status, symbol: v.symbol },
    );
  }

  // ── Palier atteint : SHADOW, garde-fou en code ──────────────────────────────
  assertShadowClaimStatus(RESOLVED_CLAIM_STATUS);
  const note = `RESOLVE: CA ${ca} (${input.chain}) re-vérifiée on-chain [exists${v.symbol ? `, ${v.symbol}` : ""}]. ${input.reason}`.trim();
  const st = stamp(deps, nowIso, note);

  let resultingStatus: string;
  switch (ref.type) {
    case ReviewItemType.SUBMISSION:
      await deps.store.setSubmissionStatus(ref.id, SubmissionStatus.RESOLVED_BY_REVIEW, st);
      resultingStatus = SubmissionStatus.RESOLVED_BY_REVIEW;
      break;
    case ReviewItemType.SIGNAL:
      await deps.store.setSignalStatus(ref.id, "resolved", st);
      resultingStatus = "resolved";
      break;
    case ReviewItemType.LINK:
      // Le lien reste 'pending_review' + 'draft' : accepté en revue mais la
      // publication publique passe par le triple-gate. JAMAIS 'approved_public'.
      await deps.store.setLinkReviewStatus(ref.id, "pending_review", st);
      resultingStatus = "pending_review";
      break;
    default:
      return fail(`unknown item type: ${(ref as ReviewItemRef).type}`);
  }

  const after = {
    status: resultingStatus,
    claimStatus: RESOLVED_CLAIM_STATUS,
    contractAddress: ca,
    chain: input.chain,
    onChain: { status: v.status, symbol: v.symbol },
    isPublic: false,
    visibility: ref.type === ReviewItemType.LINK ? "draft" : before.visibility,
  };
  const audit = await writeAudit(deps, ref, ReviewAction.RESOLVE, note, before, after, nowIso);

  return {
    ok: true, action: ReviewAction.RESOLVE, ref,
    resultingStatus, claimStatus: RESOLVED_CLAIM_STATUS,
    mint: { status: v.status, symbol: v.symbol }, audit,
  };
}

/**
 * REJECT — marque rejeté ; l'evidence (EvidenceSnapshot) n'est JAMAIS supprimée.
 * On ne touche qu'à l'état de revue + on stampe la raison.
 */
export async function rejectItem(
  ref: ReviewItemRef,
  input: RejectInput,
  deps: ReviewDeps,
): Promise<ReviewActionResult> {
  const nowIso = deps.now ? deps.now() : new Date(0).toISOString();
  const reason = input.reason?.trim();
  if (!reason) {
    const before0 = await fetchOrFail(deps, ref);
    return { ok: false, action: ReviewAction.REJECT, ref, resultingStatus: before0.status, claimStatus: null, mint: null, error: "reason is required to reject" };
  }
  const before = await fetchOrFail(deps, ref);
  const note = `REJECT: ${reason}`;
  const st = stamp(deps, nowIso, note);

  let resultingStatus: string;
  switch (ref.type) {
    case ReviewItemType.SUBMISSION:
      await deps.store.setSubmissionStatus(ref.id, SubmissionStatus.REJECTED_BY_REVIEW, st);
      resultingStatus = SubmissionStatus.REJECTED_BY_REVIEW;
      break;
    case ReviewItemType.SIGNAL:
      await deps.store.setSignalStatus(ref.id, "rejected", st);
      resultingStatus = "rejected";
      break;
    case ReviewItemType.LINK:
      await deps.store.setLinkReviewStatus(ref.id, "rejected", st);
      resultingStatus = "rejected";
      break;
    default:
      return { ok: false, action: ReviewAction.REJECT, ref, resultingStatus: before.status, claimStatus: null, mint: null, error: `unknown item type: ${(ref as ReviewItemRef).type}` };
  }

  const after = {
    status: resultingStatus,
    evidencePreserved: true, // l'evidence n'est jamais supprimée
    isPublic: false,
    visibility: before.visibility,
  };
  const audit = await writeAudit(deps, ref, ReviewAction.REJECT, note, before, after, nowIso);
  return { ok: true, action: ReviewAction.REJECT, ref, resultingStatus, claimStatus: null, mint: null, audit };
}

/**
 * ESCALATE — sort l'item de la file standard pour traitement approfondi
 * (P0/forensique). N'introduit AUCUN statut : pose une ligne d'audit
 * action=ESCALATE que le loader utilise pour exclure l'item de la file.
 */
export async function escalateItem(
  ref: ReviewItemRef,
  input: EscalateInput,
  deps: ReviewDeps,
): Promise<ReviewActionResult> {
  const nowIso = deps.now ? deps.now() : new Date(0).toISOString();
  const reason = input.reason?.trim();
  if (!reason) {
    const before0 = await fetchOrFail(deps, ref);
    return { ok: false, action: ReviewAction.ESCALATE, ref, resultingStatus: before0.status, claimStatus: null, mint: null, error: "reason is required to escalate" };
  }
  const before = await fetchOrFail(deps, ref);
  const note = `ESCALATE: ${reason}`;
  const after = {
    status: before.status,            // statut inchangé — l'escalade est orthogonale
    escalated: true,
    removedFromStandardQueue: true,
    isPublic: false,
  };
  const audit = await writeAudit(deps, ref, ReviewAction.ESCALATE, note, before, after, nowIso);
  return { ok: true, action: ReviewAction.ESCALATE, ref, resultingStatus: before.status, claimStatus: null, mint: null, audit };
}

async function writeAudit(
  deps: ReviewDeps,
  ref: ReviewItemRef,
  action: ReviewAction,
  reason: string,
  before: ReviewItemState,
  after: unknown,
  nowIso: string,
): Promise<ReviewAuditRecord> {
  const audit: ReviewAuditRecord = {
    itemType: ref.type,
    itemId: ref.id,
    action,
    actor: deps.actor,
    reason,
    before,
    after,
    createdAt: nowIso,
  };
  await deps.store.writeAudit(audit);
  return audit;
}

/** Dispatch unique utilisé par les routes (1 entrée typée). */
export async function applyReviewAction(
  ref: ReviewItemRef,
  action: ReviewAction,
  input: ResolveInput | RejectInput | EscalateInput,
  deps: ReviewDeps,
): Promise<ReviewActionResult> {
  switch (action) {
    case ReviewAction.RESOLVE:
      return resolveItem(ref, input as ResolveInput, deps);
    case ReviewAction.REJECT:
      return rejectItem(ref, input as RejectInput, deps);
    case ReviewAction.ESCALATE:
      return escalateItem(ref, input as EscalateInput, deps);
    default:
      return { ok: false, action, ref, resultingStatus: null, claimStatus: null, mint: null, error: `unknown action: ${action}` };
  }
}
