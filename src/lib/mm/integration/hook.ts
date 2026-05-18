// ─── TigerScore ↔ MM hook (spec §11) ──────────────────────────────────────
// Single entry point that the TigerScore pipeline will call at some point in
// Phase 7+. Stays inert until MM_INTEGRATION_LIVE is on.
//
// Crucially, this module is NOT wired into the TigerScore pipeline yet. It
// only exists so the integration can be activated with one line once the
// calibration has been signed off.

import { prisma } from "@/lib/prisma";
import type { MmChain, MmSubjectType } from "../types";
import type { MmRiskAssessment } from "../adapter/types";
import { computeFreshness } from "../adapter/freshness";
import { isMmIntegrationEnabled, type EnvBag } from "./featureFlag";
import {
  applyMmCapToTigerScore,
  MM_CAP_REASONS,
  type MmCapResult,
} from "./tigerScoreAdapter";
import { checkMmOverride } from "./override";

export interface TigerScoreWithMm {
  score: number;
  mmApplied: boolean;
  /** "flag_off" | "no_mm_data" | "mm_cap_applied" | "mm_info_only" */
  reason:
    | "flag_off"
    | "no_mm_data"
    | "mm_cap_applied"
    | "mm_info_only"
    | "mm_error";
  capReason: string | null;
  evidence: MmCapResult["evidence"];
  disclaimer: string | null;
  /** Original score before any MM adjustment — useful for audit logs. */
  originalScore: number;
}

export interface HookOptions {
  subjectType?: MmSubjectType;
  env?: EnvBag;
  /**
   * Override "now" to compute freshness deterministically in tests.
   */
  nowMs?: number;
  /**
   * Evidence URL base.
   */
  evidenceBaseUrl?: string;
  /**
   * Optional logger. Defaults to console.info. Set to a no-op in tests that
   * should not emit output.
   */
  logger?: (line: Record<string, unknown>) => void;
}

function defaultLogger(line: Record<string, unknown>): void {
  console.info(JSON.stringify({ ts: new Date().toISOString(), ...line }));
}

export async function hookMmIntoTigerScore(
  tokenMint: string,
  chain: MmChain,
  currentTigerScore: number,
  opts: HookOptions = {},
): Promise<TigerScoreWithMm> {
  const log = opts.logger ?? defaultLogger;
  const env = opts.env ?? process.env;
  const originalScore = clamp(currentTigerScore);

  if (!isMmIntegrationEnabled(env)) {
    return frozenResponse(originalScore, "flag_off", MM_CAP_REASONS.FLAG_OFF);
  }

  const subjectType: MmSubjectType = opts.subjectType ?? "TOKEN";

  let row;
  try {
    row = await prisma.mmScore.findUnique({
      where: {
        subjectType_subjectId_chain: {
          subjectType,
          subjectId: tokenMint,
          chain,
        },
      },
    });
  } catch (err) {
    log({
      source: "mm_hook",
      action: "cache_lookup_failed",
      tokenMint,
      chain,
      error: err instanceof Error ? err.message : String(err),
    });
    return frozenResponse(originalScore, "mm_error", "cache_lookup_failed");
  }

  if (!row || !row.breakdown) {
    return frozenResponse(originalScore, "no_mm_data", MM_CAP_REASONS.NO_DATA);
  }

  let assessment: MmRiskAssessment;
  try {
    assessment = reconstructAssessment(row, opts.nowMs);
  } catch (err) {
    log({
      source: "mm_hook",
      action: "cache_parse_failed",
      tokenMint,
      chain,
      error: err instanceof Error ? err.message : String(err),
    });
    return frozenResponse(originalScore, "mm_error", "cache_parse_failed");
  }

  const overridden = checkMmOverride(tokenMint, chain, env);
  const cap = applyMmCapToTigerScore(originalScore, assessment, {
    overridden,
    env,
    evidenceBaseUrl: opts.evidenceBaseUrl,
  });

  const reason: TigerScoreWithMm["reason"] = cap.capApplied
    ? "mm_cap_applied"
    : "mm_info_only";

  log({
    source: "mm_hook",
    action: "apply_cap",
    tokenMint,
    chain,
    originalScore,
    adjustedScore: cap.adjustedScore,
    capApplied: cap.capApplied,
    capReason: cap.capReason,
    overridden,
    mmDisplayScore: assessment.overall.displayScore,
    mmConfidence: assessment.engine.confidence,
    mmCoverage: assessment.engine.coverage,
    mmFreshness: assessment.overall.freshness.staleness,
  });

  return {
    score: cap.adjustedScore,
    mmApplied: cap.capApplied,
    reason,
    capReason: cap.capReason,
    evidence: cap.evidence,
    disclaimer: cap.disclaimer,
    originalScore,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function frozenResponse(
  score: number,
  reason: TigerScoreWithMm["reason"],
  capReason: string,
): TigerScoreWithMm {
  return {
    score,
    mmApplied: false,
    reason,
    capReason,
    evidence: null,
    disclaimer: null,
    originalScore: score,
  };
}

interface CacheRow {
  computedAt: Date;
  breakdown: unknown;
}

function reconstructAssessment(row: CacheRow, nowMs?: number): MmRiskAssessment {
  const snapshot = row.breakdown as Partial<MmRiskAssessment> | null;
  if (!snapshot || typeof snapshot !== "object" || !snapshot.overall) {
    throw new Error("MmScore.breakdown is not a valid MmRiskAssessment snapshot");
  }
  const base = snapshot as MmRiskAssessment;
  const computedAt = row.computedAt instanceof Date ? row.computedAt : new Date(row.computedAt);
  return {
    ...base,
    source: "cache",
    overall: {
      ...base.overall,
      freshness: computeFreshness(computedAt, nowMs),
    },
  };
}

function clamp(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x);
}
