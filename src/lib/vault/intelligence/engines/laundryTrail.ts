import { prisma } from "@/lib/prisma";
import { withTimeout } from "../timeout";
import type {
  IntelligenceEngineInput,
  IntelligenceEngineResult,
  CaseIntelligenceEventDraft,
} from "../types";

/**
 * Tier-2 engine — Laundry Trail.
 *
 * Looks up LaundryTrail rows by walletAddress (chain-agnostic) and emits a
 * LAUNDRY_TRAIL_FOUND event per match. Severity is derived from the stored
 * `laundryRisk` column. Signals (sub-rows of LaundrySignal) get included in
 * the payload so downstream UI can expand them.
 *
 * WALLET entities only — handles have no on-chain pattern to query here.
 */
export async function runLaundryTrailEngine(
  input: IntelligenceEngineInput
): Promise<IntelligenceEngineResult> {
  const result = await withTimeout(runInner(input), input.timeoutMs);
  if (!result) {
    return {
      success: true,
      events: [],
      partialResult: true,
      error: "timeout",
    };
  }
  return result;
}

async function runInner(
  input: IntelligenceEngineInput
): Promise<IntelligenceEngineResult> {
  const entity = input.entity;
  if (!entity || entity.type !== "WALLET") {
    return { success: true, events: [] };
  }

  const address = entity.value.trim();
  if (address.length < 10) return { success: true, events: [] };

  const events: CaseIntelligenceEventDraft[] = [];

  try {
    const trails = await prisma.laundryTrail.findMany({
      where: {
        walletAddress: { equals: address, mode: "insensitive" },
      },
      select: {
        id: true,
        chain: true,
        trailType: true,
        laundryRisk: true,
        recoveryDifficulty: true,
        trailBreakHop: true,
        fundsUnresolved: true,
        narrativeText: true,
        kolHandle: true,
        signals: {
          select: {
            family: true,
            severity: true,
            confirmed: true,
            detail: true,
          },
          take: 6,
        },
      },
      take: 3,
    });

    for (const t of trails) {
      const severity =
        t.laundryRisk === "CRITICAL"
          ? "CRITICAL"
          : t.laundryRisk === "MODERATE"
            ? "MEDIUM"
            : "LOW";
      const lostText =
        t.fundsUnresolved && t.fundsUnresolved > 0
          ? ` · $${fmtUsd(t.fundsUnresolved)} unresolved`
          : "";
      const hopText = t.trailBreakHop ? ` · trail breaks at hop ${t.trailBreakHop}` : "";
      events.push({
        entityId: entity.id,
        eventType: "LAUNDRY_TRAIL_FOUND",
        sourceModule: "Laundry_Trail",
        severity,
        title: `Laundry pattern: ${t.trailType}`,
        summary: `${t.chain} · risk ${t.laundryRisk} · recovery ${t.recoveryDifficulty}${hopText}${lostText}`,
        confidence:
          t.laundryRisk === "CRITICAL"
            ? 0.9
            : t.laundryRisk === "MODERATE"
              ? 0.65
              : 0.4,
        payload: {
          trailId: t.id,
          chain: t.chain,
          trailType: t.trailType,
          laundryRisk: t.laundryRisk,
          recoveryDifficulty: t.recoveryDifficulty,
          trailBreakHop: t.trailBreakHop,
          fundsUnresolved: t.fundsUnresolved,
          kolHandle: t.kolHandle,
          narrative: t.narrativeText,
          signals: t.signals,
        },
      });
    }
  } catch (err) {
    return {
      success: true,
      events,
      error: err instanceof Error ? err.message : "laundry_trail_failed",
      sourceStatus: "SOURCE_UNAVAILABLE",
    };
  }

  if (events.length > 0) {
    return { success: true, events, sourceStatus: "HIT" };
  }
  // LaundryTrail table exists but may be sparse — detect availability cheaply.
  try {
    const any = await prisma.laundryTrail.findFirst({ select: { id: true } });
    return {
      success: true,
      events,
      sourceStatus: any ? "NO_INTERNAL_MATCH_YET" : "SOURCE_UNAVAILABLE",
    };
  } catch {
    return { success: true, events, sourceStatus: "SOURCE_UNAVAILABLE" };
  }
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
