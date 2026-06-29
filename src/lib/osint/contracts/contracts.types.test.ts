/**
 * src/lib/osint/contracts/contracts.types.test.ts
 *
 * SPRINT A0 — Test de TYPAGE (pas de logique métier). Le but : prouver que les
 * contrats compilent et sont cohérents en instanciant chaque type/enum avec des
 * valeurs valides. Si un membre d'enum disparaît, un champ change de forme, ou
 * une table de mapping perd l'exhaustivité, tsc/vitest casse ici.
 */

import { describe, it, expect } from "vitest";
import {
  // status
  SubmissionStatus,
  ClaimStatus,
  PendingReason,
  RejectReason,
  SourceTrustTier,
  SOURCE_TRUST_WEIGHT,
  ExtractionDecision,
  // mapping
  CLAIM_STATUS_TO_EVIDENCE,
  CLAIM_STATUS_TO_LINK,
  DECISION_TO_EFFECT,
  EXTRACTION_METHOD_VISION_AUTO,
} from "./index";
import type {
  ExtractedClaim,
  ExtractionDecisionRecord,
  ProvenanceRecord,
  CaptureMeta,
  ExtractionPlan,
  Confidence,
  VisionChain,
} from "./index";

describe("OSINT contracts — typing fixtures compile", () => {
  it("status enums expose every documented member", () => {
    expect(Object.values(SubmissionStatus)).toContain("AUTO_COMMITTED_SHADOW");
    expect(Object.values(SubmissionStatus)).toHaveLength(12);
    expect(Object.values(ClaimStatus)).toHaveLength(5);
    expect(Object.values(PendingReason)).toHaveLength(9);
    expect(Object.values(RejectReason)).toHaveLength(6);
    expect(Object.values(SourceTrustTier)).toHaveLength(5);
    expect(Object.values(ExtractionDecision)).toHaveLength(4);
  });

  it("SourceTrustTier weights are strictly ascending anon < … < admin", () => {
    expect(SOURCE_TRUST_WEIGHT[SourceTrustTier.ANONYMOUS_RETAIL])
      .toBeLessThan(SOURCE_TRUST_WEIGHT[SourceTrustTier.VERIFIED_USER]);
    expect(SOURCE_TRUST_WEIGHT[SourceTrustTier.INTERNAL_WATCHER])
      .toBeLessThan(SOURCE_TRUST_WEIGHT[SourceTrustTier.ADMIN]);
    expect(SOURCE_TRUST_WEIGHT[SourceTrustTier.ADMIN]).toBe(4);
  });

  it("mapping tables are exhaustive over their enums", () => {
    for (const s of Object.values(ClaimStatus)) {
      expect(CLAIM_STATUS_TO_EVIDENCE[s]).toBeDefined();
      expect(CLAIM_STATUS_TO_LINK[s]).toBeDefined();
    }
    for (const d of Object.values(ExtractionDecision)) {
      expect(DECISION_TO_EFFECT[d]).toBeDefined();
    }
    // shadow rule: only human_approved is ever public
    expect(CLAIM_STATUS_TO_EVIDENCE[ClaimStatus.HUMAN_APPROVED].isPublic).toBe(true);
    expect(CLAIM_STATUS_TO_LINK[ClaimStatus.UNVERIFIED_SUBMISSION].visibility).toBe("draft");
    expect(EXTRACTION_METHOD_VISION_AUTO).toBe("vision_auto");
  });

  it("data contracts instantiate with valid values", () => {
    const conf: Confidence = "high";
    const chain: VisionChain = "solana";

    const decision: ExtractionDecisionRecord = {
      decision: ExtractionDecision.PENDING,
      reason: "CA tronqué au bord du screenshot",
      pendingReason: PendingReason.CA_PARTIAL,
    };

    const claim: ExtractedClaim = {
      tokenSymbol: "MOTHER",
      tokenSymbolConfidence: conf,
      contractAddress: null,
      contractAddressConfidence: "low",
      contractAddressCertain: false,
      chain,
      chainConfidence: "medium",
      perf: "12x",
      kolHandle: "bkokoski",
      kolHandleConfidence: "high",
      decision,
      claimStatus: ClaimStatus.UNVERIFIED_SUBMISSION,
    };

    const provenance: ProvenanceRecord = {
      imageSha256: "a".repeat(64),
      perceptualHash: null,
      promptVersion: "vision_v1",
      modelVersion: "claude-sonnet-4-5",
      rawVisionPass1: { tokens: [] },
      rawVisionPass2: null,
      decisionReasons: ["CA_PARTIAL: tail clipped"],
      ingestedAt: "2026-06-29T00:00:00.000Z",
      sourceType: "osint_screenshot",
      trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
      submitter: "iphash_deadbeef",
    };

    const captureMeta: CaptureMeta = {
      fileName: "capture_001.png",
      bytes: 123456,
      width: 1170,
      height: 2532,
      capturedAt: null,
      timezoneAssumption: "Asia/Makassar (UTC+08:00)",
      sessionId: null,
    };

    const plan: ExtractionPlan = { provenance, claims: [claim], captureMeta };

    expect(plan.claims).toHaveLength(1);
    expect(plan.claims[0].decision.pendingReason).toBe(PendingReason.CA_PARTIAL);
    expect(plan.provenance.imageSha256).toHaveLength(64);
    expect(RejectReason.DUPLICATE).toBe("DUPLICATE");
  });
});
