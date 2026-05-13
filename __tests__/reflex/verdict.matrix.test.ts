import { describe, it, expect } from "vitest";
import { decide } from "@/lib/reflex/verdict";
import {
  ACTION_WORDING,
  DISCLAIMER_NO_SIGNAL,
  MAX_VERDICT_REASONS,
  NARRATIVE_MATCH_WAIT_THRESHOLD,
} from "@/lib/reflex/constants";
import { findForbidden } from "@/lib/reflex/forbidden-words";
import type {
  ReflexEngineOutput,
  ReflexSignal,
  ReflexSignalSeverity,
  ReflexSignalSource,
} from "@/lib/reflex/types";

// ─── Test fixture builders ────────────────────────────────────────────────

function sig(over: {
  source: ReflexSignalSource;
  code: string;
  severity?: ReflexSignalSeverity;
  confidence?: number;
  stopTrigger?: boolean;
  reasonEn?: string;
  reasonFr?: string;
  payload?: Record<string, unknown>;
}): ReflexSignal {
  return {
    severity: "MODERATE",
    confidence: 0.6,
    payload: {},
    ...over,
  };
}

function eng(
  engine: ReflexEngineOutput["engine"],
  signals: ReflexSignal[],
): ReflexEngineOutput {
  return { engine, ran: true, ms: 1, signals };
}

const STOP_REASON = {
  en: "Address matches a known risk pattern.",
  fr: "L'adresse correspond à un schéma de risque connu.",
};

const KNOWN_BAD_STOP = sig({
  source: "knownBad",
  code: "knownBad.scam.eth",
  severity: "CRITICAL",
  confidence: 1.0,
  stopTrigger: true,
  reasonEn: STOP_REASON.en,
  reasonFr: STOP_REASON.fr,
});

const CASEFILE_STOP = sig({
  source: "casefileMatch",
  code: "casefileMatch.exact",
  severity: "CRITICAL",
  confidence: 1.0,
  stopTrigger: true,
  reasonEn: STOP_REASON.en,
  reasonFr: STOP_REASON.fr,
});

const INTEL_SANCTION_STOP = sig({
  source: "intelligenceOverlay",
  code: "intelligenceOverlay.sanction",
  severity: "CRITICAL",
  confidence: 1.0,
  stopTrigger: true,
  reasonEn: STOP_REASON.en,
  reasonFr: STOP_REASON.fr,
});

// ─── STOP branches ────────────────────────────────────────────────────────

describe("verdict.matrix — STOP triggers", () => {
  it("knownBad stopTrigger → STOP", () => {
    const r = decide([eng("knownBad", [KNOWN_BAD_STOP])]);
    expect(r.verdict).toBe("STOP");
    expect(r.actionEn).toBe(ACTION_WORDING.STOP.en);
    expect(r.actionFr).toBe(ACTION_WORDING.STOP.fr);
    expect(r.verdictReasonEn.length).toBeGreaterThan(0);
    expect(r.verdictReasonFr.length).toBeGreaterThan(0);
  });

  it("casefileMatch stopTrigger → STOP", () => {
    const r = decide([eng("casefileMatch", [CASEFILE_STOP])]);
    expect(r.verdict).toBe("STOP");
  });

  it("intelligenceOverlay sanction → STOP", () => {
    const r = decide([eng("intelligenceOverlay", [INTEL_SANCTION_STOP])]);
    expect(r.verdict).toBe("STOP");
  });

  it("convergence STOP: recidivist + 2 CRITICAL drivers + confidence ≥ 0.7 → STOP", () => {
    const r = decide([
      eng("recidivism", [
        sig({
          source: "recidivism",
          code: "recidivism.recidivist",
          severity: "STRONG",
          confidence: 0.9,
        }),
      ]),
      eng("tigerscore", [
        sig({
          source: "tigerscore",
          code: "tigerscore.unlimited_approvals",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
        sig({
          source: "tigerscore",
          code: "tigerscore.freeze_authority",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
      ]),
    ]);
    expect(r.verdict).toBe("STOP");
    expect(r.confidenceScore).toBeGreaterThanOrEqual(0.7);
  });

  it("convergence false-negative: only 1 CRITICAL driver → not STOP", () => {
    const r = decide([
      eng("recidivism", [
        sig({
          source: "recidivism",
          code: "recidivism.recidivist",
          severity: "STRONG",
          confidence: 0.9,
        }),
      ]),
      eng("tigerscore", [
        sig({
          source: "tigerscore",
          code: "tigerscore.unlimited_approvals",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
      ]),
    ]);
    expect(r.verdict).not.toBe("STOP");
  });

  it("convergence false-negative: prior_case (1) not recidivist → not STOP", () => {
    const r = decide([
      eng("recidivism", [
        sig({
          source: "recidivism",
          code: "recidivism.prior_case",
          severity: "MODERATE",
          confidence: 0.7,
        }),
      ]),
      eng("tigerscore", [
        sig({
          source: "tigerscore",
          code: "tigerscore.unlimited_approvals",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
        sig({
          source: "tigerscore",
          code: "tigerscore.freeze_authority",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
      ]),
    ]);
    expect(r.verdict).not.toBe("STOP");
  });
});

// ─── WAIT branches ────────────────────────────────────────────────────────

describe("verdict.matrix — WAIT triggers", () => {
  it("narrative match with confidence ≥ NARRATIVE_MATCH_WAIT_THRESHOLD → WAIT", () => {
    const r = decide([
      eng("narrative", [
        sig({
          source: "narrative",
          code: "narrative.FAKE_AUDIT",
          severity: "STRONG",
          confidence: NARRATIVE_MATCH_WAIT_THRESHOLD + 0.1,
          payload: { category: "TRUST_HIJACK", scriptLabel: "Unverifiable audit claim" },
        }),
      ]),
    ]);
    expect(r.verdict).toBe("WAIT");
    expect(r.actionEn).toBe(ACTION_WORDING.WAIT.en);
  });

  it("narrative match with confidence < threshold → not WAIT (falls to VERIFY/NO_SIGNAL)", () => {
    const r = decide([
      eng("narrative", [
        sig({
          source: "narrative",
          code: "narrative.AI_RWA_NARRATIVE_HIJACK",
          severity: "MODERATE",
          confidence: NARRATIVE_MATCH_WAIT_THRESHOLD - 0.1,
          payload: { category: "TRUST_HIJACK" },
        }),
      ]),
    ]);
    expect(r.verdict).not.toBe("WAIT");
  });

  it("coordination MODERATE → WAIT", () => {
    const r = decide([
      eng("coordination", [
        sig({
          source: "coordination",
          code: "coordination.coordinated_promotion",
          severity: "MODERATE",
          confidence: 0.65,
        }),
      ]),
    ]);
    expect(r.verdict).toBe("WAIT");
  });

  it("coordination STRONG → WAIT", () => {
    const r = decide([
      eng("coordination", [
        sig({
          source: "coordination",
          code: "coordination.repeated_cashout",
          severity: "STRONG",
          confidence: 0.85,
        }),
      ]),
    ]);
    expect(r.verdict).toBe("WAIT");
  });

  it("coordination WEAK alone → not WAIT", () => {
    const r = decide([
      eng("coordination", [
        sig({
          source: "coordination",
          code: "coordination.shared_actor_group",
          severity: "WEAK",
          confidence: 0.4,
        }),
      ]),
    ]);
    expect(r.verdict).not.toBe("WAIT");
  });

  it("convergence WAIT: 3 weak/moderate signals → WAIT", () => {
    const r = decide([
      eng("tigerscore", [
        sig({
          source: "tigerscore",
          code: "tigerscore.high_approvals",
          severity: "MODERATE",
          confidence: 0.6,
        }),
      ]),
      eng("offchain", [
        sig({
          source: "offchain",
          code: "offchain.band.low",
          severity: "MODERATE",
          confidence: 0.6,
        }),
      ]),
      eng("coordination", [
        sig({
          source: "coordination",
          code: "coordination.shared_actor_group",
          severity: "WEAK",
          confidence: 0.4,
        }),
      ]),
    ]);
    expect(r.verdict).toBe("WAIT");
  });

  it("convergence WAIT false-negative: 2 weak/moderate signals (need 3) → not WAIT", () => {
    const r = decide([
      eng("tigerscore", [
        sig({
          source: "tigerscore",
          code: "tigerscore.high_approvals",
          severity: "MODERATE",
          confidence: 0.6,
        }),
      ]),
      eng("offchain", [
        sig({
          source: "offchain",
          code: "offchain.band.low",
          severity: "MODERATE",
          confidence: 0.6,
        }),
      ]),
    ]);
    expect(r.verdict).not.toBe("WAIT");
  });
});

// ─── VERIFY branch ────────────────────────────────────────────────────────

describe("verdict.matrix — VERIFY", () => {
  it("narrative TRUST_HIJACK with confidence < WAIT threshold → VERIFY", () => {
    const r = decide([
      eng("narrative", [
        sig({
          source: "narrative",
          code: "narrative.AI_RWA_NARRATIVE_HIJACK",
          severity: "MODERATE",
          confidence: 0.55,
          payload: { category: "TRUST_HIJACK" },
        }),
      ]),
    ]);
    expect(r.verdict).toBe("VERIFY");
    expect(r.actionEn).toBe(ACTION_WORDING.VERIFY.en);
    expect(r.actionFr).toBe(ACTION_WORDING.VERIFY.fr);
  });

  it("narrative AUTHORITY with confidence < WAIT threshold → VERIFY", () => {
    const r = decide([
      eng("narrative", [
        sig({
          source: "narrative",
          code: "narrative.KOL_INSIDER_CALL",
          severity: "MODERATE",
          confidence: 0.55,
          payload: { category: "AUTHORITY" },
        }),
      ]),
    ]);
    expect(r.verdict).toBe("VERIFY");
  });

  it("narrative FOMO (non-claim category) alone with low confidence → NO_CRITICAL_SIGNAL", () => {
    const r = decide([
      eng("narrative", [
        sig({
          source: "narrative",
          code: "narrative.LAST_CHANCE",
          severity: "MODERATE",
          confidence: 0.5,
          payload: { category: "FOMO" },
        }),
      ]),
    ]);
    expect(r.verdict).toBe("NO_CRITICAL_SIGNAL");
  });
});

// ─── NO_CRITICAL_SIGNAL branch ────────────────────────────────────────────

describe("verdict.matrix — NO_CRITICAL_SIGNAL", () => {
  it("all engines ran clean → NO_CRITICAL_SIGNAL", () => {
    const r = decide([
      eng("tigerscore", []),
      eng("offchain", []),
      eng("knownBad", []),
    ]);
    expect(r.verdict).toBe("NO_CRITICAL_SIGNAL");
    expect(r.verdictReasonEn).toEqual([DISCLAIMER_NO_SIGNAL.en]);
    expect(r.verdictReasonFr).toEqual([DISCLAIMER_NO_SIGNAL.fr]);
  });

  it("no engines ran → NO_CRITICAL_SIGNAL with LOW confidence", () => {
    const r = decide([]);
    expect(r.verdict).toBe("NO_CRITICAL_SIGNAL");
    expect(r.confidence).toBe("LOW");
    expect(r.confidenceScore).toBe(0);
  });

  it("NO_CRITICAL action wording is empty (no action prompt)", () => {
    const r = decide([eng("tigerscore", []), eng("offchain", [])]);
    expect(r.actionEn).toBe("");
    expect(r.actionFr).toBe("");
  });
});

// ─── Priority — when multiple branches match ──────────────────────────────

describe("verdict.matrix — priority", () => {
  it("STOP wins over WAIT when both apply", () => {
    const r = decide([
      eng("knownBad", [KNOWN_BAD_STOP]),
      eng("narrative", [
        sig({
          source: "narrative",
          code: "narrative.FAKE_AUDIT",
          severity: "STRONG",
          confidence: 0.75,
          payload: { category: "TRUST_HIJACK" },
        }),
      ]),
    ]);
    expect(r.verdict).toBe("STOP");
  });

  it("WAIT wins over VERIFY: TRUST_HIJACK at high confidence triggers WAIT first", () => {
    const r = decide([
      eng("narrative", [
        sig({
          source: "narrative",
          code: "narrative.FAKE_AUDIT",
          severity: "STRONG",
          confidence: 0.75, // ≥ WAIT threshold
          payload: { category: "TRUST_HIJACK" },
        }),
      ]),
    ]);
    expect(r.verdict).toBe("WAIT");
  });

  it("VERIFY wins over NO_CRITICAL when an unverifiable claim is present", () => {
    const r = decide([
      eng("narrative", [
        sig({
          source: "narrative",
          code: "narrative.FAKE_PARTNERSHIP",
          severity: "MODERATE",
          confidence: 0.5,
          payload: { category: "TRUST_HIJACK" },
        }),
      ]),
      eng("offchain", []),
    ]);
    expect(r.verdict).toBe("VERIFY");
  });

  it("convergence WAIT does not eclipse explicit STOP trigger", () => {
    const r = decide([
      eng("casefileMatch", [CASEFILE_STOP]),
      eng("tigerscore", [
        sig({
          source: "tigerscore",
          code: "tigerscore.high_approvals",
          severity: "MODERATE",
          confidence: 0.6,
        }),
      ]),
      eng("offchain", [
        sig({
          source: "offchain",
          code: "offchain.band.low",
          severity: "MODERATE",
          confidence: 0.6,
        }),
      ]),
      eng("coordination", [
        sig({
          source: "coordination",
          code: "coordination.shared_actor_group",
          severity: "WEAK",
          confidence: 0.4,
        }),
      ]),
    ]);
    expect(r.verdict).toBe("STOP");
  });
});

// ─── Reason quality + lint ────────────────────────────────────────────────

describe("verdict.matrix — reason quality + output lint", () => {
  it("returns at most MAX_VERDICT_REASONS reasons", () => {
    const r = decide([
      eng("tigerscore", [
        sig({ source: "tigerscore", code: "tigerscore.unlimited_approvals", severity: "CRITICAL", confidence: 0.9 }),
        sig({ source: "tigerscore", code: "tigerscore.freeze_authority", severity: "CRITICAL", confidence: 0.9 }),
        sig({ source: "tigerscore", code: "tigerscore.high_approvals", severity: "STRONG", confidence: 0.7 }),
        sig({ source: "tigerscore", code: "tigerscore.unknown_programs", severity: "STRONG", confidence: 0.7 }),
        sig({ source: "tigerscore", code: "tigerscore.mint_authority", severity: "STRONG", confidence: 0.7 }),
      ]),
      eng("recidivism", [
        sig({
          source: "recidivism",
          code: "recidivism.recidivist",
          severity: "STRONG",
          confidence: 0.9,
        }),
      ]),
    ]);
    expect(r.verdict).toBe("STOP");
    expect(r.verdictReasonEn.length).toBeLessThanOrEqual(MAX_VERDICT_REASONS);
    expect(r.verdictReasonFr.length).toBeLessThanOrEqual(MAX_VERDICT_REASONS);
  });

  it("EN and FR reason arrays have the same length", () => {
    const r = decide([eng("knownBad", [KNOWN_BAD_STOP])]);
    expect(r.verdictReasonEn.length).toBe(r.verdictReasonFr.length);
  });

  it("all output strings pass the forbidden-words lint (assertClean runs)", () => {
    expect(() =>
      decide([
        eng("knownBad", [KNOWN_BAD_STOP]),
        eng("narrative", [
          sig({
            source: "narrative",
            code: "narrative.FAKE_AUDIT",
            severity: "STRONG",
            confidence: 0.75,
            payload: { category: "TRUST_HIJACK" },
          }),
        ]),
      ]),
    ).not.toThrow();
  });

  it("EN + FR reasons themselves are lint-clean (post-condition)", () => {
    const r = decide([eng("knownBad", [KNOWN_BAD_STOP])]);
    expect(findForbidden([...r.verdictReasonEn, ...r.verdictReasonFr])).toHaveLength(0);
  });

  it("dedupes signals by code (one reason per distinct code)", () => {
    const r = decide([
      eng("tigerscore", [
        sig({ source: "tigerscore", code: "tigerscore.freeze_authority", severity: "CRITICAL", confidence: 0.9 }),
        sig({ source: "tigerscore", code: "tigerscore.freeze_authority", severity: "CRITICAL", confidence: 0.9 }),
      ]),
      eng("recidivism", [
        sig({
          source: "recidivism",
          code: "recidivism.recidivist",
          severity: "STRONG",
          confidence: 0.9,
        }),
      ]),
      eng("tigerscore", [
        sig({ source: "tigerscore", code: "tigerscore.mint_authority", severity: "CRITICAL", confidence: 0.9 }),
      ]),
    ]);
    expect(r.verdict).toBe("STOP");
    // No duplicate strings even though freeze_authority appears twice
    expect(new Set(r.verdictReasonEn).size).toBe(r.verdictReasonEn.length);
  });
});

// ─── Confidence discretization ────────────────────────────────────────────

describe("verdict.matrix — confidence label discretization", () => {
  it("HIGH label when global score ≥ 0.75", () => {
    const r = decide([
      eng("knownBad", [KNOWN_BAD_STOP]),
      eng("casefileMatch", [CASEFILE_STOP]),
    ]);
    expect(r.confidenceScore).toBeGreaterThanOrEqual(0.75);
    expect(r.confidence).toBe("HIGH");
  });

  it("MEDIUM label when contributing engines average between 0.5 and 0.75", () => {
    // Post-Commit-8a: clean engines do NOT contribute. Only engines that
    // emitted signals are averaged. A single off-chain MODERATE signal at
    // 0.6 confidence yields score=0.6 → MEDIUM band.
    const r = decide([
      eng("offchain", [
        sig({
          source: "offchain",
          code: "offchain.band.low",
          severity: "MODERATE",
          confidence: 0.6,
        }),
      ]),
      // Clean engines included to prove they are now skipped, not blended.
      eng("knownBad", []),
      eng("coordination", []),
    ]);
    expect(r.confidence).toBe("MEDIUM");
    expect(r.confidenceScore).toBe(0.6);
  });

  it("LOW label when every engine ran clean (no signals to be confident about)", () => {
    // Post-Commit-8a semantic: confidence reflects the QUALITY of signals
    // found, not the COVERAGE of engines that ran. Clean engines = empty
    // contributions = score 0 / LOW. The verdict layer still emits
    // NO_CRITICAL_SIGNAL with the disclaimer for the user-facing message.
    const r = decide([
      eng("tigerscore", []),
      eng("offchain", []),
      eng("coordination", []),
      eng("knownBad", []),
    ]);
    expect(r.verdict).toBe("NO_CRITICAL_SIGNAL");
    expect(r.confidence).toBe("LOW");
    expect(r.confidenceScore).toBe(0);
  });

  it("LOW label when no engines ran (empty input)", () => {
    const r = decide([]);
    expect(r.confidence).toBe("LOW");
  });
});
