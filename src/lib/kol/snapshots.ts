// src/lib/kol/snapshots.ts
// Read-only snapshot projections. These functions compute nothing —
// they project from KolCanonicalSnapshot into consumer-specific shapes.

import { prisma } from "@/lib/prisma";
import {
  buildKolCanonicalSnapshot,
  buildKolCanonicalSnapshotBatch,
  type KolProfileRow,
  type KolSnapshotFreshness,
  type WalletIdentityConfidence,
  type WalletAttributionMode,
} from "./canonical";

// ── KolPublicSnapshot ────────────────────────────────────────────────────────
// Used by Explorer / Registry / Watchlist.

export type KolPublicSnapshot = {
  handle: string;
  displayName: string | null;
  publishStatus: string;
  riskFlag: string | null;
  tier: string | null;
  totalDocumented: number;
  walletCount: number;
  evidenceCount: number;
  identityConfidence: WalletIdentityConfidence;
  walletAttributionMode: WalletAttributionMode;
  freshness: KolSnapshotFreshness;
  snapshotBuiltAt: Date;
  proceedsSource: "KolProceedsEvent";
};

function toPublicSnapshot(row: KolProfileRow): KolPublicSnapshot {
  return {
    handle: row.handle,
    displayName: row.displayName,
    publishStatus: row.publishStatus,
    riskFlag: row.riskFlag,
    tier: row.tier,
    totalDocumented: row.totalDocumented,
    walletCount: row.walletCount,
    evidenceCount: row.evidenceCount,
    identityConfidence: row.identityConfidence,
    walletAttributionMode: row.walletAttributionMode,
    freshness: row.freshness,
    snapshotBuiltAt: new Date(),
    proceedsSource: "KolProceedsEvent",
  };
}

export async function buildKolPublicSnapshot(
  handle: string
): Promise<KolPublicSnapshot | null> {
  const row = await buildKolCanonicalSnapshot(handle);
  if (!row) return null;
  return toPublicSnapshot(row);
}

export async function buildKolPublicSnapshotBatch(
  handles: string[]
): Promise<KolPublicSnapshot[]> {
  if (!handles.length) return [];
  const rows = await buildKolCanonicalSnapshotBatch({
    handle: { in: handles, mode: "insensitive" },
  });
  return rows.map(toPublicSnapshot);
}

// ── MobileScanSnapshot ───────────────────────────────────────────────────────
// Minimal projection for iOS — only what the app needs.

export type TopWallet = {
  address: string;
  chain: string;
  label: string | null;
};

export type MobileScanSnapshot = {
  handle: string;
  displayName: string | null;
  riskFlag: string | null;
  tier: string | null;
  totalDocumented: number;
  freshness: KolSnapshotFreshness;
  topWallets: TopWallet[];
};

export async function buildMobileScanSnapshot(
  handle: string
): Promise<MobileScanSnapshot | null> {
  const row = await buildKolCanonicalSnapshot(handle);
  if (!row) return null;

  // Fetch top 3 active wallets — read-only, no computation
  const wallets = await prisma.kolWallet.findMany({
    where: {
      kolHandle: { equals: handle, mode: "insensitive" },
      status: "active",
    },
    select: { address: true, chain: true, label: true },
    orderBy: { createdAt: "asc" },
    take: 3,
  });

  return {
    handle: row.handle,
    displayName: row.displayName,
    riskFlag: row.riskFlag,
    tier: row.tier,
    totalDocumented: row.totalDocumented,
    freshness: row.freshness,
    topWallets: wallets,
  };
}
