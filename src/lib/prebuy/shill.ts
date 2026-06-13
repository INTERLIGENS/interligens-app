/**
 * PRE-BUY GUARD — on-chain shill-correlation layer.
 *
 * Given a tokenMint, answer: "did pre-shill wallets front-run this token's
 * promotions, and are any of them surviving correlation candidates?"
 *
 * The path is indirect because ShillCorrelationCandidate is keyed by
 * (kolHandle, wallet, chain), NOT by tokenMint:
 *
 *   ShillEvent            WHERE tokenMint = ?            → eventIds + kolHandles
 *     → ShillBuyerObservation WHERE shillEventId IN ?    → buyer wallets
 *       → ShillCorrelationCandidate WHERE wallet IN ?    → surviving candidates
 *          AND excludedReason IS NULL  (PHASE 4.6 vetting survivors only)
 *
 * CRITICAL INVARIANT: absence of correlation data reads as "unknown", never
 * "clean". `available=false` means we have no ingested shill data for this
 * token — it is NOT evidence of low risk and never produces a reassuring
 * signal. This layer only ever escalates; it never clears.
 *
 * Read-only. Fail-soft: any DB error degrades to an unavailable summary
 * rather than throwing (the X API spend cap until 2026-06-21 means shill
 * ingestion may be stale; we must never block on it).
 */
import { prisma } from "@/lib/prisma";

export interface ShillCorrelationSummary {
  /** false = no ingested shill data for this token → treat as UNKNOWN, never clean. */
  available: boolean;
  /** # ShillEvents recorded for this token (who shilled it). */
  shillEventCount: number;
  /** Surviving correlation candidates (excludedReason IS NULL) linked to this token's buyers. */
  survivingCount: number;
  /** Max correlationScore among surviving candidates (0 when none). */
  maxScore: number;
  /** Strongest classification among surviving candidates. */
  topClassification: "watch" | "candidate" | "high_interest" | null;
  /** Convenience flag: at least one surviving high_interest candidate. */
  hasHighInterest: boolean;
  /** Distinct kolHandles attached to surviving candidates for this token. */
  kolHandles: string[];
  /** Diagnostic — why this summary looks the way it does. */
  reason: string;
}

const CLASS_RANK: Record<string, number> = {
  watch: 1,
  candidate: 2,
  high_interest: 3,
};

/** Lowercase chain aliases ShillEvent rows may have been stored under. */
function chainAliasesLower(chain: string): string[] {
  const x = (chain || "").toLowerCase().trim();
  if (x === "sol" || x === "solana") return ["solana", "sol"];
  if (x === "eth" || x === "ethereum" || x === "evm")
    return ["ethereum", "eth", "evm"];
  return x ? [x] : [];
}

function unavailable(reason: string): ShillCorrelationSummary {
  return {
    available: false,
    shillEventCount: 0,
    survivingCount: 0,
    maxScore: 0,
    topClassification: null,
    hasHighInterest: false,
    kolHandles: [],
    reason,
  };
}

/**
 * Did the watcher ever see this mint, even before a ShillEvent was resolved?
 * SocialPostCandidate.detectedTokens is typed `String` in Prisma but is a
 * jsonb array in Postgres (schema drift) — must be queried with raw SQL and
 * the jsonb existence operator, not the Prisma client.
 */
async function watcherSawToken(tokenMint: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM social_post_candidates WHERE ("detectedTokens")::jsonb ? $1`,
      tokenMint,
    );
    return (rows?.[0]?.n ?? 0) > 0;
  } catch {
    // Column shape / pooler edge — fall back to ShillEvent presence only.
    return false;
  }
}

export async function getShillCorrelationForToken(
  tokenMint: string,
  chain: string,
): Promise<ShillCorrelationSummary> {
  const mint = (tokenMint || "").trim();
  if (!mint) return unavailable("no tokenMint provided");

  const chains = chainAliasesLower(chain);

  try {
    // 1. ShillEvents for this token → who shilled it + the event ids.
    const events = await prisma.shillEvent.findMany({
      where: {
        tokenMint: mint,
        ...(chains.length ? { chain: { in: chains } } : {}),
      },
      select: { id: true, kolHandle: true },
    });

    if (events.length === 0) {
      // No resolved shill events. Check whether the watcher saw the mint at
      // all so we can distinguish "watcher-blind" from "seen, not correlated".
      const seen = await watcherSawToken(mint);
      return seen
        ? {
            ...unavailable(
              "watcher observed this token but no resolved shill events / correlation yet — coverage partial, not clean",
            ),
            // still "available=false" for fusion (no positive correlation),
            // but the reason makes the partial-coverage caveat explicit.
          }
        : unavailable("no shill events recorded for this token");
    }

    const eventIds = events.map((e) => e.id);

    // 2. Buyer wallets observed around those shill events.
    const observations = await prisma.shillBuyerObservation.findMany({
      where: { shillEventId: { in: eventIds } },
      select: { wallet: true },
    });
    const wallets = Array.from(new Set(observations.map((o) => o.wallet)));

    if (wallets.length === 0) {
      return {
        ...unavailable(
          `${events.length} shill event(s) but no buyer observations fetched yet — coverage partial, not clean`,
        ),
        shillEventCount: events.length,
        // available stays false: no positive correlation signal to assert.
      };
    }

    // 3. Surviving correlation candidates among those wallets.
    //    excludedReason IS NULL = passed PHASE 4.6 bot/router vetting.
    const candidates = await prisma.shillCorrelationCandidate.findMany({
      where: {
        wallet: { in: wallets },
        ...(chains.length ? { chain: { in: chains } } : {}),
        excludedReason: null,
      },
      select: {
        kolHandle: true,
        correlationScore: true,
        classification: true,
      },
      orderBy: { correlationScore: "desc" },
    });

    if (candidates.length === 0) {
      return {
        available: true,
        shillEventCount: events.length,
        survivingCount: 0,
        maxScore: 0,
        topClassification: null,
        hasHighInterest: false,
        kolHandles: Array.from(new Set(events.map((e) => e.kolHandle))),
        reason: `${events.length} shill event(s), ${wallets.length} buyer wallet(s), but no surviving correlation candidate after vetting`,
      };
    }

    const maxScore = Math.max(
      0,
      ...candidates.map((c) => Number(c.correlationScore ?? 0)),
    );
    const topClassification = candidates.reduce<string | null>((acc, c) => {
      const cur = c.classification ?? null;
      if (!cur) return acc;
      if (!acc) return cur;
      return (CLASS_RANK[cur] ?? 0) > (CLASS_RANK[acc] ?? 0) ? cur : acc;
    }, null) as ShillCorrelationSummary["topClassification"];

    return {
      available: true,
      shillEventCount: events.length,
      survivingCount: candidates.length,
      maxScore,
      topClassification,
      hasHighInterest: candidates.some(
        (c) => c.classification === "high_interest",
      ),
      kolHandles: Array.from(new Set(candidates.map((c) => c.kolHandle))),
      reason: `${candidates.length} surviving correlation candidate(s); max score ${maxScore}`,
    };
  } catch (err) {
    return unavailable(
      `shill-correlation lookup failed (degraded): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
