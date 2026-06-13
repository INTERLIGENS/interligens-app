/**
 * PRE-BUY GUARD — deterministic fusion layer.
 *
 * Takes a REFLEX analysis (the existing 6-source convergence engine, used
 * as-is) and overlays the two layers REFLEX is blind to — on-chain shill
 * correlation and referring-KOL risk — into a single pre-buy verdict.
 *
 * This function is PURE and side-effect free (aside from the forbidden-words
 * lint, which throws on a banned phrase). All IO happens in index.ts; this is
 * the unit under test.
 *
 * Fusion rules (first applicable wins, deterministic):
 *
 *   1. REFLEX returned STOP                         → STOP (stays)
 *   2. base < STOP, surviving HIGH_INTEREST shill
 *      candidate AND referring KOL flagged          → STOP (convergence escalation)
 *   3. any single new signal fired (surviving
 *      candidate OR flagged KOL OR published
 *      casefile OR documented front-runner)         → at least CAUTION
 *   4. otherwise                                     → REFLEX mapped verdict
 *        STOP→STOP · WAIT|VERIFY→CAUTION · NO_CRITICAL_SIGNAL→CLEAR
 *
 * Absence of shill data never clears risk: it produces no positive signal and
 * appends a partial-coverage caveat to the reasons. The shill layer can only
 * escalate, never reassure.
 */
import { assertClean } from "@/lib/reflex/forbidden-words";
import type {
  ReflexAnalysisResult,
  ReflexConfidence,
  ReflexVerdict,
} from "@/lib/reflex/types";
import type { ShillCorrelationSummary } from "./shill";
import type { ReferralRiskSummary, TokenKolInvolvement } from "./kol";

export type PreBuyVerdictLabel = "STOP" | "CAUTION" | "CLEAR";

export interface PreBuyEvidenceLink {
  type: "reflex" | "casefile" | "shill_candidate" | "kol_profile";
  ref: string;
  url?: string;
}

export interface PreBuyLayers {
  reflex: {
    verdict: ReflexVerdict;
    confidence: ReflexConfidence;
    confidenceScore: number;
    reasonsEn: string[];
    analysisId: string;
  };
  shillCorrelation: ShillCorrelationSummary;
  referral: ReferralRiskSummary;
  tokenKol: TokenKolInvolvement;
  casefilePresent: boolean;
}

export interface PreBuyVerdict {
  verdict: PreBuyVerdictLabel;
  risk_score: number;
  confidence: ReflexConfidence;
  reasons: string[];
  evidence_links: PreBuyEvidenceLink[];
  layers: PreBuyLayers;
  mode: "SHADOW";
  computedAt: string;
}

export interface FusionInput {
  reflex: ReflexAnalysisResult;
  shill: ShillCorrelationSummary;
  referral: ReferralRiskSummary;
  tokenKol: TokenKolInvolvement;
  casefilePresent: boolean;
  /** Extra casefile evidence links (preset / TokenCaseFile) beyond REFLEX's
   *  KolTokenLink-derived casefileMatch signals. */
  casefileLinks?: PreBuyEvidenceLink[];
  /** Injected for deterministic tests; defaults to a fixed-shape ISO string. */
  computedAt?: string;
}

const VERDICT_RANK: Record<PreBuyVerdictLabel, number> = {
  CLEAR: 1,
  CAUTION: 2,
  STOP: 3,
};

const CONF_RANK: Record<ReflexConfidence, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

function maxVerdict(a: PreBuyVerdictLabel, b: PreBuyVerdictLabel): PreBuyVerdictLabel {
  return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b;
}

function maxConf(a: ReflexConfidence, b: ReflexConfidence): ReflexConfidence {
  return CONF_RANK[a] >= CONF_RANK[b] ? a : b;
}

function mapReflexVerdict(v: ReflexVerdict): PreBuyVerdictLabel {
  if (v === "STOP") return "STOP";
  if (v === "WAIT" || v === "VERIFY") return "CAUTION";
  return "CLEAR"; // NO_CRITICAL_SIGNAL
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function fusePreBuyVerdict(input: FusionInput): PreBuyVerdict {
  const { reflex, shill, referral, tokenKol, casefilePresent } = input;

  // ── New-signal booleans (the two layers REFLEX cannot see) ──────────────
  const survivingShill = shill.available && shill.survivingCount > 0;
  const highInterestShill = survivingShill && shill.hasHighInterest;
  const kolFlagged = referral.found && referral.flagged;
  const frontRunner = tokenKol.available && tokenKol.hasFrontRunner;

  const newSignals = [survivingShill, kolFlagged, casefilePresent, frontRunner];
  const newSignalCount = newSignals.filter(Boolean).length;

  // ── Verdict ─────────────────────────────────────────────────────────────
  const base = mapReflexVerdict(reflex.verdict);
  let verdict: PreBuyVerdictLabel;
  if (reflex.verdict === "STOP") {
    verdict = "STOP";
  } else if (highInterestShill && kolFlagged) {
    verdict = "STOP"; // convergence escalation
  } else if (newSignalCount > 0) {
    verdict = maxVerdict(base, "CAUTION");
  } else {
    verdict = base;
  }

  // ── Confidence ──────────────────────────────────────────────────────────
  const signalConfidence: ReflexConfidence =
    newSignalCount >= 2 ? "HIGH" : newSignalCount === 1 ? "MEDIUM" : "LOW";
  const confidence = maxConf(reflex.confidence, signalConfidence);

  // ── Risk score (0–100), then aligned to the verdict band ────────────────
  let score = Math.round(clamp(reflex.confidenceScore, 0, 1) * 60);
  if (casefilePresent) score += 15;
  if (survivingShill) score += highInterestShill ? 30 : 15;
  if (kolFlagged) score += 20;
  if (frontRunner) score += 15;
  score = clamp(score, 0, 100);
  if (verdict === "STOP") score = Math.max(score, 75);
  else if (verdict === "CAUTION") score = clamp(score, 40, 74);
  else score = Math.min(score, 39); // CLEAR

  // ── Reasons (REFLEX reasons first, then overlay; lint-checked) ──────────
  const reasons: string[] = [];
  const push = (r: string) => {
    if (r && !reasons.includes(r)) reasons.push(r);
  };

  for (const r of reflex.verdictReasonEn) push(r);

  if (highInterestShill) {
    push(
      "On-chain: wallets repeatedly bought within the front-run window before this token's promotions (high-interest correlation candidate).",
    );
  } else if (survivingShill) {
    push(
      "On-chain: correlated buyer wallet(s) were observed around promotions of this token.",
    );
  }
  if (kolFlagged) {
    push(
      `Referring account @${referral.handle} carries a documented risk flag (riskFlag=${referral.riskFlag}).`,
    );
  }
  if (frontRunner) {
    push(
      "On-chain: a documented promoter sold before their own promotion of this token (front-running).",
    );
  }
  if (casefilePresent) {
    push("A published case file references this address.");
  }
  // Partial-coverage caveat — absence of shill data is never reassurance.
  if (!shill.available) {
    push(
      "Shill-correlation coverage is partial for this token; absence of correlated wallets is not evidence of low risk.",
    );
  }

  // Hard guarantee: no banned wording reaches a verdict. Throws on a leak.
  assertClean(reasons, "prebuy.reasons");

  // ── Evidence links (deduped by type:ref) ─────────────────────────────────
  const evidence_links: PreBuyEvidenceLink[] = [];
  const seenLinks = new Set<string>();
  const addLink = (link: PreBuyEvidenceLink) => {
    const key = `${link.type}:${link.ref}`;
    if (seenLinks.has(key)) return;
    seenLinks.add(key);
    evidence_links.push(link);
  };

  addLink({ type: "reflex", ref: reflex.id });
  if (casefilePresent) {
    // REFLEX casefileMatch signals (KolTokenLink / KolCase-derived)...
    for (const s of reflex.signals ?? []) {
      if (s.source === "casefileMatch") {
        const ref =
          (s.payload && typeof s.payload.ref === "string" && s.payload.ref) ||
          s.code;
        addLink({ type: "casefile", ref });
      }
    }
    // ...plus preset / TokenCaseFile sources passed by the orchestrator.
    for (const link of input.casefileLinks ?? []) addLink(link);
  }
  if (survivingShill) {
    for (const handle of shill.kolHandles) {
      addLink({
        type: "shill_candidate",
        ref: handle,
        url: `/admin/shill-correlation?kol=${encodeURIComponent(handle)}`,
      });
    }
  }
  if (referral.found && referral.handle) {
    addLink({
      type: "kol_profile",
      ref: referral.handle,
      url: `/admin/kol?handle=${encodeURIComponent(referral.handle)}`,
    });
  }

  return {
    verdict,
    risk_score: score,
    confidence,
    reasons,
    evidence_links,
    layers: {
      reflex: {
        verdict: reflex.verdict,
        confidence: reflex.confidence,
        confidenceScore: reflex.confidenceScore,
        reasonsEn: reflex.verdictReasonEn,
        analysisId: reflex.id,
      },
      shillCorrelation: shill,
      referral,
      tokenKol,
      casefilePresent,
    },
    mode: "SHADOW",
    computedAt: input.computedAt ?? new Date().toISOString(),
  };
}
