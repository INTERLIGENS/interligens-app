/**
 * src/lib/osint/decision/processSubmission.test.ts
 * SPRINT A — orchestration sur store MOCK (in-memory) + verifyMint MOCK.
 * Aucun appel vision/Helius/DB réel.
 */
import { describe, it, expect } from "vitest";
import { processSubmission } from "./processSubmission";
import type { SubmissionStore, ReviewablePlan, ReviewableClaim } from "./processSubmission";
import type { PriorSubmissionLite } from "./poisoningMonitor";
import type { MintVerification } from "../vision/verifyMintOnChain";
import { ExtractionDecision, SubmissionStatus, ClaimStatus, SourceTrustTier } from "../contracts";
import type { ExtractedClaim, ProvenanceRecord } from "../contracts";

const CA_OK = "FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump";
const CA_OK2 = "GoodMint2222222222222222222222222222222222ab";
const CA_MISMATCH = "MismatchMint11111111111111111111111111111xy";
const CA_NOTFOUND = "FakeMint00000000000000000000000000000000zz";

// verifyMint MOCK : exists + symbol par CA ; not_found pour la fausse CA.
const SYMBOL_BY_CA: Record<string, string> = { [CA_OK]: "TOES", [CA_OK2]: "PEPE", [CA_MISMATCH]: "WRONGSYM" };
const verifyMint = async (mint: string): Promise<MintVerification> => {
  if (mint === CA_NOTFOUND) return { status: "not_found", symbol: null, name: null };
  return { status: "exists", symbol: SYMBOL_BY_CA[mint] ?? "TOES", name: null };
};

function baseClaim(over: Partial<ReviewableClaim> = {}): ReviewableClaim {
  const c: ExtractedClaim = {
    tokenSymbol: "TOES",
    tokenSymbolConfidence: "high",
    contractAddress: CA_OK,
    contractAddressConfidence: "high",
    contractAddressCertain: true,
    chain: "solana",
    chainConfidence: "high",
    perf: "12x",
    kolHandle: "bkokoski",
    kolHandleConfidence: "high",
    decision: { decision: ExtractionDecision.PENDING, reason: "seed" },
    claimStatus: ClaimStatus.UNVERIFIED_SUBMISSION,
  };
  return { ...c, ...over };
}

function plan(claims: ReviewableClaim[], over: Partial<ProvenanceRecord> = {}): ReviewablePlan {
  const provenance: ProvenanceRecord = {
    imageSha256: "a".repeat(64),
    perceptualHash: "ffff0000ffff0000",
    promptVersion: "vision_v1",
    modelVersion: "claude-sonnet-4-5",
    rawVisionPass1: { p: 1 },
    rawVisionPass2: { p: 2 },
    decisionReasons: ["ingest"],
    ingestedAt: "2026-06-29T12:00:00.000Z",
    sourceType: "osint_screenshot",
    trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
    submitter: "iphash_x",
    ...over,
  };
  return { provenance, claims, captureMeta: { fileName: "f.png", bytes: 1, width: null, height: null, capturedAt: null, timezoneAssumption: "Asia/Makassar (UTC+08:00)", sessionId: null } };
}

interface Calls {
  evidence: unknown[];
  links: Array<{ visibility: string; reviewStatus: string; kolHandle: string }>;
  submissions: Array<{ status: SubmissionStatus; claimsCount: number }>;
}
function memStore(opts: { existing?: { id: string; status: string } | null; priors?: PriorSubmissionLite[] } = {}) {
  const calls: Calls = { evidence: [], links: [], submissions: [] };
  const store: SubmissionStore = {
    findByImageSha256: async () => opts.existing ?? null,
    listRecentForPoisoning: async () => opts.priors ?? [],
    insertEvidenceShadow: async (i) => { calls.evidence.push(i); return { id: "ev1" }; },
    upsertLinkDraft: async (i) => { calls.links.push(i as never); return { id: "lk" + (calls.links.length) }; },
    insertSubmission: async (i) => { calls.submissions.push(i as never); return { id: "sub1" }; },
  };
  return { store, calls };
}

describe("processSubmission — shadow orchestration", () => {
  it("KEY CASE: anonymous all-resolved → evidence shadow written, NO KOL-token link", async () => {
    const { store, calls } = memStore();
    const res = await processSubmission(plan([baseClaim()]), SourceTrustTier.ANONYMOUS_RETAIL, { store, verifyMint });

    expect(res.status).toBe(SubmissionStatus.AUTO_COMMITTED_SHADOW);
    expect(res.evidenceWritten).toBe(true);
    expect(res.linksWritten).toBe(0);                // <-- assertion bloquée pour anonyme
    expect(calls.links).toHaveLength(0);
    expect(res.claims[0].decision).toBe(ExtractionDecision.AUTO_COMMIT_EVIDENCE);
    expect(res.claims[0].assertion.status).toBe("blocked");
    // evidence is shadow: not public, not published
    expect(calls.evidence[0]).toMatchObject({ isPublic: false, reviewStatus: "pending" });
  });

  it("investigator all-resolved → evidence + KOL-token link draft", async () => {
    const { store, calls } = memStore();
    const res = await processSubmission(plan([baseClaim()]), SourceTrustTier.INVESTIGATOR, { store, verifyMint });

    expect(res.status).toBe(SubmissionStatus.AUTO_COMMITTED_SHADOW);
    expect(res.linksWritten).toBe(1);
    expect(calls.links[0]).toMatchObject({ visibility: "draft", reviewStatus: "pending_review" });
    expect(res.claims[0].decision).toBe(ExtractionDecision.AUTO_COMMIT_ASSERTION);
  });

  it("CA mismatch on-chain (via verifyMint) → PENDING, no evidence", async () => {
    const { store, calls } = memStore();
    const c = baseClaim({ contractAddress: CA_MISMATCH, tokenSymbol: "TROLL" });
    const res = await processSubmission(plan([c]), SourceTrustTier.INVESTIGATOR, { store, verifyMint });

    expect(res.claims[0].decision).toBe(ExtractionDecision.PENDING);
    expect(res.status).toBe(SubmissionStatus.PENDING_REVIEW);
    expect(res.evidenceWritten).toBe(false);
    expect(calls.evidence).toHaveLength(0);
    expect(calls.links).toHaveLength(0);
  });

  it("2-pass divergence (signals.consensusAgree=false) → PENDING", async () => {
    const { store } = memStore();
    const c = baseClaim({ signals: { consensusAgree: false } });
    const res = await processSubmission(plan([c]), SourceTrustTier.ADMIN, { store, verifyMint });
    expect(res.claims[0].decision).toBe(ExtractionDecision.PENDING);
    expect(res.status).toBe(SubmissionStatus.PENDING_REVIEW);
  });

  it("empty capture → REJECT NO_SIGNAL, status PRECHECK_REJECTED", async () => {
    const { store, calls } = memStore();
    const c = baseClaim({ tokenSymbol: null, contractAddress: null, contractAddressCertain: false, kolHandle: null, perf: null, chain: "unknown" });
    const res = await processSubmission(plan([c]), SourceTrustTier.ADMIN, { store, verifyMint });
    expect(res.claims[0].decision).toBe(ExtractionDecision.REJECT);
    expect(res.status).toBe(SubmissionStatus.PRECHECK_REJECTED);
    expect(calls.evidence).toHaveLength(0);
    expect(calls.links).toHaveLength(0);
  });

  it("multi-claim split: CA#1 evidence, CA#2 mismatch pending, CA#3 evidence + assertion pending (handle uncertain)", async () => {
    const { store, calls } = memStore();
    const c1 = baseClaim({ tokenSymbol: "TOES", contractAddress: CA_OK });
    const c2 = baseClaim({ tokenSymbol: "TROLL", contractAddress: CA_MISMATCH });
    const c3 = baseClaim({ tokenSymbol: "PEPE", contractAddress: CA_OK2, kolHandle: "ghostcaller", kolHandleConfidence: "medium" });
    // anonymous: even c1/c3 (resolved) only commit evidence, never an auto link.
    const res = await processSubmission(plan([c1, c2, c3]), SourceTrustTier.ANONYMOUS_RETAIL, { store, verifyMint });

    expect(res.claims[0].decision).toBe(ExtractionDecision.AUTO_COMMIT_EVIDENCE);
    expect(res.claims[1].decision).toBe(ExtractionDecision.PENDING);
    expect(res.claims[2].decision).toBe(ExtractionDecision.AUTO_COMMIT_EVIDENCE);
    expect(res.claims[2].assertion.pendingReason).toBe("ATTRIBUTION");
    expect(res.evidenceWritten).toBe(true);
    expect(res.linksWritten).toBe(0);             // no public/auto link for anonymous, ever
    expect(calls.links).toHaveLength(0);
    expect(res.status).toBe(SubmissionStatus.AUTO_COMMITTED_SHADOW);
  });

  it("duplicate (same imageSha256 already processed) → DUPLICATE, zero re-processing", async () => {
    const { store, calls } = memStore({ existing: { id: "old1", status: "AUTO_COMMITTED_SHADOW" } });
    const res = await processSubmission(plan([baseClaim()]), SourceTrustTier.INVESTIGATOR, { store, verifyMint });
    expect(res.idempotent).toBe(true);
    expect(res.status).toBe(SubmissionStatus.DUPLICATE);
    expect(calls.evidence).toHaveLength(0);
    expect(calls.links).toHaveLength(0);
    expect(calls.submissions).toHaveLength(0);
  });

  it("poisoning: 3 anonymous similar unverified on same KOL → assertion suppressed even for investigator", async () => {
    const priors: PriorSubmissionLite[] = [
      { imageSha256: "s1", perceptualHash: "ffff0000ffff0000", kolHandle: "bkokoski", trustTier: SourceTrustTier.ANONYMOUS_RETAIL, verified: false, ingestedAt: "2026-06-29T10:00:00.000Z" },
      { imageSha256: "s2", perceptualHash: "ffff0000ffff0001", kolHandle: "bkokoski", trustTier: SourceTrustTier.ANONYMOUS_RETAIL, verified: false, ingestedAt: "2026-06-29T11:00:00.000Z" },
    ];
    const { store, calls } = memStore({ priors });
    // investigator would normally get an auto link; poisoning must block the boost.
    const res = await processSubmission(plan([baseClaim()]), SourceTrustTier.INVESTIGATOR, { store, verifyMint });

    expect(res.poisoning?.cluster).toBe(true);
    expect(res.poisoning?.flag).toBe("possible_coordinated_reporting");
    expect(res.linksWritten).toBe(0);            // confidence boost suppressed
    expect(calls.links).toHaveLength(0);
    expect(res.claims[0].decision).toBe(ExtractionDecision.AUTO_COMMIT_EVIDENCE); // CA still real
    expect(res.claims[0].assertion.autoCommit).toBe(false);
  });

  it("INVARIANT: no write is ever public / published across all paths", async () => {
    const { store, calls } = memStore();
    await processSubmission(plan([baseClaim()]), SourceTrustTier.ADMIN, { store, verifyMint });
    for (const e of calls.evidence) {
      expect((e as { isPublic: boolean }).isPublic).toBe(false);
      expect((e as { reviewStatus: string }).reviewStatus).not.toBe("published");
    }
    for (const l of calls.links) {
      expect(l.visibility).not.toBe("public");
      expect(l.visibility).toBe("draft");
    }
  });

  it("writes the full OsintSubmission provenance row with both vision passes", async () => {
    const { store, calls } = memStore();
    await processSubmission(plan([baseClaim()]), SourceTrustTier.ADMIN, { store, verifyMint });
    expect(calls.submissions).toHaveLength(1);
    expect(calls.submissions[0]).toMatchObject({ claimsCount: 1, status: SubmissionStatus.AUTO_COMMITTED_SHADOW });
  });
});
