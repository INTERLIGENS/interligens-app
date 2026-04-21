// ─── MM alert manager (Phase 9) ──────────────────────────────────────────
// Thin reader over MmReviewLog that surfaces the alerts emitted by the
// Watcher hook (actorRole=watcher_mm_alert). Used by the investigator
// dashboard tab to render "latest MM alerts" without re-implementing
// Prisma queries in the view.

import { prisma } from "@/lib/prisma";
import type { MmChain } from "../types";

export interface MmAlert {
  id: string;
  tokenAddress: string | null;
  chain: MmChain | null;
  kolHandle: string | null;
  displayScore: number | null;
  band: string | null;
  tweetUrl: string | null;
  detectedAt: string | null;
  createdAt: string;
}

interface SnapshotShape {
  tokenAddress?: string;
  chain?: string;
  kolHandle?: string;
  displayScore?: number;
  band?: string;
  tweetUrl?: string | null;
  detectedAt?: string;
}

function castAlert(row: {
  id: string;
  createdAt: Date;
  snapshotAfter: unknown;
}): MmAlert | null {
  const snap = (row.snapshotAfter ?? null) as SnapshotShape | null;
  if (!snap || typeof snap !== "object") return null;
  return {
    id: row.id,
    tokenAddress: snap.tokenAddress ?? null,
    chain: (snap.chain as MmChain | undefined) ?? null,
    kolHandle: snap.kolHandle ?? null,
    displayScore:
      typeof snap.displayScore === "number" ? snap.displayScore : null,
    band: snap.band ?? null,
    tweetUrl: snap.tweetUrl ?? null,
    detectedAt: snap.detectedAt ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface GetAlertsOptions {
  /**
   * Only return alerts created strictly after this moment. Defaults to "the
   * beginning of time" (i.e. no lower bound).
   */
  since?: Date;
  /**
   * Only return alerts at this severity or higher. "ORANGE" includes RED
   * alerts. Defaults to "ORANGE".
   */
  minBand?: "ORANGE" | "RED";
  /**
   * Max rows returned. Default 50, cap 500.
   */
  limit?: number;
}

export async function getPendingAlerts(
  opts: GetAlertsOptions = {},
): Promise<MmAlert[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const rows = await prisma.mmReviewLog.findMany({
    where: {
      action: "CREATED",
      actorRole: "watcher_mm_alert",
      ...(opts.since ? { createdAt: { gt: opts.since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      snapshotAfter: true,
    },
  });

  const alerts: MmAlert[] = [];
  for (const r of rows) {
    const alert = castAlert(r);
    if (!alert) continue;
    if (opts.minBand === "RED" && alert.band !== "RED") continue;
    // Default minBand = "ORANGE" keeps anything ORANGE / RED.
    alerts.push(alert);
  }
  return alerts;
}

export async function countPendingAlerts(since?: Date): Promise<number> {
  return prisma.mmReviewLog.count({
    where: {
      action: "CREATED",
      actorRole: "watcher_mm_alert",
      ...(since ? { createdAt: { gt: since } } : {}),
    },
  });
}
