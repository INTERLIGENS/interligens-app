// src/lib/kol/canonical.ts
// Single source of truth for KOL profile data consumed by all public surfaces.
// totalDocumented is NEVER recomputed here — always read from KolProfile (Writer A).

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type KolSnapshotFreshness = "fresh" | "stale" | "unknown";

export type WalletIdentityConfidence = "exact" | "strong" | "probable" | "candidate";
export type WalletAttributionMode = "manual" | "inferred";

export const SNAPSHOT_VERSION = "1.0.0" as const;
export const IDENTITY_RESOLUTION_VERSION = "1.0.0" as const;

/** Core contract — guaranteed fields on every snapshot */
export type KolCanonicalSnapshot = {
  handle: string;
  displayName: string | null;
  publishStatus: string;
  riskFlag: string | null;
  tier: string | null;
  totalDocumented: number;
  totalScammed: number | null;
  walletCount: number;
  evidenceCount: number;
  lastScannedAt: Date | null;
  proceedsSource: "KolProceedsEvent";
  freshness: KolSnapshotFreshness;
  identityConfidence: WalletIdentityConfidence;
  walletAttributionMode: WalletAttributionMode;
  walletDataFreshAt: Date | null;
  // Versioning
  snapshotVersion: typeof SNAPSHOT_VERSION;
  proceedsComputedAt: Date | null;
  identityResolutionVersion: typeof IDENTITY_RESOLUTION_VERSION;
  builtFromEventId: string | null;
};

/** Extended row — includes all fields needed by API routes (superset of core) */
export type KolProfileRow = KolCanonicalSnapshot & {
  platform: string;
  confidence: string;
  evidenceDepth: string;
  completenessLevel: string;
  profileStrength: string;
  behaviorFlags: string;
  summary: string | null;
  exitDate: Date | null;
  evmAddress: string | null;
  rugCount: number;
  followerCount: number | null;
  verified: boolean;
  proceedsCoverage: string | null;
  updatedAt: Date;
  publishable: boolean;
  bio: string | null;
  _count: {
    evidences: number;
    kolWallets: number;
    kolCases: number;
    tokenLinks: number;
  };
};

const FRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

type WalletRow = { confidence: string; attributionSource: string | null; attributionStatus: string; discoveredAt: Date | null };

function computeIdentityConfidence(wallets: WalletRow[]): WalletIdentityConfidence {
  if (!wallets.length) return "candidate";
  if (wallets.some(w => w.attributionStatus === "confirmed" && w.attributionSource === "manual")) return "exact";
  if (wallets.some(w => w.confidence === "high" || w.attributionStatus === "confirmed")) return "strong";
  if (wallets.some(w => w.confidence === "medium")) return "probable";
  return "candidate";
}

function computeAttributionMode(wallets: WalletRow[]): WalletAttributionMode {
  return wallets.some(w => w.attributionSource === "manual") ? "manual" : "inferred";
}

function computeWalletDataFreshAt(wallets: WalletRow[]): Date | null {
  const dates = wallets.map(w => w.discoveredAt).filter((d): d is Date => d !== null);
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map(d => d.getTime())));
}

function computeFreshness(lastHeliusScan: Date | null): KolSnapshotFreshness {
  if (!lastHeliusScan) return "unknown";
  return Date.now() - new Date(lastHeliusScan).getTime() < FRESH_THRESHOLD_MS
    ? "fresh"
    : "stale";
}

const KOL_SELECT = {
  handle: true,
  displayName: true,
  publishStatus: true,
  riskFlag: true,
  tier: true,
  totalDocumented: true,
  totalScammed: true,
  lastHeliusScan: true,
  platform: true,
  confidence: true,
  evidenceDepth: true,
  completenessLevel: true,
  profileStrength: true,
  behaviorFlags: true,
  summary: true,
  exitDate: true,
  evmAddress: true,
  rugCount: true,
  followerCount: true,
  verified: true,
  proceedsCoverage: true,
  updatedAt: true,
  publishable: true,
  bio: true,
  _count: {
    select: {
      evidences: true,
      kolWallets: true,
      kolCases: true,
      tokenLinks: true,
    },
  },
  kolWallets: {
    where: { status: "active" },
    select: {
      confidence: true,
      attributionSource: true,
      attributionStatus: true,
      discoveredAt: true,
    },
  },
} as const;

type RawRow = Prisma.KolProfileGetPayload<{ select: typeof KOL_SELECT }>;

function toSnapshot(row: RawRow): KolProfileRow {
  return {
    handle: row.handle,
    displayName: row.displayName,
    publishStatus: row.publishStatus,
    riskFlag: row.riskFlag,
    tier: row.tier,
    totalDocumented: row.totalDocumented ?? 0,
    totalScammed: row.totalScammed,
    walletCount: row._count.kolWallets,
    evidenceCount: row._count.evidences,
    lastScannedAt: row.lastHeliusScan,
    proceedsSource: "KolProceedsEvent",
    freshness: computeFreshness(row.lastHeliusScan),
    identityConfidence: computeIdentityConfidence(row.kolWallets),
    walletAttributionMode: computeAttributionMode(row.kolWallets),
    walletDataFreshAt: computeWalletDataFreshAt(row.kolWallets),
    snapshotVersion: SNAPSHOT_VERSION,
    proceedsComputedAt: row.lastHeliusScan,
    identityResolutionVersion: IDENTITY_RESOLUTION_VERSION,
    builtFromEventId: null,
    platform: row.platform,
    confidence: row.confidence,
    evidenceDepth: row.evidenceDepth,
    completenessLevel: row.completenessLevel,
    profileStrength: row.profileStrength,
    behaviorFlags: row.behaviorFlags,
    summary: row.summary,
    exitDate: row.exitDate,
    evmAddress: row.evmAddress,
    rugCount: row.rugCount,
    followerCount: row.followerCount,
    verified: row.verified,
    proceedsCoverage: row.proceedsCoverage,
    updatedAt: row.updatedAt,
    publishable: row.publishable,
    bio: row.bio,
    _count: row._count,
  };
}

export async function buildKolCanonicalSnapshot(
  handle: string
): Promise<KolProfileRow | null> {
  const row = await prisma.kolProfile.findUnique({
    where: { handle },
    select: KOL_SELECT,
  });
  if (!row) return null;
  return toSnapshot(row);
}

export async function buildKolCanonicalSnapshotBatch(
  where: Prisma.KolProfileWhereInput,
  orderBy?:
    | Prisma.KolProfileOrderByWithRelationInput
    | Prisma.KolProfileOrderByWithRelationInput[]
): Promise<KolProfileRow[]> {
  const rows = await prisma.kolProfile.findMany({
    where,
    select: KOL_SELECT,
    orderBy,
  });
  return rows.map(toSnapshot);
}
