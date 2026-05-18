// src/lib/kol/identity.ts
// Identity Resolution Layer — formal wallet→KOL attribution with confidence levels.
// Prevents cross-attribution of proceeds to the wrong person.

import { prisma } from "@/lib/prisma";

export type WalletMatchConfidence =
  | "exact"
  | "strong"
  | "probable"
  | "candidate"
  | "unresolved";

export type WalletMatchSource =
  | "manual"
  | "on_chain_footprint"
  | "airdrop"
  | "promotion_tx"
  | "inferred";

export type WalletMatchResult = {
  handle: string | null;
  confidence: WalletMatchConfidence;
  source: WalletMatchSource;
  evidence: string[];
  requiresHumanReview: boolean;
};

export type WalletAttributionRow = {
  address: string;
  chain: string;
  label: string | null;
  confidence: WalletMatchConfidence;
  source: WalletMatchSource;
  attributionStatus: string;
  discoveredAt: Date | null;
};

// Maps the KolWallet.confidence DB string to our typed confidence scale.
// KolWallet uses "high" / "medium" / "low"; exact match is reserved for
// records confirmed via manual review (attributionStatus = "confirmed").
function mapDbConfidence(
  dbConfidence: string,
  attributionStatus: string
): WalletMatchConfidence {
  if (attributionStatus === "confirmed" || dbConfidence === "high") return "strong";
  if (dbConfidence === "medium") return "probable";
  return "candidate";
}

function mapDbSource(attributionSource: string | null): WalletMatchSource {
  switch (attributionSource) {
    case "manual": return "manual";
    case "on_chain_footprint": return "on_chain_footprint";
    case "airdrop": return "airdrop";
    case "promotion_tx": return "promotion_tx";
    default: return "inferred";
  }
}

export async function resolveWalletToKol(
  address: string,
  chain: string
): Promise<WalletMatchResult> {
  const wallet = await prisma.kolWallet.findFirst({
    where: {
      address: { equals: address, mode: "insensitive" },
      chain: { equals: chain, mode: "insensitive" },
      status: "active",
    },
    select: {
      kolHandle: true,
      confidence: true,
      attributionSource: true,
      attributionStatus: true,
      label: true,
      sourceUrl: true,
    },
  });

  if (!wallet) {
    return {
      handle: null,
      confidence: "unresolved",
      source: "inferred",
      evidence: [],
      requiresHumanReview: true,
    };
  }

  const evidence: string[] = [];
  if (wallet.label) evidence.push(`label: ${wallet.label}`);
  if (wallet.sourceUrl) evidence.push(`source: ${wallet.sourceUrl}`);

  return {
    handle: wallet.kolHandle,
    confidence: "exact",
    source: "manual",
    evidence,
    requiresHumanReview: false,
  };
}

export async function resolveHandleToWallets(
  handle: string
): Promise<WalletAttributionRow[]> {
  const wallets = await prisma.kolWallet.findMany({
    where: {
      kolHandle: { equals: handle, mode: "insensitive" },
      status: "active",
    },
    select: {
      address: true,
      chain: true,
      label: true,
      confidence: true,
      attributionSource: true,
      attributionStatus: true,
      discoveredAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return wallets.map(w => ({
    address: w.address,
    chain: w.chain,
    label: w.label,
    confidence: mapDbConfidence(w.confidence, w.attributionStatus),
    source: mapDbSource(w.attributionSource),
    attributionStatus: w.attributionStatus,
    discoveredAt: w.discoveredAt,
  }));
}
