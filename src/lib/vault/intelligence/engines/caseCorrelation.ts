import { prisma } from "@/lib/prisma";
import { withTimeout } from "../timeout";
import type {
  IntelligenceEngineInput,
  IntelligenceEngineResult,
  CaseIntelligenceEventDraft,
} from "../types";

/**
 * Tier-2 engine — Case Correlation.
 *
 * Scans the investigator's OWN workspace for the same wallet / handle / TX
 * appearing in another case. High-signal for connecting separate threads:
 * "this address is also in Case B, you tagged it last month".
 *
 * Privacy: never queries other workspaces. Scope is strictly the caller's
 * own `workspaceId`.
 */
export async function runCaseCorrelationEngine(
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
  if (!entity) return { success: true, events: [] };

  // Normalise the value for case-insensitive comparison across cases.
  const raw = entity.value.trim();
  if (raw.length < 3) return { success: true, events: [] };

  const events: CaseIntelligenceEventDraft[] = [];

  try {
    const matches = await prisma.vaultCaseEntity.findMany({
      where: {
        type: entity.type,
        value: { equals: raw, mode: "insensitive" },
        caseId: { not: input.caseId },
        case: { workspaceId: input.workspaceId },
      },
      select: {
        id: true,
        caseId: true,
        value: true,
        type: true,
        label: true,
        createdAt: true,
      },
      take: 8,
    });

    if (matches.length === 0) return { success: true, events: [] };

    // Group by case to keep the event compact.
    const byCase = new Map<string, typeof matches>();
    for (const m of matches) {
      const arr = byCase.get(m.caseId) ?? [];
      arr.push(m);
      byCase.set(m.caseId, arr);
    }
    const caseIds = Array.from(byCase.keys());
    const caseCount = caseIds.length;

    const severity = caseCount >= 3 ? "HIGH" : caseCount >= 2 ? "MEDIUM" : "LOW";

    events.push({
      entityId: entity.id,
      eventType: "CASE_CORRELATION_FOUND",
      sourceModule: "Case_Correlation",
      severity,
      title: `Also in ${caseCount} other case${caseCount === 1 ? "" : "s"}`,
      summary: `This ${entity.type.toLowerCase()} already appears in ${caseCount} of your other investigation${
        caseCount === 1 ? "" : "s"
      } — pattern worth exploring`,
      confidence: caseCount >= 3 ? 0.85 : caseCount >= 2 ? 0.7 : 0.55,
      payload: {
        sharedEntityType: entity.type,
        sharedEntityValue: entity.value,
        otherCaseCount: caseCount,
        // Surface case IDs so the UI can offer deep-links; titles are
        // encrypted so we can't decrypt server-side.
        otherCaseIds: caseIds.slice(0, 5),
        entityOccurrences: matches.slice(0, 5).map((m) => ({
          caseId: m.caseId,
          entityId: m.id,
          firstSeen: m.createdAt,
        })),
      },
    });
  } catch (err) {
    return {
      success: true,
      events,
      error:
        err instanceof Error ? err.message : "case_correlation_failed",
      sourceStatus: "SOURCE_UNAVAILABLE",
    };
  }

  return {
    success: true,
    events,
    sourceStatus: events.length > 0 ? "HIT" : "NO_INTERNAL_MATCH_YET",
  };
}
