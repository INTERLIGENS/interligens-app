// ─── Fixture builders ─────────────────────────────────────────────────────
// Centralised builders used by both the fixture JSON files (committed) and
// tests that need to parametrise a dataset. Keeping them as TS helpers means
// the JSON stays minimal and the contracts stay checked.

import type {
  ClusterInput,
  ConcentrationInput,
  FundingTx,
  PostListingPumpInput,
  PriceAsymmetryInput,
  PriceMove,
  TokenActivity,
  WashTradeTx,
  WashTradingInput,
} from "@/lib/mm/engine/types";

let walletCounter = 0;
export function mkWallet(prefix: string): string {
  walletCounter += 1;
  return `${prefix}-${walletCounter.toString().padStart(4, "0")}`;
}
export function resetWallets() {
  walletCounter = 0;
}

export function mkTx(
  overrides: Partial<WashTradeTx> & { buyer: string; seller: string; block: number; timestamp: number },
): WashTradeTx {
  return {
    hash: overrides.hash ?? `tx-${overrides.block}-${Math.random().toString(36).slice(2, 8)}`,
    buyer: overrides.buyer,
    seller: overrides.seller,
    tokenId: overrides.tokenId ?? "TKN",
    volumeUsd: overrides.volumeUsd ?? 1_000,
    side: overrides.side ?? "BUY",
    block: overrides.block,
    timestamp: overrides.timestamp,
  };
}

export function retailClean(opts?: {
  wallets?: number;
  txsPerWallet?: number;
  tokenId?: string;
  baseBlock?: number;
  baseTs?: number;
}): WashTradingInput {
  const wallets = opts?.wallets ?? 60;
  const txsPer = opts?.txsPerWallet ?? 3;
  const tokenId = opts?.tokenId ?? "CLEAN";
  const baseBlock = opts?.baseBlock ?? 100_000;
  const baseTs = opts?.baseTs ?? 1_700_000_000;

  // Retail fixture models a single-sided accumulation phase: overwhelmingly
  // buys with a small (~10%) sell tail. This keeps buy/sell volumes
  // asymmetric so the MIRRORED detector does not fire.
  const txs: WashTradeTx[] = [];
  let idx = 0;
  for (let i = 0; i < wallets; i++) {
    const buyer = `retail-${i.toString().padStart(3, "0")}`;
    for (let j = 0; j < txsPer; j++) {
      // 1 in 11 transactions is a sell (~9%).
      const isSell = idx % 11 === 3;
      idx += 1;
      txs.push({
        hash: `tx-${i}-${j}`,
        buyer,
        seller: `lp-${(i + j) % 5}`,
        tokenId,
        volumeUsd: 200 + ((i * 17 + j * 7) % 400),
        side: isSell ? "SELL" : "BUY",
        block: baseBlock + i * 10 + j,
        timestamp: baseTs + i * 60 + j * 20,
      });
    }
  }
  return {
    tokenId,
    chain: "SOLANA",
    txs,
  };
}

/**
 * Small token where volume is dominated by 2 wallets doing A→B→A round trips
 * at very tight block intervals. Used for wash trading positive tests.
 */
export function washPattern(opts?: {
  tokenId?: string;
  baseBlock?: number;
  baseTs?: number;
  pairCount?: number;
  volumeUsd?: number;
}): WashTradingInput {
  const tokenId = opts?.tokenId ?? "WASH";
  const baseBlock = opts?.baseBlock ?? 10_000;
  const baseTs = opts?.baseTs ?? 1_700_000_000;
  const pairs = opts?.pairCount ?? 8;
  const vol = opts?.volumeUsd ?? 60_000;
  const A = "wash-A";
  const B = "wash-B";

  const txs: WashTradeTx[] = [];
  for (let i = 0; i < pairs; i++) {
    // Leg 1: A→B (A sells, B buys)
    txs.push({
      hash: `leg1-${i}`,
      buyer: B,
      seller: A,
      tokenId,
      volumeUsd: vol,
      side: "BUY",
      block: baseBlock + i * 20,
      timestamp: baseTs + i * 300,
    });
    // Leg 2: B→A (B sells, A buys) — within 10 blocks of leg 1
    txs.push({
      hash: `leg2-${i}`,
      buyer: A,
      seller: B,
      tokenId,
      volumeUsd: vol,
      side: "SELL",
      block: baseBlock + i * 20 + 5,
      timestamp: baseTs + i * 300 + 120,
    });
  }
  return { tokenId, chain: "SOLANA", txs };
}

/**
 * A funding graph with one root wallet that funded 8 descendants all within
 * ~30 minutes, then all descendants traded the same token.
 */
export function gotbitLikeCluster(opts?: {
  target?: string;
  descendantCount?: number;
  root?: string;
  baseTs?: number;
  sharedTokenId?: string;
  secondTokenId?: string;
}): ClusterInput {
  const root = opts?.root ?? "root-0001";
  const target = opts?.target ?? "wallet-0001";
  const n = opts?.descendantCount ?? 8;
  const baseTs = opts?.baseTs ?? 1_700_000_000;
  const token1 = opts?.sharedTokenId ?? "TGT";
  const token2 = opts?.secondTokenId ?? "ALT";

  const fundingEdges: FundingTx[] = [];
  const tokenActivity: TokenActivity[] = [];
  for (let i = 0; i < n; i++) {
    const w = i === 0 ? target : `wallet-${i.toString().padStart(4, "0")}`;
    fundingEdges.push({
      hash: `fund-${i}`,
      from: root,
      to: w,
      amountUsd: 1_000,
      block: 100_000 + i,
      timestamp: baseTs + i * 60, // all within 10 minutes
    });
    tokenActivity.push({
      wallet: w,
      tokenId: token1,
      firstSeen: baseTs + i * 60 + 60,
      lastSeen: baseTs + i * 60 + 3_600,
      totalVolumeUsd: 5_000,
      txCount: 10,
    });
    if (i % 2 === 0) {
      tokenActivity.push({
        wallet: w,
        tokenId: token2,
        firstSeen: baseTs + i * 60 + 120,
        lastSeen: baseTs + i * 60 + 7_200,
        totalVolumeUsd: 1_500,
        txCount: 3,
      });
    }
  }
  return {
    targetWallet: target,
    chain: "SOLANA",
    fundingEdges,
    tokenActivity,
    nowSeconds: baseTs + 4_000,
  };
}

/**
 * Concentration fixture: 20 wallets where the top 3 control ~80% of volume.
 */
export function concentratedToken(opts?: {
  wallets?: number;
  topDominance?: number; // 0-1
  tokenId?: string;
}): ConcentrationInput {
  const n = opts?.wallets ?? 20;
  const dominance = opts?.topDominance ?? 0.8;
  const tokenId = opts?.tokenId ?? "WHALE";
  const totalUsd = 1_000_000;
  const topThreeUsd = totalUsd * dominance;
  const tailUsd = totalUsd - topThreeUsd;

  // Top 3 concentrate most of the volume with a dust tail: pushes Gini close
  // to its theoretical maximum while keeping the HHI well above 2500.
  const volumes = [
    { wallet: "whale-1", volumeUsd: topThreeUsd * 0.5 },
    { wallet: "whale-2", volumeUsd: topThreeUsd * 0.3 },
    { wallet: "whale-3", volumeUsd: topThreeUsd * 0.2 },
  ];
  const tailCount = Math.max(1, n - 3);
  // Skewed tail (exponential) rather than flat — more realistic and yields
  // a higher Gini than an equal-share tail.
  let remaining = tailUsd;
  for (let i = 0; i < tailCount; i++) {
    const share = remaining * (i === tailCount - 1 ? 1 : 0.35);
    volumes.push({
      wallet: `tail-${i.toString().padStart(3, "0")}`,
      volumeUsd: Math.max(1, share),
    });
    remaining -= share;
  }
  return { tokenId, chain: "SOLANA", walletVolumes: volumes };
}

// ─── Price Asymmetry fixture builder ──────────────────────────────────────

export function asymmetricPriceToken(opts?: {
  tokenId?: string;
  days?: number;
  nowSeconds?: number;
  upDownRatio?: number; // desired up/down volume ratio, e.g. 5.0
}): PriceAsymmetryInput {
  const tokenId = opts?.tokenId ?? "ASYM";
  const days = opts?.days ?? 30;
  const now = opts?.nowSeconds ?? 1_700_000_000;
  const ratio = opts?.upDownRatio ?? 5.0;

  // Generate one price move per hour over `days` days. 70% positive, 10%
  // negative, 20% neutral. We set the volumes so that up_volume / down_volume
  // lands near `ratio`.
  const upUnitVol = 10_000;
  const downUnitVol = upUnitVol / ratio;
  const moves: PriceMove[] = [];
  const total = days * 24;
  for (let i = 0; i < total; i++) {
    const ts = now - (total - i) * 3_600;
    const r = (i * 1_103_515_245 + 12_345) % 100; // deterministic pseudo-rand
    if (r < 70) {
      moves.push({ timestamp: ts, priceChangePct: 1.5, volumeUsd: upUnitVol });
    } else if (r < 80) {
      moves.push({ timestamp: ts, priceChangePct: -1.8, volumeUsd: downUnitVol });
    } else {
      moves.push({ timestamp: ts, priceChangePct: 0.2, volumeUsd: upUnitVol / 4 });
    }
  }
  return {
    tokenId,
    chain: "SOLANA",
    moves,
    nowSeconds: now,
  };
}

// ─── Post-Listing Pump fixture builder ────────────────────────────────────

export function postListingPump(opts?: {
  tokenId?: string;
  performancePct?: number; // e.g. 1.5 for +150%
  topDominance?: number; // top 10 share
  wallets?: number;
  listingDate?: number;
}): PostListingPumpInput {
  const tokenId = opts?.tokenId ?? "PUMP";
  const pct = opts?.performancePct ?? 1.5;
  const dominance = opts?.topDominance ?? 0.8;
  const n = opts?.wallets ?? 40;
  const listingDate = opts?.listingDate ?? 1_700_000_000;
  const priceAtListing = 0.01;
  const priceAt7Days = priceAtListing * (1 + pct);
  const totalUsd = 1_000_000;
  const topUsd = totalUsd * dominance;
  const tailUsd = totalUsd - topUsd;

  const volumes = Array.from({ length: 10 }, (_, i) => ({
    wallet: `whale-${i + 1}`,
    volumeUsd: topUsd / 10,
  }));
  const tailCount = Math.max(1, n - 10);
  for (let i = 0; i < tailCount; i++) {
    volumes.push({
      wallet: `tail-${i}`,
      volumeUsd: tailUsd / tailCount,
    });
  }

  return {
    tokenId,
    chain: "SOLANA",
    listingDate,
    priceAtListing,
    priceAt7Days,
    volumeByWallet: volumes,
    totalVolumeUsd: totalUsd,
  };
}
