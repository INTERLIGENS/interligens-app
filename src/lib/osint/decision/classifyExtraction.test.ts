/**
 * src/lib/osint/decision/classifyExtraction.test.ts
 * SPRINT A — décision PAR CLAIM (pure, sur mock). Aucun appel vision/Helius réel.
 */
import { describe, it, expect } from "vitest";
import { classifyClaim } from "./classifyExtraction";
import type { ClaimUnderReview, ClaimSignals } from "./classifyExtraction";
import {
  ExtractionDecision,
  ClaimStatus,
  PendingReason,
  RejectReason,
  SourceTrustTier,
} from "../contracts";
import type { ProvenanceRecord } from "../contracts";

const PROV: ProvenanceRecord = {
  imageSha256: "a".repeat(64),
  perceptualHash: "ffff0000ffff0000",
  promptVersion: "vision_v1",
  modelVersion: "claude-sonnet-4-5",
  rawVisionPass1: {},
  rawVisionPass2: {},
  decisionReasons: [],
  ingestedAt: "2026-06-29T00:00:00.000Z",
  sourceType: "osint_screenshot",
  trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
  submitter: "iphash_x",
};

const ALL_OK_SIGNALS: ClaimSignals = {
  caState: "present",
  consensusAgree: true,
  mintStatus: "exists",
  tickerMatch: "match",
  chainKnown: true,
  imageExploitable: true,
  suspectImage: false,
  isDuplicate: false,
};

function claim(over: Partial<ClaimUnderReview> = {}, sig: Partial<ClaimSignals> = {}): ClaimUnderReview {
  return {
    tokenSymbol: "TOES",
    tokenSymbolConfidence: "high",
    contractAddress: "FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump",
    contractAddressConfidence: "high",
    contractAddressCertain: true,
    chain: "solana",
    chainConfidence: "high",
    perf: "12x",
    kolHandle: "bkokoski",
    kolHandleConfidence: "high",
    decision: { decision: ExtractionDecision.PENDING, reason: "seed" },
    claimStatus: ClaimStatus.UNVERIFIED_SUBMISSION,
    signals: { ...ALL_OK_SIGNALS, ...sig },
    ...over,
  };
}

describe("classifyClaim — doctrine token≠claim", () => {
  it("KEY CASE: all-resolved + anonymous → AUTO_COMMIT_EVIDENCE, assertion BLOCKED", () => {
    const d = classifyClaim(claim(), PROV, SourceTrustTier.ANONYMOUS_RETAIL);
    expect(d.decision.decision).toBe(ExtractionDecision.AUTO_COMMIT_EVIDENCE);
    expect(d.claimStatus).toBe(ClaimStatus.ONCHAIN_VERIFIED_ONLY);
    expect(d.assertion.autoCommit).toBe(false);
    expect(d.assertion.status).toBe("blocked");
    expect(d.assertion.pendingReason).toBe(PendingReason.ATTRIBUTION);
  });

  it("all-resolved + investigator → AUTO_COMMIT_ASSERTION (link allowed)", () => {
    const d = classifyClaim(claim(), PROV, SourceTrustTier.INVESTIGATOR);
    expect(d.decision.decision).toBe(ExtractionDecision.AUTO_COMMIT_ASSERTION);
    expect(d.claimStatus).toBe(ClaimStatus.ATTRIBUTION_VERIFIED);
    expect(d.assertion.autoCommit).toBe(true);
    expect(d.assertion.status).toBe("auto_shadow");
  });

  it("admin also passes the trust gate", () => {
    const d = classifyClaim(claim(), PROV, SourceTrustTier.ADMIN);
    expect(d.decision.decision).toBe(ExtractionDecision.AUTO_COMMIT_ASSERTION);
  });

  it("investigator but weak attribution (handle medium) → EVIDENCE only, assertion pending", () => {
    const d = classifyClaim(claim({ kolHandleConfidence: "medium" }), PROV, SourceTrustTier.INVESTIGATOR);
    expect(d.decision.decision).toBe(ExtractionDecision.AUTO_COMMIT_EVIDENCE);
    expect(d.assertion.autoCommit).toBe(false);
    expect(d.assertion.status).toBe("pending");
    expect(d.assertion.pendingReason).toBe(PendingReason.ATTRIBUTION);
  });

  it("mint not_found on-chain → PENDING MINT_NOT_FOUND", () => {
    const d = classifyClaim(claim({}, { mintStatus: "not_found", tickerMatch: "not_checked" }), PROV, SourceTrustTier.INVESTIGATOR);
    expect(d.decision.decision).toBe(ExtractionDecision.PENDING);
    expect(d.decision.pendingReason).toBe(PendingReason.MINT_NOT_FOUND);
  });

  it("2-pass divergence (consensus false) → PENDING (low confidence)", () => {
    const d = classifyClaim(claim({}, { consensusAgree: false }), PROV, SourceTrustTier.ADMIN);
    expect(d.decision.decision).toBe(ExtractionDecision.PENDING);
    expect(d.decision.pendingReason).toBe(PendingReason.LOW_CONFIDENCE);
  });

  it("ticker mismatch → PENDING TICKER_MISMATCH", () => {
    const d = classifyClaim(claim({}, { tickerMatch: "mismatch" }), PROV, SourceTrustTier.ADMIN);
    expect(d.decision.decision).toBe(ExtractionDecision.PENDING);
    expect(d.decision.pendingReason).toBe(PendingReason.TICKER_MISMATCH);
  });

  it("CA absent → PENDING CA_ABSENT", () => {
    const d = classifyClaim(
      claim({ contractAddress: null, contractAddressCertain: false }, { caState: "absent", mintStatus: "not_checked", tickerMatch: "not_checked" }),
      PROV, SourceTrustTier.ADMIN,
    );
    expect(d.decision.decision).toBe(ExtractionDecision.PENDING);
    expect(d.decision.pendingReason).toBe(PendingReason.CA_ABSENT);
  });

  it("CA partial / clipped tail → PENDING CA_PARTIAL", () => {
    const d = classifyClaim(
      claim({ contractAddress: null, contractAddressCertain: false }, { caState: "partial", mintStatus: "not_checked", tickerMatch: "not_checked" }),
      PROV, SourceTrustTier.ADMIN,
    );
    expect(d.decision.decision).toBe(ExtractionDecision.PENDING);
    expect(d.decision.pendingReason).toBe(PendingReason.CA_PARTIAL);
  });

  it("chain unknown → PENDING CHAIN_AMBIGUOUS", () => {
    const d = classifyClaim(
      claim({ chain: "unknown" }, { chainKnown: false }),
      PROV, SourceTrustTier.ADMIN,
    );
    expect(d.decision.decision).toBe(ExtractionDecision.PENDING);
    expect(d.decision.pendingReason).toBe(PendingReason.CHAIN_AMBIGUOUS);
  });

  it("empty claim (no signal) → REJECT NO_SIGNAL", () => {
    const d = classifyClaim(
      claim({ tokenSymbol: null, contractAddress: null, contractAddressCertain: false, kolHandle: null, perf: null },
        { caState: "absent", mintStatus: "not_checked", tickerMatch: "not_checked", chainKnown: false }),
      PROV, SourceTrustTier.ADMIN,
    );
    expect(d.decision.decision).toBe(ExtractionDecision.REJECT);
    expect(d.decision.rejectReason).toBe(RejectReason.NO_SIGNAL);
  });

  it("suspect image wins priority → PENDING SUSPECT_IMAGE", () => {
    const d = classifyClaim(claim({}, { suspectImage: true }), PROV, SourceTrustTier.ADMIN);
    expect(d.decision.decision).toBe(ExtractionDecision.PENDING);
    expect(d.decision.pendingReason).toBe(PendingReason.SUSPECT_IMAGE);
  });

  it("score is explanatory: high when all-OK, never decides", () => {
    const ok = classifyClaim(claim(), PROV, SourceTrustTier.ADMIN);
    const bad = classifyClaim(claim({}, { mintStatus: "not_found" }), PROV, SourceTrustTier.ANONYMOUS_RETAIL);
    expect(ok.score).toBeGreaterThan(bad.score);
    expect(ok.score).toBeLessThanOrEqual(100);
    expect(bad.score).toBeGreaterThanOrEqual(0);
  });

  it("NEVER produces a public verdict — only the 4 A0 decisions", () => {
    const d = classifyClaim(claim(), PROV, SourceTrustTier.ANONYMOUS_RETAIL);
    expect(Object.values(ExtractionDecision)).toContain(d.decision.decision);
  });
});
