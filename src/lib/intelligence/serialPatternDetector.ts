// src/lib/intelligence/serialPatternDetector.ts
// Detects deployer wallets that have launched multiple tokens with similar patterns.
// Source: WalletFundingEdge (isProjectLinked=true) + KolTokenInvolvement.
// Legal note: badge is "OBSERVED PATTERN", never "serial scammer".

import { prisma } from "@/lib/prisma";

// ── Public types ─────────────────────────────────────────────────────────────

export type PatternType =
  | "exit_liquidity"
  | "pump_dump"
  | "coordinated_shill"
  | "wallet_cluster";

export interface SerialPattern {
  deployerAddress: string;
  chain: string;
  tokenCount: number;
  rugCount: number;
  patternType: PatternType;
  confidence: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  linkedKolHandles: string[];
  linkedCaseIds: string[];
}

// ── Internal types ────────────────────────────────────────────────────────────

export interface DeployerRow {
  deployerAddress: string;
  chain: string;
  tokenCount: number;
  tokenMints: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface KolTokenRow {
  tokenMint: string;
  kolHandle: string;
  rugCount: number;
}

export interface KolCaseRow {
  kolHandle: string;
  caseId: string;
}

// ── Pure computation (exported for tests) ────────────────────────────────────

export function buildSerialPatterns(
  deployers: DeployerRow[],
  kolTokens: KolTokenRow[],
  kolCases: KolCaseRow[],
): SerialPattern[] {
  const patterns: SerialPattern[] = [];

  for (const d of deployers) {
    if (d.tokenCount < 2) continue;

    // Find KOLs linked to this deployer's tokens
    const mintSet = new Set(d.tokenMints.map((m) => m.toLowerCase()));
    const linkedHandles = [
      ...new Set(
        kolTokens
          .filter((kt) => mintSet.has(kt.tokenMint.toLowerCase()))
          .map((kt) => kt.kolHandle),
      ),
    ];

    // Count total rugs across linked KOLs
    const rugCount = kolTokens
      .filter((kt) => mintSet.has(kt.tokenMint.toLowerCase()))
      .reduce((sum, kt) => sum + kt.rugCount, 0);

    // Find linked case IDs from KolCase
    const linkedHandleSet = new Set(linkedHandles);
    const linkedCaseIds = [
      ...new Set(
        kolCases
          .filter((kc) => linkedHandleSet.has(kc.kolHandle))
          .map((kc) => kc.caseId),
      ),
    ];

    // Determine pattern type
    const patternType = classifyPattern(d.tokenCount, linkedHandles.length, rugCount);

    // Calculate confidence
    const confidence = calcConfidence(d.tokenCount, linkedHandles.length, rugCount);

    patterns.push({
      deployerAddress: d.deployerAddress,
      chain: d.chain,
      tokenCount: d.tokenCount,
      rugCount,
      patternType,
      confidence,
      firstSeenAt: d.firstSeenAt,
      lastSeenAt: d.lastSeenAt,
      linkedKolHandles: linkedHandles,
      linkedCaseIds,
    });
  }

  patterns.sort((a, b) => b.confidence - a.confidence);
  return patterns;
}

function classifyPattern(
  tokenCount: number,
  kolCount: number,
  rugCount: number,
): PatternType {
  if (rugCount > 0 && tokenCount >= 2) return "pump_dump";
  if (kolCount >= 3) return "coordinated_shill";
  if (tokenCount >= 3) return "exit_liquidity";
  return "exit_liquidity";
}

function calcConfidence(
  tokenCount: number,
  kolCount: number,
  rugCount: number,
): number {
  let score = 60;
  // +10 per extra token beyond 2, capped at +30
  score += Math.min(30, (tokenCount - 2) * 10);
  // +10 if 3+ KOLs
  if (kolCount >= 3) score += 10;
  // +10 if rug evidence
  if (rugCount > 0) score += 10;
  return Math.min(100, score);
}

// ── DB loaders ────────────────────────────────────────────────────────────────

async function loadDeployers(): Promise<DeployerRow[]> {
  try {
    type RawRow = {
      deployerAddress: string;
      chain: string;
      tokenCount: bigint;
      tokenMints: string[];
      firstSeenAt: Date;
      lastSeenAt: Date;
    };
    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        "fromAddress"                              AS "deployerAddress",
        chain,
        COUNT(DISTINCT "projectTokenMint")::int    AS "tokenCount",
        array_agg(DISTINCT "projectTokenMint")     AS "tokenMints",
        MIN("observedAt")                          AS "firstSeenAt",
        MAX("observedAt")                          AS "lastSeenAt"
      FROM "WalletFundingEdge"
      WHERE "isProjectLinked" = true
        AND "projectTokenMint" IS NOT NULL
      GROUP BY "fromAddress", chain
      HAVING COUNT(DISTINCT "projectTokenMint") >= 2
      ORDER BY COUNT(DISTINCT "projectTokenMint") DESC
      LIMIT 200
    `;
    return rows.map((r) => ({ ...r, tokenCount: Number(r.tokenCount) }));
  } catch {
    return [];
  }
}

async function loadKolTokens(tokenMints: string[]): Promise<KolTokenRow[]> {
  if (tokenMints.length === 0) return [];
  try {
    type RawRow = { tokenMint: string; kolHandle: string; rugCount: number };
    return await prisma.$queryRaw<RawRow[]>`
      SELECT kti."tokenMint", kti."kolHandle", COALESCE(kp."rugCount", 0) AS "rugCount"
      FROM "KolTokenInvolvement" kti
      JOIN "KolProfile" kp ON kp.handle = kti."kolHandle"
      WHERE kti."tokenMint" = ANY(${tokenMints}::text[])
        AND kti."isPromoted" = true
    `;
  } catch {
    return [];
  }
}

async function loadKolCases(handles: string[]): Promise<KolCaseRow[]> {
  if (handles.length === 0) return [];
  try {
    return await prisma.$queryRaw<KolCaseRow[]>`
      SELECT "kolHandle", "caseId"
      FROM "KolCase"
      WHERE "kolHandle" = ANY(${handles}::text[])
    `;
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect all serial patterns across the entire dataset.
 * Always resolves; never throws.
 */
export async function detectSerialPatterns(): Promise<SerialPattern[]> {
  try {
    const deployers = await loadDeployers();
    if (deployers.length === 0) return [];

    const allMints = [...new Set(deployers.flatMap((d) => d.tokenMints))];
    const [kolTokens, kolCasesRaw] = await Promise.all([
      loadKolTokens(allMints),
      Promise.resolve([] as KolCaseRow[]), // loaded after handles are known
    ]);

    const allHandles = [...new Set(kolTokens.map((kt) => kt.kolHandle))];
    const kolCases = allHandles.length > 0 ? await loadKolCases(allHandles) : kolCasesRaw;

    return buildSerialPatterns(deployers, kolTokens, kolCases);
  } catch (err) {
    console.error("[serialPatternDetector] detectSerialPatterns failed", err);
    return [];
  }
}

/**
 * Persist serial patterns into SerialPattern table (raw SQL).
 * Uses ON CONFLICT("deployerAddress", "chain") DO UPDATE to keep fresh.
 */
export async function persistSerialPatterns(patterns: SerialPattern[]): Promise<void> {
  if (patterns.length === 0) return;

  for (const p of patterns) {
    try {
      const linkedKolHandlesJson = JSON.stringify(p.linkedKolHandles);
      const linkedCaseIdsJson = JSON.stringify(p.linkedCaseIds);
      await prisma.$executeRaw`
        INSERT INTO "SerialPattern"
          ("id", "deployerAddress", "chain", "tokenCount", "rugCount",
           "patternType", "confidence", "firstSeenAt", "lastSeenAt",
           "linkedKolHandles", "linkedCaseIds", "createdAt")
        VALUES
          (gen_random_uuid()::text, ${p.deployerAddress}, ${p.chain},
           ${p.tokenCount}, ${p.rugCount}, ${p.patternType}, ${p.confidence},
           ${p.firstSeenAt}, ${p.lastSeenAt},
           ${linkedKolHandlesJson}::jsonb, ${linkedCaseIdsJson}::jsonb, now())
        ON CONFLICT ("deployerAddress", "chain") DO UPDATE SET
          "tokenCount"       = EXCLUDED."tokenCount",
          "rugCount"         = EXCLUDED."rugCount",
          "patternType"      = EXCLUDED."patternType",
          "confidence"       = EXCLUDED."confidence",
          "lastSeenAt"       = EXCLUDED."lastSeenAt",
          "linkedKolHandles" = EXCLUDED."linkedKolHandles",
          "linkedCaseIds"    = EXCLUDED."linkedCaseIds"
      `;
    } catch (err) {
      console.error("[serialPatternDetector] persistSerialPatterns row failed", err);
    }
  }
}
