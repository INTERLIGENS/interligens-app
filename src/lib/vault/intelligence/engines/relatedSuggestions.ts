import { prisma } from "@/lib/prisma";
import { withTimeout } from "../timeout";
import type {
  IntelligenceEngineInput,
  IntelligenceEngineResult,
  CaseIntelligenceEventDraft,
  SuggestedEntity,
} from "../types";

/**
 * Engine 4 — Related suggestions.
 *
 * Expands the current entity with neighbours worth adding to the case:
 *   - HANDLE → token contracts linked via KolTokenLink (promotion targets)
 *   - WALLET → sibling wallets attributed to the same KOL
 *
 * The KOL engine also surfaces some of these; this engine deduplicates
 * against the case's existing entities and caps the suggestion count so
 * the Inline Reaction panel doesn't get swamped.
 *
 * No event is emitted when all suggestions would be duplicates — quiet
 * by design.
 */
const MAX_SUGGESTIONS = 6;

export async function runRelatedSuggestionsEngine(
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

  const existingKey = new Set(
    input.caseContext.existingEntities.map(
      (e) => `${e.type}:${e.value.toLowerCase().trim()}`
    )
  );

  const suggestions: SuggestedEntity[] = [];
  const events: CaseIntelligenceEventDraft[] = [];

  try {
    if (entity.type === "HANDLE") {
      const handle = entity.value
        .trim()
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "")
        .split(/[\/?#]/)[0]
        .toLowerCase();
      if (handle.length < 1) return { success: true, events: [] };

      const tokens = await prisma.kolTokenLink.findMany({
        where: { kolHandle: { equals: handle, mode: "insensitive" } },
        select: {
          contractAddress: true,
          chain: true,
          tokenSymbol: true,
          role: true,
        },
        take: 10,
      });

      for (const t of tokens) {
        const key = `CONTRACT:${t.contractAddress.toLowerCase()}`;
        if (existingKey.has(key)) continue;
        suggestions.push({
          type: "CONTRACT",
          value: t.contractAddress,
          label: t.tokenSymbol ?? `Token on ${t.chain}`,
          reason: `${t.role} link from @${handle}`,
        });
        if (suggestions.length >= MAX_SUGGESTIONS) break;
      }
    }

    if (entity.type === "WALLET") {
      const match = await prisma.kolWallet.findFirst({
        where: {
          address: { equals: entity.value.trim(), mode: "insensitive" },
        },
        select: {
          kolHandle: true,
        },
      });

      if (match?.kolHandle) {
        const normalizedSelf = entity.value.trim().toLowerCase();
        const siblings = await prisma.kolWallet.findMany({
          where: {
            kolHandle: match.kolHandle,
            status: { not: "inactive" },
          },
          select: { address: true, chain: true, label: true },
          take: 12,
        });

        for (const s of siblings) {
          const selfKey = s.address.toLowerCase();
          if (selfKey === normalizedSelf) continue;
          const key = `WALLET:${selfKey}`;
          if (existingKey.has(key)) continue;
          suggestions.push({
            type: "WALLET",
            value: s.address,
            label: s.label ?? `Sibling wallet on ${s.chain}`,
            reason: `Attributed to same actor (@${match.kolHandle})`,
          });
          if (suggestions.length >= MAX_SUGGESTIONS) break;
        }
      }
    }

    if (suggestions.length > 0) {
      events.push({
        entityId: entity.id,
        eventType: "RELATED_SUGGESTION",
        sourceModule: "Related_Suggestions",
        severity: "LOW",
        title: `${suggestions.length} related entit${
          suggestions.length === 1 ? "y" : "ies"
        } to consider`,
        summary: suggestions
          .slice(0, 3)
          .map((s) => `${s.type}: ${shortValue(s.value)}`)
          .join(" · "),
        confidence: 0.5,
        payload: { suggestions },
      });
    }
  } catch (err) {
    return {
      success: true,
      events,
      suggestions,
      error:
        err instanceof Error ? err.message : "related_suggestions_failed",
      sourceStatus: "SOURCE_UNAVAILABLE",
    };
  }

  return {
    success: true,
    events,
    suggestions,
    sourceStatus: suggestions.length > 0 ? "HIT" : "NO_INTERNAL_MATCH_YET",
  };
}

function shortValue(v: string): string {
  return v.length > 14 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;
}
