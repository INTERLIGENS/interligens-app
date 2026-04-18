// ─── Scan Run persistence ─────────────────────────────────────────────────
// Wraps a ScanRunResult into an MmScanRun + MmDetectorOutput rows. This
// module is *not* imported by the pure runner — keep all I/O here so the
// detectors remain unit-testable without a database.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  MmDetectorType,
  MmSubjectType,
  MmTriggerType,
} from "../../types";
import { MM_SCHEMA_VERSION } from "../../types";
import type { DetectorOutput, ScanRunResult } from "../types";
import { DETECTORS_VERSION } from "../scoring/weights";

export interface PersistScanRunOptions {
  triggeredBy: MmTriggerType;
  triggeredByRef?: string | null;
  cohortKey?: string;
  cohortPercentiles?: Record<string, unknown>;
  dataSources?: Record<string, unknown>;
  rawDataRef?: string | null;
  registryDrivenScore?: number; // injected by the adapter in Phase 5
  displayScore?: number; // injected by the adapter in Phase 5
  dominantDriver?: string; // injected by the adapter in Phase 5
  displayReason?: string; // injected by the adapter in Phase 5
}

function mapDetectorType(t: DetectorOutput["detectorType"]): MmDetectorType {
  // The engine uses the same string literals as the Prisma enum.
  return t as MmDetectorType;
}

export async function persistScanRun(
  result: ScanRunResult,
  opts: PersistScanRunOptions,
) {
  const detectorOutputs: DetectorOutput[] = [];
  if (result.detectorBreakdown.washTrading) {
    detectorOutputs.push(result.detectorBreakdown.washTrading);
  }
  if (result.detectorBreakdown.cluster) {
    detectorOutputs.push(result.detectorBreakdown.cluster);
  }
  if (result.detectorBreakdown.concentration) {
    detectorOutputs.push(result.detectorBreakdown.concentration);
  }
  if (result.detectorBreakdown.fakeLiquidity) {
    detectorOutputs.push(result.detectorBreakdown.fakeLiquidity);
  }
  if (result.detectorBreakdown.priceAsymmetry) {
    detectorOutputs.push(result.detectorBreakdown.priceAsymmetry);
  }
  if (result.detectorBreakdown.postListingPump) {
    detectorOutputs.push(result.detectorBreakdown.postListingPump);
  }

  return prisma.$transaction(async (tx) => {
    const run = await tx.mmScanRun.create({
      data: {
        subjectType: result.subjectType as MmSubjectType,
        subjectId: result.subjectId,
        chain: result.chain,
        engineVersion: result.engineVersion,
        detectorsVersion: DETECTORS_VERSION as unknown as Prisma.InputJsonValue,
        schemaVersion: MM_SCHEMA_VERSION,
        cohortKey: opts.cohortKey ?? "unspecified",
        cohortPercentiles:
          (opts.cohortPercentiles ?? {}) as unknown as Prisma.InputJsonValue,
        dataSources: (opts.dataSources ?? {}) as unknown as Prisma.InputJsonValue,
        rawDataRef: opts.rawDataRef ?? null,
        registryDrivenScore: opts.registryDrivenScore ?? 0,
        behaviorDrivenScore: result.behaviorDrivenScore,
        displayScore:
          opts.displayScore ??
          Math.max(opts.registryDrivenScore ?? 0, result.behaviorDrivenScore),
        confidenceLevel: result.confidence,
        coverageLevel: result.coverage,
        dominantDriver: opts.dominantDriver ?? "BEHAVIORAL",
        displayReason: opts.displayReason ?? "BEHAVIORAL_PATTERN",
        signalsCount: result.signalsCount,
        triggeredBy: opts.triggeredBy,
        triggeredByRef: opts.triggeredByRef ?? null,
        durationMs: result.durationMs,
        errors: (result.capsApplied.length
          ? ({ capsApplied: result.capsApplied } as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull),
      },
    });

    for (const out of detectorOutputs) {
      await tx.mmDetectorOutput.create({
        data: {
          scanRunId: run.id,
          detectorType: mapDetectorType(out.detectorType),
          detectorVersion: DETECTORS_VERSION[detectorKey(out.detectorType)] ?? "unknown",
          score: out.score,
          signalsCount: out.signals.length,
          signals: out.signals as unknown as Prisma.InputJsonValue,
          evidence: out.evidence as unknown as Prisma.InputJsonValue,
          durationMs: out.durationMs,
        },
      });
    }

    return run;
  });
}

function detectorKey(t: DetectorOutput["detectorType"]): string {
  switch (t) {
    case "WASH_TRADING":
      return "washTrading";
    case "CLUSTER_COORDINATION":
      return "cluster";
    case "CONCENTRATION_ABNORMALITY":
      return "concentration";
    case "FAKE_LIQUIDITY":
      return "fakeLiquidity";
    case "PRICE_ASYMMETRY":
      return "priceAsymmetry";
    case "POST_LISTING_PUMP":
      return "postListingPump";
    default:
      return t.toLowerCase();
  }
}
