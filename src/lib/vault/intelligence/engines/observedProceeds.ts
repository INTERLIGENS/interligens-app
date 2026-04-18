import { prisma } from "@/lib/prisma";
import { withTimeout } from "../timeout";
import type {
  IntelligenceEngineInput,
  IntelligenceEngineResult,
  CaseIntelligenceEventDraft,
} from "../types";

/**
 * Engine 3 — Observed Proceeds.
 *
 * Surfaces documented scam proceeds for a wallet or handle. v1 leans on the
 * curated KOL registry:
 *   - For WALLET entities → look up KolWallet → KolProfile, emit the actor's
 *     totalScammed / totalDocumented.
 *   - For HANDLE entities → look up KolProfile directly.
 *
 * The numbers are intentionally marked MEDIUM severity — they come from our
 * own curation, not independent chain analysis. A proper proceeds ledger
 * lands later; this engine is the safe first cut.
 */
export async function runObservedProceedsEngine(
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

  const events: CaseIntelligenceEventDraft[] = [];

  try {
    let profile: {
      handle: string;
      totalScammed: number | null;
      totalDocumented: number | null;
      rugCount: number | null;
      proceedsCoverage: string;
      cashoutCache: unknown;
    } | null = null;

    if (entity.type === "WALLET") {
      const match = await prisma.kolWallet.findFirst({
        where: { address: { equals: entity.value.trim(), mode: "insensitive" } },
        select: {
          kol: {
            select: {
              handle: true,
              totalScammed: true,
              totalDocumented: true,
              rugCount: true,
              proceedsCoverage: true,
              cashoutCache: true,
            },
          },
        },
      });
      profile = match?.kol ?? null;
    } else if (entity.type === "HANDLE") {
      const cleaned = entity.value
        .trim()
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "")
        .split(/[\/?#]/)[0]
        .toLowerCase();
      if (cleaned.length < 1) return { success: true, events: [] };

      profile = await prisma.kolProfile.findUnique({
        where: { handle: cleaned },
        select: {
          handle: true,
          totalScammed: true,
          totalDocumented: true,
          rugCount: true,
          proceedsCoverage: true,
          cashoutCache: true,
        },
      });
    }

    if (!profile) return { success: true, events: [] };

    const scammed = profile.totalScammed ?? 0;
    const documented = profile.totalDocumented ?? 0;
    const amount = Math.max(scammed, documented);
    if (amount < 1_000 && (profile.rugCount ?? 0) === 0) {
      // Nothing worth a feed card — stay quiet.
      return { success: true, events: [] };
    }

    const severity =
      amount >= 1_000_000 ? "HIGH" : amount >= 100_000 ? "MEDIUM" : "LOW";

    events.push({
      entityId: entity.id,
      eventType: "OBSERVED_PROCEEDS_FOUND",
      sourceModule: "Observed_Proceeds",
      severity,
      title: amount > 0
        ? `Documented proceeds ~$${fmtUsd(amount)}`
        : `Activity linked to @${profile.handle}`,
      summary: buildProceedsSummary(profile),
      confidence:
        profile.proceedsCoverage === "full"
          ? 0.85
          : profile.proceedsCoverage === "partial"
            ? 0.65
            : 0.4,
      payload: {
        handle: profile.handle,
        totalScammed: profile.totalScammed,
        totalDocumented: profile.totalDocumented,
        rugCount: profile.rugCount,
        proceedsCoverage: profile.proceedsCoverage,
      },
    });
  } catch (err) {
    return {
      success: true,
      events,
      error:
        err instanceof Error ? err.message : "observed_proceeds_failed",
      sourceStatus: "SOURCE_UNAVAILABLE",
    };
  }

  return {
    success: true,
    events,
    sourceStatus: events.length > 0 ? "HIT" : "NO_INTERNAL_MATCH_YET",
  };
}

function buildProceedsSummary(p: {
  handle: string;
  totalScammed: number | null;
  totalDocumented: number | null;
  rugCount: number | null;
  proceedsCoverage: string;
}): string {
  const parts: string[] = [`@${p.handle}`];
  if (p.rugCount && p.rugCount > 0) parts.push(`${p.rugCount} rug(s)`);
  if (p.totalScammed && p.totalScammed > 0)
    parts.push(`scammed ~$${fmtUsd(p.totalScammed)}`);
  if (p.totalDocumented && p.totalDocumented > 0)
    parts.push(`documented ~$${fmtUsd(p.totalDocumented)}`);
  parts.push(`coverage: ${p.proceedsCoverage}`);
  return parts.join(" · ");
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
