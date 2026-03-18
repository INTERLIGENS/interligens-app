/**
 * src/app/api/admin/onchain/status/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const [totalWallets, syncedLast24h, errorCount, recentEvents] = await Promise.all([
    prisma.wallet.count({ where: { chain: "ethereum" } }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM wallet_sync_state
      WHERE "lastSyncAt" > NOW() - INTERVAL '24 hours'
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM wallet_sync_state WHERE status = 'error'::"SyncStatus"
    `,
    prisma.$queryRaw<any[]>`
      SELECT "walletAddress", "txHash", "eventType", direction, "blockTimeUtc", "tokenSymbol", "isCexDeposit"
      FROM onchain_events ORDER BY "blockTimeUtc" DESC LIMIT 5
    `,
  ]);

  return NextResponse.json({
    totalWallets,
    syncedLast24h: Number(syncedLast24h[0]?.count ?? 0),
    errorCount: Number(errorCount[0]?.count ?? 0),
    recentEvents,
  });
}
