/**
 * src/lib/osint/decision/processSubmission.ts
 *
 * SPRINT A — Orchestration d'UNE soumission (un ExtractionPlan). Câble :
 *   1. IDEMPOTENCE : même imageSha256 déjà traité → DUPLICATE, zéro re-coût.
 *   2. signaux par claim (verrou 2/3 via verifyMint injecté ; le reste hérité du
 *      plan / surchargé par claim.signals).
 *   3. classifyClaim PAR claim (le cerveau, src/lib/osint/decision/classify).
 *   4. poisoning : avant tout boost de confiance sur un lien KOL↔token, on
 *      vérifie le cluster de signalement coordonné ; si flag → assertion → PENDING.
 *   5. matérialisation selon DECISION_TO_EFFECT (mapping A0) : EVIDENCE →
 *      EvidenceSnapshot shadow ; ASSERTION → KolTokenLink draft (si autorisé) ;
 *      PENDING/REJECT → rien (route review / drop).
 *   6. écriture de la ligne OsintSubmission (provenance complète, status final).
 *
 * Tout IO est INJECTÉ (`deps.store`, `deps.verifyMint`, `deps.now`) → testable
 * sur mock, sans appel vision/Helius/DB réel. Aucune écriture publique, jamais.
 */

import {
  ExtractionDecision,
  SubmissionStatus,
  DECISION_TO_EFFECT,
  CLAIM_STATUS_TO_EVIDENCE,
  CLAIM_STATUS_TO_LINK,
  EXTRACTION_METHOD_VISION_AUTO,
  SourceTrustTier,
} from "../contracts";
import type { ExtractionPlan, ExtractedClaim } from "../contracts";
import { isPending } from "../vision/validateCA";
import type { VerifyMintFn } from "../vision/verifyMintOnChain";
import { classifyClaim } from "./classifyExtraction";
import type { ClaimSignals, ClaimUnderReview, ClaimDecision } from "./classifyExtraction";
import { evaluatePoisoning } from "./poisoningMonitor";
import type { PoisoningVerdict, PriorSubmissionLite } from "./poisoningMonitor";

// ── Persistence (injectée — mock en test, prisma+SQL brut côté route) ────────

export interface EvidenceShadowInput {
  imageSha256: string;
  kolHandle: string | null;
  tokenSymbol: string | null;
  relationKey: string;
  snapshotType: string;
  reviewStatus: string; // toujours 'pending' (jamais 'published')
  isPublic: boolean;    // toujours false
  extractionMethod: string;
  notes: string;
}

export interface LinkDraftInput {
  kolHandle: string;
  contractAddress: string;
  chain: string;
  tokenSymbol: string | null;
  visibility: string;   // toujours 'draft' (jamais 'public')
  reviewStatus: string; // 'pending_review'
  note: string;
}

export interface SubmissionRowInput {
  imageSha256: string;
  perceptualHash: string | null;
  promptVersion: string;
  modelVersion: string;
  sourceType: string;
  trustTier: SourceTrustTier;
  submitter: string;
  rawVisionPass1: unknown;
  rawVisionPass2: unknown;
  decisionReasons: string[];
  claimsCount: number;
  status: SubmissionStatus;
  evidenceSnapshotId: string | null;
  ingestedAt: string;
}

export interface SubmissionStore {
  findByImageSha256(sha256: string): Promise<{ id: string; status: string } | null>;
  listRecentForPoisoning(kolHandle: string, sinceIso: string): Promise<PriorSubmissionLite[]>;
  insertEvidenceShadow(input: EvidenceShadowInput): Promise<{ id: string }>;
  upsertLinkDraft(input: LinkDraftInput): Promise<{ id: string }>;
  insertSubmission(input: SubmissionRowInput): Promise<{ id: string }>;
}

export interface ProcessDeps {
  store: SubmissionStore;
  verifyMint: VerifyMintFn;
  now?: () => string; // ISO ; injecté pour rester déterministe en test
}

/** Claim entrant : un claim A0, avec des signaux partiels optionnels à surcharger. */
export type ReviewableClaim = ExtractedClaim & { signals?: Partial<ClaimSignals> };
export type ReviewablePlan = Omit<ExtractionPlan, "claims"> & { claims: ReviewableClaim[] };

export interface ClaimResult {
  index: number;
  tokenSymbol: string | null;
  decision: ExtractionDecision;
  reason: string;
  score: number;
  claimStatus: string;
  assertion: ClaimDecision["assertion"];
  evidenceWritten: boolean;
  linkWritten: boolean;
}

export interface ProcessResult {
  idempotent: boolean;
  status: SubmissionStatus;
  imageSha256: string;
  submissionId: string | null;
  evidenceWritten: boolean;
  linksWritten: number;
  poisoning: PoisoningVerdict | null;
  claims: ClaimResult[];
}

// ── Signal building (verrou 2/3 via verifyMint) ──────────────────────────────

function symbolMatches(onChain: string | null, read: string | null): boolean {
  if (!onChain || !read) return false;
  const norm = (x: string) => x.replace(/^\$/, "").trim().toLowerCase();
  return norm(onChain) === norm(read);
}

async function buildSignals(
  claim: ReviewableClaim,
  verifyMint: VerifyMintFn,
): Promise<ClaimSignals> {
  const ca = claim.contractAddress;
  const derivedCaState: ClaimSignals["caState"] = !ca
    ? "absent"
    : isPending(ca)
      ? "pending"
      : "present";

  const base: ClaimSignals = {
    caState: derivedCaState,
    consensusAgree: true, // simple lecture par défaut ; surchargé si divergence connue
    mintStatus: "not_checked",
    tickerMatch: "not_checked",
    chainKnown: claim.chain !== "unknown",
    imageExploitable: true,
    suspectImage: false,
    isDuplicate: false,
  };

  // Verrou 2/3 : on n'interroge la chain QUE si la CA est présente et la chain connue.
  const effCaState = claim.signals?.caState ?? base.caState;
  const effChainKnown = claim.signals?.chainKnown ?? base.chainKnown;
  if (ca && effCaState === "present" && effChainKnown) {
    const v = await verifyMint(ca);
    base.mintStatus =
      v.status === "exists" ? "exists" : v.status === "not_found" ? "not_found" : "unavailable";
    if (v.status === "exists") {
      base.tickerMatch = !v.symbol ? "no_metadata" : symbolMatches(v.symbol, claim.tokenSymbol) ? "match" : "mismatch";
    }
  }

  // Les signaux explicitement fournis par l'amont (verrou 1, partial, suspect…) priment.
  return { ...base, ...claim.signals };
}

// ── Orchestration ────────────────────────────────────────────────────────────

export async function processSubmission(
  plan: ReviewablePlan,
  trustTier: SourceTrustTier,
  deps: ProcessDeps,
): Promise<ProcessResult> {
  const now = deps.now ? deps.now() : plan.provenance.ingestedAt;
  const sha256 = plan.provenance.imageSha256;

  // ── 1. IDEMPOTENCE ─────────────────────────────────────────────────────────
  const prior = await deps.store.findByImageSha256(sha256);
  if (prior) {
    return {
      idempotent: true,
      status: SubmissionStatus.DUPLICATE,
      imageSha256: sha256,
      submissionId: prior.id,
      evidenceWritten: false,
      linksWritten: 0,
      poisoning: null,
      claims: [],
    };
  }

  // ── poisoning : une seule évaluation par soumission (même handle ciblé) ──────
  const primaryHandle =
    plan.claims.find((c) => c.kolHandle)?.kolHandle ?? null;
  let poisoning: PoisoningVerdict | null = null;
  if (primaryHandle) {
    const windowHours = 72;
    const sinceIso = new Date(Date.parse(now) - windowHours * 3600 * 1000).toISOString();
    const priors = await deps.store.listRecentForPoisoning(primaryHandle, sinceIso);
    poisoning = evaluatePoisoning({
      kolHandle: primaryHandle,
      perceptualHash: plan.provenance.perceptualHash,
      trustTier,
      priorSubmissions: priors,
      now,
      windowHours,
    });
  }

  // ── 2-3. signaux + classification PAR claim ──────────────────────────────────
  const allReasons: string[] = [];
  const claimResults: ClaimResult[] = [];
  let evidenceWanted = false;
  const linksToWrite: Array<{ claim: ReviewableClaim; ticker: string | null }> = [];
  let anyAutoCommit = false;
  let anyPending = false;

  for (let i = 0; i < plan.claims.length; i++) {
    const claim = plan.claims[i];
    const signals = await buildSignals(claim, deps.verifyMint);
    const under: ClaimUnderReview = { ...claim, signals };
    const d = classifyClaim(under, plan.provenance, trustTier);

    // poisoning : neutralise tout auto-commit d'assertion → PENDING (pas de boost).
    let decision = d.decision.decision;
    let assertion = d.assertion;
    if (decision === ExtractionDecision.AUTO_COMMIT_ASSERTION && poisoning?.suppressConfidenceBoost) {
      decision = ExtractionDecision.AUTO_COMMIT_EVIDENCE; // la CA reste commitée…
      assertion = {
        autoCommit: false,
        status: "pending",
        reason: `assertion suspendue: ${poisoning.flag} (cluster ${poisoning.clusterSize}) — route review`,
        pendingReason: assertion.pendingReason ?? d.assertion.pendingReason,
      };
      d.reasons.push(`poisoning: ${poisoning.reason} → pas de hausse de confiance`);
    }

    const effect = DECISION_TO_EFFECT[decision];
    const willWriteEvidence = effect.writeEvidence;
    const willWriteLink = effect.writeLink && assertion.autoCommit;
    if (willWriteEvidence) evidenceWanted = true;
    if (willWriteLink && claim.kolHandle && claim.contractAddress) {
      linksToWrite.push({ claim, ticker: claim.tokenSymbol });
    }
    if (decision === ExtractionDecision.AUTO_COMMIT_EVIDENCE || decision === ExtractionDecision.AUTO_COMMIT_ASSERTION) {
      anyAutoCommit = true;
    }
    if (decision === ExtractionDecision.PENDING || assertion.status === "pending" || assertion.status === "blocked") {
      anyPending = true;
    }

    allReasons.push(`claim#${i}[${claim.tokenSymbol ?? "?"}]: ${decision} — ${d.decision.reason}`);
    claimResults.push({
      index: i,
      tokenSymbol: claim.tokenSymbol,
      decision,
      reason: d.decision.reason,
      score: d.score,
      claimStatus: d.claimStatus,
      assertion,
      evidenceWritten: false,
      linkWritten: false,
    });
  }

  // ── 5. MATÉRIALISATION (shadow only) ─────────────────────────────────────────
  let evidenceSnapshotId: string | null = null;
  if (evidenceWanted) {
    const primaryTicker = plan.claims.find((c) => c.tokenSymbol)?.tokenSymbol ?? null;
    const relationKey = `${primaryHandle ?? "unknown_handle"}:${primaryTicker ?? "UNKNOWN"}`;
    const target = CLAIM_STATUS_TO_EVIDENCE["onchain_verified_only"]; // shadow: pending / not public
    const ev = await deps.store.insertEvidenceShadow({
      imageSha256: sha256,
      kolHandle: primaryHandle,
      tokenSymbol: primaryTicker,
      relationKey,
      snapshotType: "osint_vision",
      reviewStatus: target.reviewStatus, // 'pending'
      isPublic: target.isPublic,         // false
      extractionMethod: EXTRACTION_METHOD_VISION_AUTO,
      notes: `vision-auto shadow; claims=${plan.claims.length}; ${allReasons.join(" || ")}`,
    });
    evidenceSnapshotId = ev.id;
    for (const cr of claimResults) {
      if (DECISION_TO_EFFECT[cr.decision].writeEvidence) cr.evidenceWritten = true;
    }
  }

  let linksWritten = 0;
  const linkTarget = CLAIM_STATUS_TO_LINK["attribution_verified"]; // visibility 'public' only at human_approved…
  // …mais on FORCE draft/pending_review : aucune matérialisation auto n'est publique.
  const draftTarget = CLAIM_STATUS_TO_LINK["onchain_verified_only"]; // visibility 'draft'
  void linkTarget;
  for (const { claim, ticker } of linksToWrite) {
    await deps.store.upsertLinkDraft({
      kolHandle: claim.kolHandle as string,
      contractAddress: claim.contractAddress as string,
      chain: claim.chain,
      tokenSymbol: ticker,
      visibility: draftTarget.visibility,     // 'draft' — JAMAIS 'public'
      reviewStatus: draftTarget.reviewStatus, // 'pending_review'
      note: `vision-auto assertion (shadow). trustTier=${trustTier}.`,
    });
    linksWritten++;
    const cr = claimResults.find((c) => c.tokenSymbol === ticker && c.decision === ExtractionDecision.AUTO_COMMIT_ASSERTION);
    if (cr) cr.linkWritten = true;
  }

  // ── statut global ────────────────────────────────────────────────────────────
  const status: SubmissionStatus = anyAutoCommit
    ? SubmissionStatus.AUTO_COMMITTED_SHADOW
    : anyPending
      ? SubmissionStatus.PENDING_REVIEW
      : SubmissionStatus.PRECHECK_REJECTED;

  // ── 6. ligne OsintSubmission (provenance complète) ───────────────────────────
  const row = await deps.store.insertSubmission({
    imageSha256: sha256,
    perceptualHash: plan.provenance.perceptualHash,
    promptVersion: plan.provenance.promptVersion,
    modelVersion: plan.provenance.modelVersion,
    sourceType: plan.provenance.sourceType,
    trustTier,
    submitter: plan.provenance.submitter,
    rawVisionPass1: plan.provenance.rawVisionPass1,
    rawVisionPass2: plan.provenance.rawVisionPass2,
    decisionReasons: [
      ...plan.provenance.decisionReasons,
      ...allReasons,
      ...(poisoning?.cluster ? [`POISONING:${poisoning.flag}:${poisoning.reason}`] : []),
    ],
    claimsCount: plan.claims.length,
    status,
    evidenceSnapshotId,
    ingestedAt: plan.provenance.ingestedAt,
  });

  return {
    idempotent: false,
    status,
    imageSha256: sha256,
    submissionId: row.id,
    evidenceWritten: evidenceSnapshotId !== null,
    linksWritten,
    poisoning,
    claims: claimResults,
  };
}
