/**
 * src/app/api/cron/watch-rescan/route.ts
 *
 * Daily cron that re-scans every active WatchedAddress whose lastScannedAt
 * is null or older than 24h. For each row:
 *   1. Calls the appropriate existing scan endpoint (SOL → /api/scan/solana,
 *      EVM → /api/scan/evm) with the stored address.
 *   2. Compares the fresh score/tier against the stored lastScore/lastTier.
 *   3. Creates a WatchAlert row if any material change is detected:
 *        - tier change (any direction)
 *        - score delta > 15 points
 *        - governed status change
 *   4. Updates the WatchedAddress row with the fresh snapshot.
 *
 * Email delivery is intentionally NOT performed here — that's a follow-up
 * step. Alerts accumulate in the WatchAlert table until a separate notify
 * cron picks them up.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RESCAN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const BATCH_LIMIT = 50;
const SCORE_CHANGE_THRESHOLD = 15;

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.interligens.com";
}

type ScanResult = {
  score: number | null;
  tier: string | null;
  governedStatus: string | null;
};

async function scanOne(
  address: string,
  chain: string
): Promise<ScanResult> {
  const baseUrl = getBaseUrl();
  const isEvm = chain !== "solana";
  const url = isEvm
    ? `${baseUrl}/api/scan/evm?address=${encodeURIComponent(address)}`
    : `${baseUrl}/api/scan/solana?address=${encodeURIComponent(address)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { score: null, tier: null, governedStatus: null };
    const data = (await res.json()) as {
      tigerScore?: number;
      score?: number;
      tiger_score?: number;
      color?: string;
      tier?: string;
      tiger_tier?: string;
      governedStatus?: string;
      governed_status?: string;
    };
    const score =
      data.tigerScore ?? data.tiger_score ?? data.score ?? null;
    const tier =
      data.color ?? data.tier ?? data.tiger_tier ?? null;
    const governedStatus =
      data.governedStatus ?? data.governed_status ?? null;
    return { score, tier, governedStatus };
  } catch (err) {
    console.warn(`[watch-rescan] scan failed for ${chain}:${address}`, err);
    return { score: null, tier: null, governedStatus: null };
  }
}

type ChangeDetection = {
  changed: boolean;
  changeType: "tier_change" | "score_change" | "governed_status_change" | null;
  changeDetail: string;
};

function detectChange(
  previous: {
    score: number | null;
    tier: string | null;
    governedStatus: string | null;
  },
  current: {
    score: number | null;
    tier: string | null;
    governedStatus: string | null;
  }
): ChangeDetection {
  if (
    previous.tier &&
    current.tier &&
    previous.tier !== current.tier
  ) {
    return {
      changed: true,
      changeType: "tier_change",
      changeDetail: `${previous.tier} → ${current.tier}`,
    };
  }
  if (
    previous.score != null &&
    current.score != null &&
    Math.abs(current.score - previous.score) > SCORE_CHANGE_THRESHOLD
  ) {
    return {
      changed: true,
      changeType: "score_change",
      changeDetail: `${previous.score} → ${current.score}`,
    };
  }
  if (
    previous.governedStatus &&
    current.governedStatus &&
    previous.governedStatus !== current.governedStatus
  ) {
    return {
      changed: true,
      changeType: "governed_status_change",
      changeDetail: `${previous.governedStatus} → ${current.governedStatus}`,
    };
  }
  return { changed: false, changeType: null, changeDetail: "" };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - RESCAN_INTERVAL_MS);

    const rows = await prisma.watchedAddress.findMany({
      where: {
        active: true,
        OR: [{ lastScannedAt: null }, { lastScannedAt: { lt: cutoff } }],
      },
      orderBy: { lastScannedAt: { sort: "asc", nulls: "first" } },
      take: BATCH_LIMIT,
    });

    let rescanned = 0;
    let alertsCreated = 0;

    for (const row of rows) {
      const result = await scanOne(row.address, row.chain);
      rescanned++;

      // Skip row update if the scan returned nothing usable — keep the
      // previous snapshot so we don't lose it due to a transient failure.
      if (result.score == null || result.tier == null) {
        continue;
      }

      const change = detectChange(
        {
          score: row.lastScore,
          tier: row.lastTier,
          governedStatus: row.lastGovernedStatus,
        },
        result
      );

      if (change.changed && change.changeType && row.alertOnChange) {
        await prisma.watchAlert.create({
          data: {
            watchedAddressId: row.id,
            previousScore: row.lastScore,
            newScore: result.score,
            previousTier: row.lastTier,
            newTier: result.tier,
            changeType: change.changeType,
            changeDetail: change.changeDetail,
          },
        });
        alertsCreated++;
      }

      await prisma.watchedAddress.update({
        where: { id: row.id },
        data: {
          lastScore: result.score,
          lastTier: result.tier,
          lastGovernedStatus: result.governedStatus,
          lastScannedAt: new Date(),
        },
      });
    }

    console.log(
      `[watch-rescan] rescanned=${rescanned} alertsCreated=${alertsCreated}`
    );

    return NextResponse.json({
      ok: true,
      rescanned,
      alertsCreated,
      batchSize: rows.length,
    });
  } catch (err) {
    console.error("[watch-rescan] cron failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
