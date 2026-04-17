// ─── Scan Run orchestrator (spec §5.3 / §8.6) ─────────────────────────────
// The orchestrator has two flavours:
//   • runScan        — synchronous, pure. Caller must provide cohort
//                      percentiles up-front (or skip them entirely).
//   • runScanWithCohort — async. Resolves the cohort via percentileCache
//                      before running, so callers can just pass a cohortKey.
//
// Both return the same ScanRunResult shape. Persistence stays out of this
// module (see ./persist.ts).

import type {
  CohortPercentiles,
  DetectorOutput,
  DetectorSignal,
  ScanRunInput,
  ScanRunResult,
} from "../types";
import { runWashTradingDetector } from "../detectors/washTrading";
import { runClusterDetector } from "../detectors/clusterMapper";
import { runConcentrationDetector } from "../detectors/concentration";
import { runPriceAsymmetryDetector } from "../detectors/priceAsymmetry";
import { runPostListingPumpDetector } from "../detectors/postListingPump";
import { computeBehaviorDrivenScore } from "../scoring/behaviorDrivenScore";
import { computeConfidence } from "../scoring/confidence";
import { computeCoverage } from "../scoring/coverage";
import { ENGINE_VERSION } from "../scoring/weights";
import { getPercentiles } from "../cohorts/percentileCache";

function injectPercentiles<T extends { percentiles?: CohortPercentiles }>(
  input: T | undefined,
  percentiles: CohortPercentiles | null,
): T | undefined {
  if (!input) return undefined;
  if (!percentiles) return input;
  return { ...input, percentiles };
}

export function runScan(input: ScanRunInput): ScanRunResult {
  const started = performance.now();

  const percentiles = input.cohortPercentiles ?? null;

  const washTrading: DetectorOutput | null = input.washTrading
    ? runWashTradingDetector(
        injectPercentiles(input.washTrading, percentiles) ?? input.washTrading,
      )
    : null;

  const cluster: DetectorOutput | null = input.cluster
    ? runClusterDetector(
        injectPercentiles(input.cluster, percentiles) ?? input.cluster,
      )
    : null;

  const concentration: DetectorOutput | null = input.concentration
    ? runConcentrationDetector(
        injectPercentiles(input.concentration, percentiles) ?? input.concentration,
      )
    : null;

  // Secondary detectors run regardless but their contribution is gated by
  // co-occurrence inside computeBehaviorDrivenScore.
  const priceAsymmetry: DetectorOutput | null = input.priceAsymmetry
    ? runPriceAsymmetryDetector(input.priceAsymmetry)
    : null;

  const postListingPump: DetectorOutput | null = input.postListingPump
    ? runPostListingPumpDetector(input.postListingPump)
    : null;

  const coreDetectors = [washTrading, cluster, concentration];
  const confidence = computeConfidence(coreDetectors);
  const coverage = computeCoverage(input);

  const behavior = computeBehaviorDrivenScore({
    detectors: {
      washTrading,
      cluster,
      concentration,
      priceAsymmetry,
      postListingPump,
    },
    walletAgeDays: input.walletAgeDays,
    confidence,
    coverage,
  });

  const signals: DetectorSignal[] = [];
  for (const d of [
    washTrading,
    cluster,
    concentration,
    priceAsymmetry,
    postListingPump,
  ]) {
    if (d) signals.push(...d.signals);
  }

  return {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    chain: input.chain,
    engineVersion: ENGINE_VERSION,
    behaviorDrivenScore: behavior.score,
    rawBehaviorScore: behavior.rawScore,
    confidence,
    coverage,
    detectorBreakdown: {
      washTrading,
      cluster,
      concentration,
      priceAsymmetry,
      postListingPump,
    },
    signals,
    signalsCount: signals.length,
    capsApplied: behavior.capsApplied,
    durationMs: Math.max(0, Math.round(performance.now() - started)),
    cohortKey: input.cohortKey ?? percentiles?.cohortKey ?? null,
    cohortPercentiles: percentiles,
    coOccurrence: behavior.coOccurrence,
  };
}

export async function runScanWithCohort(
  input: ScanRunInput,
): Promise<ScanRunResult> {
  if (input.cohortPercentiles || !input.cohortKey) {
    return runScan(input);
  }
  const percentiles = await getPercentiles(input.cohortKey);
  return runScan({ ...input, cohortPercentiles: percentiles });
}
