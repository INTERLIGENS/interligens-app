/**
 * Watcher Campaign Clusterer V1 — deterministic grouping of shill signals.
 *
 * Groups SocialPostCandidate records into WatcherCampaign clusters by:
 *   1. Exact contract address match
 *   2. Same token symbol within a 72h window
 *   3. Fallback: single-KOL individual campaign
 *
 * Priority scoring:
 *   HIGH     — same token from ≥2 KOLs, contract present, extreme claims,
 *               recruitment language, KOL tier=RED
 *   CRITICAL — token matches an existing KolTokenInvolvement record
 */

import { prisma } from "@/lib/prisma";

// ── Types ────────────────────────────────────────────────────────────────────

export type SignalInput = {
  id: string;
  kolHandle: string;
  kolProfileId?: string | null;
  detectedTokens: string;    // JSON string e.g. '["$BONK","$WIF"]'
  detectedAddresses: string; // JSON string e.g. '["So1...","0x..."]'
  rawText?: string | null;
  discoveredAtUtc: Date;
  signalScore: number;
};

export type ClusterResult = {
  campaignsCreated: number;
  signalsLinked: number;
  highPriority: number;
  critical: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours

const HIGH_CLAIM_RE = /\b(50x|100x|10x|called.{0,20}mcap|mcap.{0,20}called)\b/i;
const RECRUIT_RE = /\b(dm.{0,10}(to join|me|us)|alpha.{0,15}tg|paid dexscreener|dexscreener.{0,15}paid|entry.{0,10}wl)\b/i;

function parseJson(s: string): string[] {
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function normToken(t: string): string {
  return t.replace(/^\$/, "").toUpperCase().trim();
}

function isHighClaim(rawText?: string | null): boolean {
  if (!rawText) return false;
  return HIGH_CLAIM_RE.test(rawText) || RECRUIT_RE.test(rawText);
}

// ── Priority scoring ─────────────────────────────────────────────────────────

async function scorePriority(
  tokenSymbols: string[],
  contractAddresses: string[],
  kolHandles: string[],
  claimHit: boolean,
  isCritical: boolean,
): Promise<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> {
  if (isCritical) return "CRITICAL";

  let score = 0;
  if (contractAddresses.length > 0)  score += 2;
  if (kolHandles.length >= 2)        score += 2;
  if (claimHit)                      score += 2;

  // KOL RED tier check
  if (kolHandles.length > 0) {
    const redKols = await prisma.kolProfile.count({
      where: { handle: { in: kolHandles }, tier: "RED" },
    });
    if (redKols > 0) score += 2;
  }

  if (score >= 2) return "HIGH";
  if (score >= 1) return "MEDIUM";
  return "LOW";
}

// ── Main clusterer ────────────────────────────────────────────────────────────

export async function clusterSignals(signals: SignalInput[]): Promise<ClusterResult> {
  if (signals.length === 0) return { campaignsCreated: 0, signalsLinked: 0, highPriority: 0, critical: 0 };

  // ── Build lookup structures ──────────────────────────────────────────────
  // contractAddress → signal ids
  const byContract = new Map<string, string[]>();
  // normToken → { ids, timestamps }
  const byToken = new Map<string, { id: string; ts: number; handle: string }[]>();

  for (const sig of signals) {
    const addresses = parseJson(sig.detectedAddresses).filter((a) => a.length >= 32);
    const tokens = parseJson(sig.detectedTokens).map(normToken).filter(Boolean);

    for (const addr of addresses) {
      if (!byContract.has(addr)) byContract.set(addr, []);
      byContract.get(addr)!.push(sig.id);
    }
    for (const tok of tokens) {
      if (!byToken.has(tok)) byToken.set(tok, []);
      byToken.get(tok)!.push({ id: sig.id, ts: sig.discoveredAtUtc.getTime(), handle: sig.kolHandle });
    }
  }

  // ── Assign signals to groups ─────────────────────────────────────────────
  // signalId → groupKey
  const signalGroup = new Map<string, string>();

  // Pass 1: group by contract address
  for (const [addr, ids] of byContract) {
    if (ids.length === 0) continue;
    const groupKey = `contract:${addr}`;
    for (const id of ids) signalGroup.set(id, groupKey);
  }

  // Pass 2: group ungrouped signals by token symbol within 72h window
  for (const [tok, entries] of byToken) {
    // Sort by timestamp
    const sorted = [...entries].sort((a, b) => a.ts - b.ts);
    let windowStart = sorted[0].ts;
    let windowGroup: typeof sorted = [];

    for (const entry of sorted) {
      if (entry.ts - windowStart > WINDOW_MS) {
        // Flush current window group
        if (windowGroup.length > 0) {
          const key = `token:${tok}:${windowStart}`;
          for (const e of windowGroup) {
            if (!signalGroup.has(e.id)) signalGroup.set(e.id, key);
          }
        }
        windowStart = entry.ts;
        windowGroup = [];
      }
      windowGroup.push(entry);
    }
    // Flush last window
    if (windowGroup.length > 0) {
      const key = `token:${tok}:${windowStart}`;
      for (const e of windowGroup) {
        if (!signalGroup.has(e.id)) signalGroup.set(e.id, key);
      }
    }
  }

  // Pass 3: ungrouped signals get their own single-signal campaign
  for (const sig of signals) {
    if (!signalGroup.has(sig.id)) {
      signalGroup.set(sig.id, `solo:${sig.id}`);
    }
  }

  // ── Build groups → campaigns ─────────────────────────────────────────────
  // groupKey → SignalInput[]
  const groups = new Map<string, SignalInput[]>();
  for (const [id, key] of signalGroup) {
    const sig = signals.find((s) => s.id === id)!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(sig);
  }

  // ── Resolve KolTokenInvolvement tokens for CRITICAL check ──────────────
  const allNormTokens = [...byToken.keys()];
  const criticalTokens = new Set<string>();
  if (allNormTokens.length > 0) {
    const involvements = await prisma.kolTokenInvolvement.findMany({
      where: { isPromoted: true },
      select: { tokenMint: true },
    });
    // tokenMint may be a symbol or a contract — check both
    const involvedMints = new Set(involvements.map((i) => i.tokenMint.toUpperCase()));
    for (const tok of allNormTokens) {
      if (involvedMints.has(tok)) criticalTokens.add(tok);
    }
    // Also check byContract addresses
    for (const addr of byContract.keys()) {
      if (involvedMints.has(addr.toUpperCase())) criticalTokens.add(addr);
    }
  }

  // ── Write campaigns to DB ────────────────────────────────────────────────
  let campaignsCreated = 0;
  let signalsLinked = 0;
  let highPriority = 0;
  let critical = 0;

  for (const [groupKey, groupSignals] of groups) {
    const kolHandles = [...new Set(groupSignals.map((s) => s.kolHandle))];
    const addresses = groupSignals.flatMap((s) => parseJson(s.detectedAddresses));
    const tokens = [...new Set(groupSignals.flatMap((s) => parseJson(s.detectedTokens).map(normToken)))];

    const primaryContract = groupKey.startsWith("contract:")
      ? groupKey.replace("contract:", "")
      : (addresses[0] ?? null);
    const primaryToken = groupKey.startsWith("token:")
      ? groupKey.split(":")[1]
      : (tokens[0] ?? null);

    const claimHit = groupSignals.some((s) => isHighClaim(s.rawText));
    const isCritical = tokens.some((t) => criticalTokens.has(t)) ||
      addresses.some((a) => criticalTokens.has(a.toUpperCase()));

    const priority = await scorePriority(tokens, addresses, kolHandles, claimHit, isCritical);

    const firstSeenAt = new Date(Math.min(...groupSignals.map((s) => s.discoveredAtUtc.getTime())));
    const lastSeenAt  = new Date(Math.max(...groupSignals.map((s) => s.discoveredAtUtc.getTime())));

    const campaign = await prisma.watcherCampaign.create({
      data: {
        primaryTokenSymbol: primaryToken,
        primaryContractAddress: primaryContract,
        status: "ACTIVE",
        priority,
        firstSeenAt,
        lastSeenAt,
        signalCount: groupSignals.length,
        kolCount: kolHandles.length,
        claimPatterns: JSON.stringify(claimHit ? ["extreme_claim"] : []),
      },
    });
    campaignsCreated++;
    if (priority === "HIGH") highPriority++;
    if (priority === "CRITICAL") critical++;

    // Link signals → campaign
    await prisma.socialPostCandidate.updateMany({
      where: { id: { in: groupSignals.map((s) => s.id) } },
      data: { campaignId: campaign.id },
    });
    signalsLinked += groupSignals.length;

    // Upsert WatcherCampaignKOL rows
    for (const handle of kolHandles) {
      const handleSignals = groupSignals.filter((s) => s.kolHandle === handle);
      const kolProfileId = handleSignals.find((s) => s.kolProfileId)?.kolProfileId ?? null;

      const existing = await prisma.watcherCampaignKOL.findUnique({
        where: { campaignId_kolHandle: { campaignId: campaign.id, kolHandle: handle } },
      });
      if (existing) {
        await prisma.watcherCampaignKOL.update({
          where: { campaignId_kolHandle: { campaignId: campaign.id, kolHandle: handle } },
          data: {
            signalCount: { increment: handleSignals.length },
            lastSeenAt: new Date(Math.max(...handleSignals.map((s) => s.discoveredAtUtc.getTime()))),
          },
        });
      } else {
        await prisma.watcherCampaignKOL.create({
          data: {
            campaignId: campaign.id,
            kolHandle: handle,
            kolProfileId: kolProfileId ?? null,
            signalCount: handleSignals.length,
            firstSeenAt: new Date(Math.min(...handleSignals.map((s) => s.discoveredAtUtc.getTime()))),
            lastSeenAt:  new Date(Math.max(...handleSignals.map((s) => s.discoveredAtUtc.getTime()))),
          },
        });
      }
    }
  }

  return { campaignsCreated, signalsLinked, highPriority, critical };
}
