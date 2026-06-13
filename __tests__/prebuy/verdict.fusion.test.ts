/**
 * PRE-BUY GUARD — fusion layer unit tests.
 *
 * Targets the pure deterministic overlay (fusePreBuyVerdict). No DB, no IO.
 * Covers the full fusion matrix, the convergence STOP escalation, the
 * "never clean on absence" invariant, risk-score bands, confidence, evidence
 * links, the forbidden-words guarantee, and determinism.
 */
import { describe, it, expect } from "vitest";
import { fusePreBuyVerdict, type FusionInput } from "@/lib/prebuy/verdict";
import type { ShillCorrelationSummary } from "@/lib/prebuy/shill";
import type { ReferralRiskSummary, TokenKolInvolvement } from "@/lib/prebuy/kol";
import { findForbidden } from "@/lib/reflex/forbidden-words";
import type {
  ReflexAnalysisResult,
  ReflexConfidence,
  ReflexVerdict,
} from "@/lib/reflex/types";

// ─── Fixture builders ───────────────────────────────────────────────────────

function reflexResult(over: {
  verdict: ReflexVerdict;
  confidence?: ReflexConfidence;
  confidenceScore?: number;
  reasonsEn?: string[];
  casefileSignal?: boolean;
}): ReflexAnalysisResult {
  const verdict = over.verdict;
  const reasonsEn =
    over.reasonsEn ??
    (verdict === "NO_CRITICAL_SIGNAL"
      ? ["No critical risk signals detected with current sources."]
      : ["Matches a known risk pattern."]);
  return {
    id: "reflex-test-id",
    createdAt: new Date("2026-06-13T00:00:00.000Z"),
    input: { type: "SOLANA_TOKEN", raw: "MINT" },
    signals: over.casefileSignal
      ? [
          {
            source: "casefileMatch",
            code: "casefileMatch.exact",
            severity: "STRONG",
            confidence: 0.9,
            payload: { ref: "IL-PND-BOTIFY-001" },
          },
        ]
      : [],
    signalsManifest: {},
    signalsHash: "hash",
    enginesVersion: "reflex-test",
    mode: "SHADOW",
    latencyMs: 1,
    verdict,
    verdictReasonEn: reasonsEn,
    verdictReasonFr: ["FR"],
    actionEn: "Do not buy. Do not connect. Do not sign.",
    actionFr: "FR",
    confidence: over.confidence ?? "MEDIUM",
    confidenceScore: over.confidenceScore ?? 0.5,
  };
}

function shill(over: Partial<ShillCorrelationSummary> = {}): ShillCorrelationSummary {
  return {
    available: true,
    shillEventCount: 0,
    survivingCount: 0,
    maxScore: 0,
    topClassification: null,
    hasHighInterest: false,
    kolHandles: [],
    reason: "test",
    ...over,
  };
}

function referral(over: Partial<ReferralRiskSummary> = {}): ReferralRiskSummary {
  return {
    available: true,
    handle: null,
    found: false,
    flagged: false,
    riskFlag: null,
    label: null,
    tier: null,
    rugCount: 0,
    behaviorFlags: [],
    published: false,
    reason: "test",
    ...over,
  };
}

function tokenKol(over: Partial<TokenKolInvolvement> = {}): TokenKolInvolvement {
  return {
    available: true,
    involvedCount: 0,
    hasFrontRunner: false,
    worstTier: null,
    handles: [],
    ...over,
  };
}

function input(over: Partial<FusionInput> = {}): FusionInput {
  return {
    reflex: reflexResult({ verdict: "NO_CRITICAL_SIGNAL" }),
    shill: shill(),
    referral: referral(),
    tokenKol: tokenKol(),
    casefilePresent: false,
    computedAt: "2026-06-13T00:00:00.000Z",
    ...over,
  };
}

// ─── Verdict mapping (no new signals) ────────────────────────────────────────

describe("fusePreBuyVerdict — REFLEX verdict mapping with no overlay signals", () => {
  it("STOP → STOP", () => {
    expect(fusePreBuyVerdict(input({ reflex: reflexResult({ verdict: "STOP" }) })).verdict).toBe("STOP");
  });
  it("WAIT → CAUTION", () => {
    expect(fusePreBuyVerdict(input({ reflex: reflexResult({ verdict: "WAIT" }) })).verdict).toBe("CAUTION");
  });
  it("VERIFY → CAUTION", () => {
    expect(fusePreBuyVerdict(input({ reflex: reflexResult({ verdict: "VERIFY" }) })).verdict).toBe("CAUTION");
  });
  it("NO_CRITICAL_SIGNAL → CLEAR", () => {
    expect(fusePreBuyVerdict(input()).verdict).toBe("CLEAR");
  });
});

// ─── Single new signal → at least CAUTION ────────────────────────────────────

describe("fusePreBuyVerdict — single new signal escalates a CLEAR base to CAUTION", () => {
  it("surviving shill candidate alone → CAUTION", () => {
    const v = fusePreBuyVerdict(input({ shill: shill({ survivingCount: 1, maxScore: 50 }) }));
    expect(v.verdict).toBe("CAUTION");
  });
  it("flagged referring KOL alone → CAUTION", () => {
    const v = fusePreBuyVerdict(
      input({ referral: referral({ found: true, flagged: true, riskFlag: "flagged", handle: "dexsignals" }) }),
    );
    expect(v.verdict).toBe("CAUTION");
  });
  it("published casefile alone → CAUTION", () => {
    const v = fusePreBuyVerdict(
      input({ reflex: reflexResult({ verdict: "NO_CRITICAL_SIGNAL", casefileSignal: true }), casefilePresent: true }),
    );
    expect(v.verdict).toBe("CAUTION");
  });
  it("documented front-runner alone → CAUTION", () => {
    const v = fusePreBuyVerdict(input({ tokenKol: tokenKol({ involvedCount: 1, hasFrontRunner: true }) }));
    expect(v.verdict).toBe("CAUTION");
  });
});

// ─── Convergence STOP escalation ─────────────────────────────────────────────

describe("fusePreBuyVerdict — convergence STOP escalation", () => {
  it("high_interest shill + flagged KOL escalates a sub-STOP base to STOP", () => {
    const v = fusePreBuyVerdict(
      input({
        reflex: reflexResult({ verdict: "WAIT" }),
        shill: shill({ survivingCount: 2, hasHighInterest: true, topClassification: "high_interest", maxScore: 88 }),
        referral: referral({ found: true, flagged: true, riskFlag: "flagged", handle: "dexsignals" }),
      }),
    );
    expect(v.verdict).toBe("STOP");
    expect(v.confidence).toBe("HIGH"); // ≥2 new signals
  });

  it("high_interest shill WITHOUT a flagged KOL does NOT escalate to STOP", () => {
    const v = fusePreBuyVerdict(
      input({
        reflex: reflexResult({ verdict: "NO_CRITICAL_SIGNAL" }),
        shill: shill({ survivingCount: 2, hasHighInterest: true, topClassification: "high_interest", maxScore: 88 }),
      }),
    );
    expect(v.verdict).toBe("CAUTION");
  });

  it("flagged KOL without a high_interest shill does NOT escalate to STOP", () => {
    const v = fusePreBuyVerdict(
      input({
        reflex: reflexResult({ verdict: "VERIFY" }),
        referral: referral({ found: true, flagged: true, riskFlag: "flagged", handle: "x" }),
      }),
    );
    expect(v.verdict).toBe("CAUTION");
  });
});

// ─── "Never clean on absence" invariant ──────────────────────────────────────

describe("fusePreBuyVerdict — absence of shill data is never reassurance", () => {
  it("unavailable shill data does not escalate and does not force CLEAR beyond REFLEX", () => {
    const v = fusePreBuyVerdict(
      input({ reflex: reflexResult({ verdict: "NO_CRITICAL_SIGNAL" }), shill: shill({ available: false }) }),
    );
    expect(v.verdict).toBe("CLEAR");
    expect(v.reasons.some((r) => /partial/i.test(r))).toBe(true);
  });

  it("REFLEX STOP stays STOP even when shill data is unavailable", () => {
    const v = fusePreBuyVerdict(
      input({ reflex: reflexResult({ verdict: "STOP" }), shill: shill({ available: false }) }),
    );
    expect(v.verdict).toBe("STOP");
  });

  it("does not emit a partial-coverage caveat when shill data IS available", () => {
    const v = fusePreBuyVerdict(input({ shill: shill({ available: true }) }));
    expect(v.reasons.some((r) => /partial/i.test(r))).toBe(false);
  });
});

// ─── Risk score bands ─────────────────────────────────────────────────────────

describe("fusePreBuyVerdict — risk_score stays consistent with the verdict band", () => {
  it("STOP ≥ 75", () => {
    const v = fusePreBuyVerdict(input({ reflex: reflexResult({ verdict: "STOP", confidenceScore: 0.1 }) }));
    expect(v.risk_score).toBeGreaterThanOrEqual(75);
  });
  it("CAUTION within 40–74", () => {
    const v = fusePreBuyVerdict(input({ reflex: reflexResult({ verdict: "WAIT", confidenceScore: 0.1 }) }));
    expect(v.risk_score).toBeGreaterThanOrEqual(40);
    expect(v.risk_score).toBeLessThanOrEqual(74);
  });
  it("CLEAR ≤ 39", () => {
    const v = fusePreBuyVerdict(input({ reflex: reflexResult({ verdict: "NO_CRITICAL_SIGNAL", confidenceScore: 0.9 }) }));
    expect(v.risk_score).toBeLessThanOrEqual(39);
  });
});

// ─── Evidence links ───────────────────────────────────────────────────────────

describe("fusePreBuyVerdict — evidence links", () => {
  it("always references the REFLEX analysis id", () => {
    const v = fusePreBuyVerdict(input());
    expect(v.evidence_links.some((e) => e.type === "reflex" && e.ref === "reflex-test-id")).toBe(true);
  });
  it("links surviving shill candidates to the admin review surface", () => {
    const v = fusePreBuyVerdict(input({ shill: shill({ survivingCount: 1, kolHandles: ["dexsignals"] }) }));
    const link = v.evidence_links.find((e) => e.type === "shill_candidate");
    expect(link?.url).toContain("/admin/shill-correlation?kol=dexsignals");
  });
  it("links the casefile reference when present", () => {
    const v = fusePreBuyVerdict(
      input({ reflex: reflexResult({ verdict: "WAIT", casefileSignal: true }), casefilePresent: true }),
    );
    expect(v.evidence_links.some((e) => e.type === "casefile" && e.ref === "IL-PND-BOTIFY-001")).toBe(true);
  });

  it("includes orchestrator-supplied casefile links (preset / TokenCaseFile) and dedups", () => {
    const v = fusePreBuyVerdict(
      input({
        casefilePresent: true,
        casefileLinks: [
          { type: "casefile", ref: "preset:botify", url: "/api/casefile/public?mint=X" },
          { type: "casefile", ref: "preset:botify", url: "/api/casefile/public?mint=X" }, // dup
        ],
      }),
    );
    const presetLinks = v.evidence_links.filter((e) => e.ref === "preset:botify");
    expect(presetLinks).toHaveLength(1); // deduped
  });
});

describe("fusePreBuyVerdict — preset casefile escalates without a REFLEX signal", () => {
  it("a preset casefile (no reflex casefileMatch) still escalates CLEAR base to CAUTION", () => {
    const v = fusePreBuyVerdict(
      input({
        reflex: reflexResult({ verdict: "NO_CRITICAL_SIGNAL" }), // no casefileSignal
        casefilePresent: true,
        casefileLinks: [{ type: "casefile", ref: "preset:botify" }],
      }),
    );
    expect(v.verdict).toBe("CAUTION");
    expect(v.evidence_links.some((e) => e.ref === "preset:botify")).toBe(true);
  });
});

// ─── Forbidden-words guarantee + determinism + shape ─────────────────────────

describe("fusePreBuyVerdict — safety, determinism, shape", () => {
  it("all reasons pass the forbidden-words lint across every signal combination", () => {
    const v = fusePreBuyVerdict(
      input({
        reflex: reflexResult({ verdict: "WAIT" }),
        shill: shill({ survivingCount: 3, hasHighInterest: true, topClassification: "high_interest", kolHandles: ["a"] }),
        referral: referral({ found: true, flagged: true, riskFlag: "flagged", handle: "a", label: "rugger" }),
        tokenKol: tokenKol({ involvedCount: 1, hasFrontRunner: true, handles: ["a"] }),
        casefilePresent: true,
      }),
    );
    expect(findForbidden(v.reasons)).toEqual([]);
  });

  it("is deterministic — same input yields identical output", () => {
    const i = input({
      reflex: reflexResult({ verdict: "WAIT" }),
      shill: shill({ survivingCount: 2, hasHighInterest: true, kolHandles: ["a", "b"] }),
      referral: referral({ found: true, flagged: true, riskFlag: "flagged", handle: "a" }),
    });
    expect(fusePreBuyVerdict(i)).toEqual(fusePreBuyVerdict(i));
  });

  it("always returns SHADOW mode and a full layers breakdown", () => {
    const v = fusePreBuyVerdict(input());
    expect(v.mode).toBe("SHADOW");
    expect(v.layers.reflex.verdict).toBe("NO_CRITICAL_SIGNAL");
    expect(v.layers).toHaveProperty("shillCorrelation");
    expect(v.layers).toHaveProperty("referral");
    expect(v.layers).toHaveProperty("tokenKol");
  });
});
