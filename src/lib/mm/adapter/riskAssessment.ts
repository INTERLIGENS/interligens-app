// ─── MmRiskAssessment orchestrator (spec §4.3, §5.3, §8.6) ────────────────
// Single surface where Registry (Produit A) and Pattern Engine (Produit B)
// are consolidated. The orchestrator does three things:
//
//   1. Registry path — for WALLET subjects, look up an active attribution
//      and derive a registryDrivenScore from the entity's default score
//      (capped by attribution method). For ENTITY subjects, load the entity
//      and use its defaultScore directly.
//
//   2. Engine path — runScan() with the supplied detector inputs. If
//      cohortKey is provided and cohortPercentiles is not, resolve via
//      percentileCache before running.
//
//   3. Consolidate — displayScore / displayReason / disclaimer / freshness,
//      then optionally persist MmScanRun and upsert MmScore so future
//      callers can hit the cache.
//
// This module is the only place in the MM module that knows about both
// sub-modules, per the architectural rule in spec §4.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  MmChain,
  MmSubjectType,
} from "../types";
import { MM_SCHEMA_VERSION } from "../types";
import { runScan, runScanWithCohort } from "../engine/scanRun/runner";
import { persistScanRun } from "../engine/scanRun/persist";
import { ENGINE_VERSION } from "../engine/scoring/weights";
import type {
  CohortPercentiles,
  ClusterInput,
  ConcentrationInput,
  ConfidenceLevel,
  CoverageLevel,
  DetectorSignal,
  FakeLiquidityInput,
  PostListingPumpInput,
  PriceAsymmetryInput,
  ScanRunInput,
  ScanRunResult,
  WashTradingInput,
} from "../engine/types";
import { bandOf, consolidateDisplayScore } from "./displayScore";
import { classifyDisplayReason, classifyDominantDriver } from "./displayReason";
import { computeFreshness } from "./freshness";
import { generateDisclaimer } from "./disclaimer";
import type {
  EngineComponent,
  MmRiskAssessment,
  RegistryComponent,
} from "./types";

const TRANSIENT_RUN_PREFIX = "transient_";
const DEFAULT_CACHE_MAX_AGE_HOURS = 6;

export interface AdapterInput {
  subjectType: MmSubjectType;
  subjectId: string;
  chain: MmChain;
  /** Optional engine detector inputs. When absent the engine contributes 0. */
  washTrading?: WashTradingInput;
  cluster?: ClusterInput;
  concentration?: ConcentrationInput;
  fakeLiquidity?: FakeLiquidityInput;
  priceAsymmetry?: PriceAsymmetryInput;
  postListingPump?: PostListingPumpInput;
  walletAgeDays?: number;
  cohortKey?: string;
  cohortPercentiles?: CohortPercentiles;
  /** Used by the persistence layer. */
  triggeredBy?:
    | "CRON"
    | "API_PUBLIC"
    | "API_ADMIN"
    | "TIGERSCORE_INTEGRATION"
    | "BATCH_SCAN";
  triggeredByRef?: string | null;
  dataSources?: Record<string, unknown>;
  /** Whether to persist the scan + upsert MmScore. Default: true. */
  persist?: boolean;
  /** Cache lookup / TTL controls. */
  useCache?: boolean;
  maxAgeHours?: number;
}

// ─── Registry path (engine-only mode) ─────────────────────────────────────
// The Registry sub-module (Produit A) is intentionally excluded from this
// release surface. The adapter therefore always returns an empty registry
// component: registryDrivenScore = 0, entity/attribution = null. Downstream,
// classifyDominantDriver collapses this to "BEHAVIORAL" or "NONE" depending
// on the engine score — no UI path references a registry entity.

async function loadRegistryComponent(
  _input: AdapterInput,
): Promise<RegistryComponent> {
  return { entity: null, attribution: null, registryDrivenScore: 0 };
}

// ─── Engine path ──────────────────────────────────────────────────────────

async function runEngine(input: AdapterInput): Promise<ScanRunResult> {
  const engineInput: ScanRunInput = {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    chain: input.chain,
    washTrading: input.washTrading,
    cluster: input.cluster,
    concentration: input.concentration,
    fakeLiquidity: input.fakeLiquidity,
    priceAsymmetry: input.priceAsymmetry,
    postListingPump: input.postListingPump,
    walletAgeDays: input.walletAgeDays,
    cohortKey: input.cohortKey,
    cohortPercentiles: input.cohortPercentiles,
    dataSources: input.dataSources,
  };
  if (engineInput.cohortKey && !engineInput.cohortPercentiles) {
    return runScanWithCohort(engineInput);
  }
  return runScan(engineInput);
}

function buildEngineComponent(result: ScanRunResult): EngineComponent {
  return {
    behaviorDrivenScore: result.behaviorDrivenScore,
    rawBehaviorScore: result.rawBehaviorScore,
    confidence: result.confidence,
    coverage: result.coverage,
    signals: result.signals,
    detectorBreakdown: {
      washTrading: result.detectorBreakdown.washTrading,
      cluster: result.detectorBreakdown.cluster,
      concentration: result.detectorBreakdown.concentration,
      fakeLiquidity: result.detectorBreakdown.fakeLiquidity,
      priceAsymmetry: result.detectorBreakdown.priceAsymmetry,
      postListingPump: result.detectorBreakdown.postListingPump,
    },
    capsApplied: result.capsApplied,
    coOccurrence: result.coOccurrence,
    cohortKey: result.cohortKey,
    cohortPercentiles: result.cohortPercentiles,
  };
}

// ─── Cache (MmScore) ──────────────────────────────────────────────────────

function cacheTtlMs(maxAgeHours: number): number {
  return Math.max(1, maxAgeHours) * 60 * 60 * 1_000;
}

async function loadCachedAssessment(
  input: AdapterInput,
): Promise<MmRiskAssessment | null> {
  const maxAge = input.maxAgeHours ?? DEFAULT_CACHE_MAX_AGE_HOURS;
  const cutoff = new Date(Date.now() - cacheTtlMs(maxAge));
  const row = await prisma.mmScore.findUnique({
    where: {
      subjectType_subjectId_chain: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        chain: input.chain,
      },
    },
  });
  if (!row) return null;
  if (row.computedAt < cutoff) return null;
  const snapshot = row.breakdown as unknown as MmRiskAssessment | null;
  if (!snapshot || typeof snapshot !== "object" || !("overall" in snapshot)) {
    return null;
  }
  // Recompute freshness against "now" — ageMinutes in storage is a snapshot.
  const refreshed = computeFreshness(row.computedAt);
  return {
    ...snapshot,
    source: "cache",
    overall: {
      ...snapshot.overall,
      freshness: refreshed,
    },
  };
}

async function persistCache(
  assessment: MmRiskAssessment,
  maxAgeHours: number,
): Promise<void> {
  const expiresAt = new Date(
    new Date(assessment.computedAt).getTime() + cacheTtlMs(maxAgeHours),
  );
  await prisma.mmScore.upsert({
    where: {
      subjectType_subjectId_chain: {
        subjectType: assessment.subjectType,
        subjectId: assessment.subjectId,
        chain: assessment.chain,
      },
    },
    update: {
      registryDrivenScore: assessment.registry.registryDrivenScore,
      behaviorDrivenScore: assessment.engine.behaviorDrivenScore,
      displayScore: assessment.overall.displayScore,
      band: assessment.overall.band,
      confidence: assessment.engine.confidence,
      coverage: assessment.engine.coverage,
      dominantDriver: assessment.overall.dominantDriver,
      displayReason: assessment.overall.displayReason,
      breakdown: assessment as unknown as Prisma.InputJsonValue,
      signalsCount: assessment.engine.signals.length,
      scanRunId: assessment.scanRunId,
      computedAt: new Date(assessment.computedAt),
      expiresAt,
      schemaVersion: MM_SCHEMA_VERSION,
    },
    create: {
      subjectType: assessment.subjectType,
      subjectId: assessment.subjectId,
      chain: assessment.chain,
      registryDrivenScore: assessment.registry.registryDrivenScore,
      behaviorDrivenScore: assessment.engine.behaviorDrivenScore,
      displayScore: assessment.overall.displayScore,
      band: assessment.overall.band,
      confidence: assessment.engine.confidence,
      coverage: assessment.engine.coverage,
      dominantDriver: assessment.overall.dominantDriver,
      displayReason: assessment.overall.displayReason,
      breakdown: assessment as unknown as Prisma.InputJsonValue,
      signalsCount: assessment.engine.signals.length,
      scanRunId: assessment.scanRunId,
      computedAt: new Date(assessment.computedAt),
      expiresAt,
      schemaVersion: MM_SCHEMA_VERSION,
    },
  });
}

// ─── Public entry point ───────────────────────────────────────────────────

export async function computeMmRiskAssessment(
  input: AdapterInput,
): Promise<MmRiskAssessment> {
  const maxAge = input.maxAgeHours ?? DEFAULT_CACHE_MAX_AGE_HOURS;

  if (input.useCache !== false) {
    const cached = await loadCachedAssessment(input);
    if (cached) return cached;
  }

  // 1. Registry
  const registry = await loadRegistryComponent(input);

  // 2. Pattern Engine
  const engineResult = await runEngine(input);
  const engine = buildEngineComponent(engineResult);

  // 3. Consolidation
  const displayScore = consolidateDisplayScore(
    registry.registryDrivenScore,
    engine.behaviorDrivenScore,
  );
  const dominantDriver = classifyDominantDriver(
    registry.registryDrivenScore,
    engine.behaviorDrivenScore,
  );
  const band = bandOf(displayScore);
  const now = new Date();
  const freshness = computeFreshness(now);
  const displayReason = classifyDisplayReason({
    registryDrivenScore: registry.registryDrivenScore,
    behaviorDrivenScore: engine.behaviorDrivenScore,
    confidence: engine.confidence,
    attribution: registry.attribution,
    entityStatus: registry.entity?.status ?? null,
    dominantDriver,
  });
  const disclaimer = generateDisclaimer({
    subjectType: input.subjectType,
    dominantDriver,
    confidence: engine.confidence,
    coverage: engine.coverage,
    freshness,
  });

  // 4. Persist (MmScanRun + MmScore cache) — optional.
  let scanRunId = `${TRANSIENT_RUN_PREFIX}${now.getTime()}`;
  if (input.persist !== false) {
    try {
      const run = await persistScanRun(engineResult, {
        triggeredBy: input.triggeredBy ?? "API_PUBLIC",
        triggeredByRef: input.triggeredByRef ?? null,
        cohortKey: engine.cohortKey ?? input.cohortKey,
        cohortPercentiles:
          (engine.cohortPercentiles as unknown as Record<string, unknown>) ??
          undefined,
        dataSources: input.dataSources,
        registryDrivenScore: registry.registryDrivenScore,
        displayScore,
        dominantDriver,
        displayReason,
      });
      scanRunId = run.id;
    } catch {
      // Persistence failure should not block the response. The transient id
      // still lets the caller reconstruct the scan deterministically.
    }
  }

  const assessment: MmRiskAssessment = {
    registry,
    engine,
    overall: {
      displayScore,
      band,
      dominantDriver,
      displayReason,
      disclaimer,
      freshness,
    },
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    chain: input.chain,
    scanRunId,
    schemaVersion: MM_SCHEMA_VERSION,
    computedAt: now.toISOString(),
    source: "compute",
  };

  if (input.persist !== false) {
    try {
      await persistCache(assessment, maxAge);
    } catch {
      // Non-fatal. Callers still get a complete assessment.
    }
  }

  return assessment;
}

// ─── Mode projection ──────────────────────────────────────────────────────

export function projectForMode(
  assessment: MmRiskAssessment,
  mode: "summary" | "expanded" | "full",
  opts?: {
    includeDetectorBreakdown?: boolean;
    includeSignals?: boolean;
  },
): Partial<MmRiskAssessment> & { overall: MmRiskAssessment["overall"] } {
  if (mode === "summary") {
    return {
      overall: assessment.overall,
      subjectType: assessment.subjectType,
      subjectId: assessment.subjectId,
      chain: assessment.chain,
      scanRunId: assessment.scanRunId,
      schemaVersion: assessment.schemaVersion,
      computedAt: assessment.computedAt,
      source: assessment.source,
    };
  }

  const includeBreakdown = opts?.includeDetectorBreakdown ?? mode === "full";
  const includeSignals = opts?.includeSignals ?? mode === "full";

  const slimEngine: EngineComponent = {
    ...assessment.engine,
    signals: includeSignals ? assessment.engine.signals : ([] as DetectorSignal[]),
    detectorBreakdown: includeBreakdown
      ? assessment.engine.detectorBreakdown
      : {
          washTrading: null,
          cluster: null,
          concentration: null,
          fakeLiquidity: null,
          priceAsymmetry: null,
          postListingPump: null,
        },
    cohortPercentiles: mode === "full" ? assessment.engine.cohortPercentiles : null,
  };

  return {
    overall: assessment.overall,
    registry: assessment.registry,
    engine: slimEngine,
    subjectType: assessment.subjectType,
    subjectId: assessment.subjectId,
    chain: assessment.chain,
    scanRunId: assessment.scanRunId,
    schemaVersion: assessment.schemaVersion,
    computedAt: assessment.computedAt,
    source: assessment.source,
  };
}

// Export ConfidenceLevel/CoverageLevel for downstream consumers that already
// pull types from this module instead of engine/types.
export type { ConfidenceLevel, CoverageLevel };
