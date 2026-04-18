import { prisma } from "@/lib/prisma";
import { withTimeout } from "../timeout";
import type {
  IntelligenceEngineInput,
  IntelligenceEngineResult,
  CaseIntelligenceEventDraft,
  SuggestedEntity,
} from "../types";

/**
 * Tier-2 engine — Wallet Journey.
 *
 * Probes WalletFundingEdge for edges touching the target wallet. Summarises:
 *   - How many wallets funded this one (upstream)
 *   - How many wallets this one funded (downstream)
 *   - Highest-confidence counterparties (candidate leads)
 *
 * Emits a single WALLET_JOURNEY_FOUND event when any edges are present and
 * proposes up to 5 counterparty wallets as suggestions.
 */
export async function runWalletJourneyEngine(
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

  const existingKey = new Set(
    input.caseContext.existingEntities.map(
      (e) => `${e.type}:${e.value.toLowerCase().trim()}`
    )
  );

  const events: CaseIntelligenceEventDraft[] = [];
  const suggestions: SuggestedEntity[] = [];

  try {
    const [fundedBy, funded] = await Promise.all([
      prisma.walletFundingEdge.findMany({
        where: { toAddress: { equals: address, mode: "insensitive" } },
        select: {
          chain: true,
          fromAddress: true,
          confidence: true,
          isProjectLinked: true,
          source: true,
          observedAt: true,
        },
        orderBy: { confidence: "desc" },
        take: 5,
      }),
      prisma.walletFundingEdge.findMany({
        where: { fromAddress: { equals: address, mode: "insensitive" } },
        select: {
          chain: true,
          toAddress: true,
          confidence: true,
          isProjectLinked: true,
          source: true,
          observedAt: true,
        },
        orderBy: { confidence: "desc" },
        take: 5,
      }),
    ]);

    const total = fundedBy.length + funded.length;
    if (total === 0) return { success: true, events: [] };

    const chains = new Set<string>();
    for (const r of fundedBy) chains.add(r.chain);
    for (const r of funded) chains.add(r.chain);

    const projectLinked =
      fundedBy.some((r) => r.isProjectLinked) ||
      funded.some((r) => r.isProjectLinked);
    const highConf =
      fundedBy.filter((r) => r.confidence >= 75).length +
      funded.filter((r) => r.confidence >= 75).length;

    const severity = projectLinked
      ? "HIGH"
      : highConf > 0
        ? "MEDIUM"
        : "LOW";

    events.push({
      entityId: entity.id,
      eventType: "WALLET_JOURNEY_FOUND",
      sourceModule: "Wallet_Journey",
      severity,
      title: `Funding graph: ${fundedBy.length} in / ${funded.length} out`,
      summary: `${total} edge${
        total === 1 ? "" : "s"
      } across ${[...chains].join(", ")}${
        projectLinked ? " · project-linked" : ""
      }${highConf > 0 ? ` · ${highConf} high-conf` : ""}`,
      confidence: projectLinked ? 0.75 : highConf > 0 ? 0.6 : 0.4,
      payload: {
        fundedByCount: fundedBy.length,
        fundedCount: funded.length,
        chains: [...chains],
        projectLinked,
        highConfCount: highConf,
        upstreamSamples: fundedBy.slice(0, 3),
        downstreamSamples: funded.slice(0, 3),
      },
    });

    // Suggest the top counterparties as leads to add.
    for (const r of [...fundedBy, ...funded]) {
      const other =
        "fromAddress" in r && r.fromAddress
          ? r.fromAddress
          : "toAddress" in r
            ? r.toAddress
            : null;
      if (!other) continue;
      const key = `WALLET:${other.toLowerCase()}`;
      if (existingKey.has(key)) continue;
      if (suggestions.length >= 5) break;
      suggestions.push({
        type: "WALLET",
        value: other,
        label: `${r.chain} counterparty (conf ${r.confidence})`,
        reason:
          "fromAddress" in r && r.fromAddress
            ? `Funded the current wallet`
            : `Funded by the current wallet`,
      });
    }
  } catch (err) {
    return {
      success: true,
      events,
      suggestions,
      error: err instanceof Error ? err.message : "wallet_journey_failed",
      sourceStatus: "SOURCE_UNAVAILABLE",
    };
  }

  if (events.length > 0) {
    return { success: true, events, suggestions, sourceStatus: "HIT" };
  }
  try {
    const any = await prisma.walletFundingEdge.findFirst({
      select: { id: true },
    });
    return {
      success: true,
      events,
      suggestions,
      sourceStatus: any ? "NO_INTERNAL_MATCH_YET" : "SOURCE_UNAVAILABLE",
    };
  } catch {
    return {
      success: true,
      events,
      suggestions,
      sourceStatus: "SOURCE_UNAVAILABLE",
    };
  }
}
