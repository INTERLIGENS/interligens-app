import { prisma } from "@/lib/prisma";
import { withTimeout } from "../timeout";
import type {
  IntelligenceEngineInput,
  IntelligenceEngineResult,
  CaseIntelligenceEventDraft,
  SuggestedEntity,
} from "../types";

/**
 * Engine 1 — KOL Registry cross-reference.
 *
 * Matches the current entity against KolProfile (by handle / displayName)
 * and KolWallet (by address). On hit, emits a KOL_MATCH_FOUND event and
 * suggests any other wallets attributed to the same actor.
 *
 * Fails soft — no rows, no tables, network hiccup, all surface as
 * `success: true, events: []`. The orchestrator keeps going.
 */
export async function runKolRegistryEngine(
  input: IntelligenceEngineInput
): Promise<IntelligenceEngineResult> {
  const entity = input.entity;
  if (!entity) {
    return { success: true, events: [] };
  }

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
  const entity = input.entity!;
  const events: CaseIntelligenceEventDraft[] = [];
  const suggestions: SuggestedEntity[] = [];

  try {
    if (entity.type === "HANDLE") {
      // Handles come in many shapes ("@bob", "bob", "https://x.com/bob") —
      // normalise to the bare lower-case value that KolProfile stores.
      const cleaned = entity.value
        .trim()
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "")
        .split(/[\/?#]/)[0]
        .toLowerCase();
      if (cleaned.length < 1) return { success: true, events: [] };

      // 1. Direct handle match (case-insensitive).
      // 2. Alias match via KolAlias — catches "SamOLeary" → @sxyz500,
      //    "Regrets10x" → @lynk0x, and "dioneprotocol.eth" → dione-protocol.
      // 3. Display-name fallback for investigators who paste a real name.
      let profile = await prisma.kolProfile.findFirst({
        where: {
          OR: [
            { handle: { equals: cleaned, mode: "insensitive" } },
            {
              aliases: {
                some: { alias: { equals: cleaned, mode: "insensitive" } },
              },
            },
            { displayName: { equals: cleaned, mode: "insensitive" } },
          ],
        },
        select: {
          handle: true,
          displayName: true,
          label: true,
          riskFlag: true,
          tier: true,
          rugCount: true,
          totalScammed: true,
          publishStatus: true,
          aliases: {
            select: { alias: true, type: true },
            take: 5,
          },
          kolWallets: {
            select: { address: true, chain: true, label: true, status: true },
            take: 10,
          },
        },
      });

      // Loose fallback: strip common connector characters ("sam-o-leary",
      // "sam_oleary") and try contains-match. Only used when exact + alias
      // missed, to avoid broad collisions.
      if (!profile && cleaned.length >= 4) {
        const loose = cleaned.replace(/[-_.]/g, "");
        if (loose !== cleaned) {
          profile = await prisma.kolProfile.findFirst({
            where: {
              OR: [
                { handle: { equals: loose, mode: "insensitive" } },
                {
                  aliases: {
                    some: { alias: { equals: loose, mode: "insensitive" } },
                  },
                },
              ],
            },
            select: {
              handle: true,
              displayName: true,
              label: true,
              riskFlag: true,
              tier: true,
              rugCount: true,
              totalScammed: true,
              publishStatus: true,
              aliases: {
                select: { alias: true, type: true },
                take: 5,
              },
              kolWallets: {
                select: { address: true, chain: true, label: true, status: true },
                take: 10,
              },
            },
          });
        }
      }

      if (profile) {
        const rugged = (profile.rugCount ?? 0) > 0;
        const severity =
          profile.riskFlag === "confirmed"
            ? "HIGH"
            : rugged
              ? "MEDIUM"
              : "LOW";
        events.push({
          entityId: entity.id,
          eventType: "KOL_MATCH_FOUND",
          sourceModule: "KOL_Registry",
          severity,
          title: `KOL registry match: @${profile.handle}`,
          summary: buildKolSummary(profile),
          confidence:
            profile.riskFlag === "confirmed"
              ? 0.95
              : rugged
                ? 0.75
                : 0.5,
          payload: {
            handle: profile.handle,
            displayName: profile.displayName,
            riskFlag: profile.riskFlag,
            tier: profile.tier,
            rugCount: profile.rugCount,
            totalScammed: profile.totalScammed,
            publishStatus: profile.publishStatus,
            walletCount: profile.kolWallets.length,
            aliases: profile.aliases,
          },
        });

        for (const w of profile.kolWallets) {
          if (w.status === "inactive") continue;
          suggestions.push({
            type: "WALLET",
            value: w.address,
            label: w.label ?? `Wallet attributed to @${profile.handle}`,
            reason: `Linked to KOL @${profile.handle}`,
          });
        }
      }
    }

    if (entity.type === "WALLET") {
      const address = entity.value.trim();
      if (address.length < 10) return { success: true, events: [] };

      const match = await prisma.kolWallet.findFirst({
        where: { address: { equals: address, mode: "insensitive" } },
        select: {
          address: true,
          kolHandle: true,
          label: true,
          chain: true,
          attributionStatus: true,
          confidence: true,
          kol: {
            select: {
              handle: true,
              displayName: true,
              riskFlag: true,
              rugCount: true,
              totalScammed: true,
            },
          },
        },
      });

      if (match?.kol) {
        const rugged = (match.kol.rugCount ?? 0) > 0;
        const severity =
          match.kol.riskFlag === "confirmed"
            ? "HIGH"
            : rugged
              ? "MEDIUM"
              : "LOW";
        events.push({
          entityId: entity.id,
          eventType: "KOL_MATCH_FOUND",
          sourceModule: "KOL_Registry",
          severity,
          title: `Wallet attributed to @${match.kol.handle}`,
          summary:
            match.label ??
            `${match.kolHandle} · ${match.chain} · attribution ${match.attributionStatus}`,
          confidence:
            match.confidence === "high"
              ? 0.85
              : match.confidence === "medium"
                ? 0.6
                : 0.4,
          payload: {
            address: match.address,
            chain: match.chain,
            handle: match.kol.handle,
            attributionStatus: match.attributionStatus,
          },
        });

        suggestions.push({
          type: "HANDLE",
          value: match.kol.handle,
          label: match.kol.displayName ?? null,
          reason: `Owner of wallet ${shortAddr(match.address)}`,
        });
      }
    }
  } catch (err) {
    return {
      success: true,
      events,
      suggestions,
      error: err instanceof Error ? err.message : "kol_registry_failed",
      sourceStatus: "SOURCE_UNAVAILABLE",
    };
  }

  // KolProfile / KolWallet are always seeded in prod — readiness signal is
  // binary: matched or didn't.
  const sourceStatus =
    events.length > 0 || suggestions.length > 0
      ? "HIT"
      : "NO_INTERNAL_MATCH_YET";
  return { success: true, events, suggestions, sourceStatus };
}

function buildKolSummary(p: {
  handle: string;
  riskFlag: string;
  tier: string | null;
  rugCount: number | null;
  totalScammed: number | null;
}): string {
  const parts: string[] = [];
  parts.push(`risk: ${p.riskFlag}`);
  if (p.tier) parts.push(`tier ${p.tier}`);
  if (p.rugCount && p.rugCount > 0) parts.push(`${p.rugCount} rug(s)`);
  if (p.totalScammed && p.totalScammed > 0) {
    parts.push(`~$${shortUsd(p.totalScammed)} documented`);
  }
  return parts.join(" · ");
}

function shortUsd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
