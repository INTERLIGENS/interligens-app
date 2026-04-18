import { prisma } from "@/lib/prisma";
import { withTimeout } from "../timeout";
import type {
  IntelligenceEngineInput,
  IntelligenceEngineResult,
  CaseIntelligenceEventDraft,
} from "../types";

/**
 * Engine 2 — Intel Vault cross-reference.
 *
 * Scans two curated sources for references to the current entity:
 *   - AddressLabel (for wallets / contracts) — authoritative labels
 *   - FounderIntelItem (for handles / domains / tx hashes) — published feed
 *
 * Both are admin-curated and already meant to be visible to investigators,
 * so surfacing matches in a case is always safe. On hit emits
 * INTEL_VAULT_REFERENCE_FOUND with `severity: MEDIUM`.
 */
export async function runIntelVaultEngine(
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
    if (entity.type === "WALLET" || entity.type === "CONTRACT") {
      const address = entity.value.trim();
      if (address.length < 10) return { success: true, events: [] };

      const labels = await prisma.addressLabel.findMany({
        where: {
          isActive: true,
          address: { equals: address, mode: "insensitive" },
        },
        select: {
          chain: true,
          labelType: true,
          label: true,
          confidence: true,
          sourceName: true,
          sourceUrl: true,
          evidence: true,
        },
        take: 5,
      });

      if (labels.length > 0) {
        const top = labels[0];
        events.push({
          entityId: entity.id,
          eventType: "INTEL_VAULT_REFERENCE_FOUND",
          sourceModule: "Intel_Vault",
          severity: "MEDIUM",
          title: `Address label: ${top.label}`,
          summary: `${labels.length} label(s) from ${[
            ...new Set(labels.map((l) => l.sourceName)),
          ]
            .slice(0, 3)
            .join(", ")}`,
          confidence:
            top.confidence === "high"
              ? 0.9
              : top.confidence === "medium"
                ? 0.65
                : 0.4,
          payload: { labels },
        });
      }
    }

    if (
      entity.type === "HANDLE" ||
      entity.type === "DOMAIN" ||
      entity.type === "TX_HASH" ||
      entity.type === "URL"
    ) {
      const needle = entity.value
        .trim()
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?/i, "")
        .split(/[\/?#]/)[0]
        .toLowerCase();
      if (needle.length < 3) return { success: true, events: [] };

      const hits = await prisma.founderIntelItem.findMany({
        where: {
          OR: [
            { title: { contains: needle, mode: "insensitive" } },
            { excerpt: { contains: needle, mode: "insensitive" } },
            { summary: { contains: needle, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          url: true,
          source: true,
          category: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: "desc" },
        take: 3,
      });

      if (hits.length > 0) {
        events.push({
          entityId: entity.id,
          eventType: "INTEL_VAULT_REFERENCE_FOUND",
          sourceModule: "Intel_Vault",
          severity: "MEDIUM",
          title: `${hits.length} intel feed reference${
            hits.length === 1 ? "" : "s"
          }`,
          summary: hits
            .map((h) => `${h.source}: ${truncate(h.title, 60)}`)
            .join(" · "),
          confidence: 0.55,
          payload: { hits },
        });
      }
    }
  } catch (err) {
    return {
      success: true,
      events,
      error: err instanceof Error ? err.message : "intel_vault_failed",
      sourceStatus: "SOURCE_UNAVAILABLE",
    };
  }

  if (events.length > 0) {
    return { success: true, events, sourceStatus: "HIT" };
  }

  // No matches — distinguish "source empty" from "input not in dataset".
  // Cheap count-one probe: if either AddressLabel or FounderIntelItem has
  // any row, the source is populated; otherwise flag as unavailable so the
  // UI can say "seeding pending".
  try {
    const hasAnyLabel = await prisma.addressLabel.findFirst({
      select: { id: true },
    });
    const hasAnyIntel = await prisma.founderIntelItem.findFirst({
      select: { id: true },
    });
    if (!hasAnyLabel && !hasAnyIntel) {
      return { success: true, events, sourceStatus: "SOURCE_UNAVAILABLE" };
    }
  } catch {
    return { success: true, events, sourceStatus: "SOURCE_UNAVAILABLE" };
  }

  return { success: true, events, sourceStatus: "NO_INTERNAL_MATCH_YET" };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
