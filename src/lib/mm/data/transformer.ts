// ─── MM Tracker data layer — transformer ─────────────────────────────────
// Pure functions that map raw API payloads (Etherscan / Helius / Birdeye)
// into the typed detector inputs exposed by src/lib/mm/engine/types.ts.
//
// No I/O. No guesswork on what a "transaction" means — any data the upstream
// API does not provide is either derived defensively (e.g. treat unknown
// sender as the seller) or left out so the detector's own thresholds catch
// the edge case.

import type {
  ClusterInput,
  ConcentrationInput,
  FakeLiquidityInput,
  FundingTx,
  LiquidityProvider,
  PostListingPumpInput,
  PriceAsymmetryInput,
  PriceMove,
  TokenActivity,
  WalletVolume,
  WashTradeTx,
  WashTradingInput,
} from "../engine/types";
import type { MmChain } from "../types";
import type { EtherscanTokenTx, EtherscanTx } from "./etherscan";
import type { HeliusTx } from "./helius";
import type {
  BirdeyeHolder,
  BirdeyePricePoint,
  BirdeyeVolumeByWallet,
} from "./birdeye";

// ─── EVM transactions → WashTradingInput ─────────────────────────────────

export function toWashTradingInput(
  txs: Array<EtherscanTx | EtherscanTokenTx | HeliusTx>,
  walletAddress: string,
  context: {
    tokenId: string;
    chain: MmChain;
    defaultVolumeUsd?: number;
  },
): WashTradingInput {
  const lowerTarget = walletAddress.toLowerCase();
  const washTxs: WashTradeTx[] = [];

  for (const raw of txs) {
    const converted = toWashTradeTx(raw, lowerTarget, context.defaultVolumeUsd ?? 0);
    if (converted) washTxs.push(converted);
  }

  return {
    tokenId: context.tokenId,
    chain: context.chain,
    txs: washTxs,
  };
}

function toWashTradeTx(
  raw: EtherscanTx | EtherscanTokenTx | HeliusTx,
  walletAddressLc: string,
  defaultVolumeUsd: number,
): WashTradeTx | null {
  if (isHeliusTx(raw)) {
    const transfer = raw.tokenTransfers?.[0] ?? null;
    const native = raw.nativeTransfers?.[0] ?? null;
    const seller = (transfer?.fromUserAccount ?? native?.fromUserAccount ?? "").toLowerCase();
    const buyer = (transfer?.toUserAccount ?? native?.toUserAccount ?? "").toLowerCase();
    if (!seller || !buyer || seller === buyer) return null;
    const amount = transfer?.tokenAmount ?? native?.amount ?? 0;
    return {
      hash: raw.signature,
      buyer,
      seller,
      tokenId: transfer?.mint ?? "SOL",
      volumeUsd: amount > 0 ? amount : defaultVolumeUsd,
      side: buyer === walletAddressLc ? "BUY" : "SELL",
      block: raw.slot ?? 0,
      timestamp: raw.timestamp ?? 0,
    };
  }

  const e = raw as EtherscanTx | EtherscanTokenTx;
  const seller = (e.from ?? "").toLowerCase();
  const buyer = (e.to ?? "").toLowerCase();
  if (!seller || !buyer || seller === buyer) return null;
  const block = Number(e.blockNumber);
  const timestamp = Number(e.timeStamp);
  const valueWei = Number(e.value ?? "0");
  const hasTokenMeta = "tokenSymbol" in e;
  let volumeUsd = defaultVolumeUsd;
  if (hasTokenMeta) {
    const decimals = Number((e as EtherscanTokenTx).tokenDecimal ?? 18);
    const qty = valueWei / 10 ** decimals;
    if (qty > 0) volumeUsd = qty; // unitless; caller should multiply by price
  } else if (valueWei > 0) {
    volumeUsd = valueWei / 1e18;
  }
  return {
    hash: e.hash,
    buyer,
    seller,
    tokenId: hasTokenMeta
      ? ((e as EtherscanTokenTx).contractAddress ?? "erc20").toLowerCase()
      : "native",
    volumeUsd,
    side: buyer === walletAddressLc ? "BUY" : "SELL",
    block: Number.isFinite(block) ? block : 0,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
  };
}

function isHeliusTx(x: unknown): x is HeliusTx {
  return (
    typeof x === "object" &&
    x !== null &&
    "signature" in x &&
    ("tokenTransfers" in x || "nativeTransfers" in x || "slot" in x)
  );
}

// ─── EVM/Helius transactions → ClusterInput ──────────────────────────────

export function toClusterInput(
  fundingTxs: Array<EtherscanTx | HeliusTx>,
  context: {
    targetWallet: string;
    chain: MmChain;
    tokenActivity?: TokenActivity[];
  },
): ClusterInput {
  const edges: FundingTx[] = [];
  for (const raw of fundingTxs) {
    const edge = toFundingTx(raw);
    if (edge) edges.push(edge);
  }
  return {
    targetWallet: context.targetWallet,
    chain: context.chain,
    fundingEdges: edges,
    tokenActivity: context.tokenActivity ?? [],
  };
}

function toFundingTx(raw: EtherscanTx | HeliusTx): FundingTx | null {
  if (isHeliusTx(raw)) {
    const native = raw.nativeTransfers?.[0] ?? null;
    if (!native) return null;
    const from = (native.fromUserAccount ?? "").toLowerCase();
    const to = (native.toUserAccount ?? "").toLowerCase();
    if (!from || !to || from === to) return null;
    return {
      hash: raw.signature,
      from,
      to,
      amountUsd: native.amount ?? 0,
      block: raw.slot ?? 0,
      timestamp: raw.timestamp ?? 0,
    };
  }
  const e = raw as EtherscanTx;
  const from = (e.from ?? "").toLowerCase();
  const to = (e.to ?? "").toLowerCase();
  if (!from || !to || from === to) return null;
  const valueWei = Number(e.value ?? "0");
  return {
    hash: e.hash,
    from,
    to,
    amountUsd: valueWei / 1e18,
    block: Number(e.blockNumber) || 0,
    timestamp: Number(e.timeStamp) || 0,
  };
}

// ─── Birdeye volume-by-wallet → ConcentrationInput ───────────────────────

export function toConcentrationInput(
  volumes: BirdeyeVolumeByWallet[],
  context: { tokenId: string; chain: MmChain },
): ConcentrationInput {
  const walletVolumes: WalletVolume[] = volumes
    .map((v) => ({ wallet: v.wallet, volumeUsd: Math.max(0, v.volumeUsd) }))
    .filter((v) => v.wallet && v.volumeUsd > 0);
  return {
    tokenId: context.tokenId,
    chain: context.chain,
    walletVolumes,
  };
}

// ─── Birdeye holders + volume → FakeLiquidityInput (Phase 9) ─────────────

export function toFakeLiquidityInput(
  context: {
    tokenAddress: string;
    chain: MmChain;
    totalLiquidityUsd: number;
    dailyVolumeUsd: number;
    poolCount: number;
  },
  volumes: BirdeyeVolumeByWallet[],
  holders: BirdeyeHolder[],
): FakeLiquidityInput {
  const volumeByWallet: WalletVolume[] = volumes
    .map((v) => ({ wallet: v.wallet, volumeUsd: Math.max(0, v.volumeUsd) }))
    .filter((v) => v.wallet && v.volumeUsd > 0);

  // Birdeye's /defi/v3/token/holder returns top holders with `percentage` of
  // the circulating supply. To translate to USD liquidity contribution, we
  // allocate the reported `totalLiquidityUsd` proportionally. This is an
  // approximation — real LP attribution would need on-chain pool data — but
  // it's enough for the top-1 / top-3 share sub-signal in the detector.
  const total = Math.max(0, context.totalLiquidityUsd);
  const providers: LiquidityProvider[] = holders
    .filter((h) => h.wallet && h.percentage > 0)
    .map((h) => ({
      wallet: h.wallet,
      liquidityUsd: total * (h.percentage / 100),
    }));

  return {
    tokenAddress: context.tokenAddress.toLowerCase(),
    chain: context.chain,
    totalLiquidityUsd: context.totalLiquidityUsd,
    dailyVolumeUsd: context.dailyVolumeUsd,
    volumeByWallet,
    liquidityProviders: providers,
    poolCount: Math.max(0, context.poolCount),
  };
}

// ─── Birdeye price history → PriceAsymmetryInput ─────────────────────────

export function toPriceAsymmetryInput(
  points: BirdeyePricePoint[],
  context: { tokenId: string; chain: MmChain; nowSeconds?: number },
): PriceAsymmetryInput {
  const moves: PriceMove[] = [];
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].priceUsd;
    const cur = sorted[i];
    if (prev <= 0) continue;
    const pct = ((cur.priceUsd - prev) / prev) * 100;
    moves.push({
      timestamp: cur.timestamp,
      priceChangePct: pct,
      volumeUsd: Math.max(0, cur.volumeUsd),
    });
  }
  return {
    tokenId: context.tokenId,
    chain: context.chain,
    moves,
    nowSeconds: context.nowSeconds,
  };
}

// ─── Birdeye data → PostListingPumpInput ─────────────────────────────────

export function toPostListingPumpInput(
  priceHistory: BirdeyePricePoint[],
  volumes: BirdeyeVolumeByWallet[],
  context: {
    tokenId: string;
    chain: MmChain;
    listingDate: Date | number;
  },
): PostListingPumpInput {
  const listingTs =
    context.listingDate instanceof Date
      ? Math.floor(context.listingDate.getTime() / 1_000)
      : Math.floor(context.listingDate);
  const sorted = [...priceHistory].sort((a, b) => a.timestamp - b.timestamp);
  const at = (cutoff: number) => {
    let best = sorted[0];
    for (const p of sorted) {
      if (p.timestamp <= cutoff) best = p;
      else break;
    }
    return best;
  };
  const first = at(listingTs) ?? sorted[0] ?? { priceUsd: 0, timestamp: 0 };
  const seven = at(listingTs + 7 * 86_400) ??
    sorted[sorted.length - 1] ?? { priceUsd: 0, timestamp: 0 };

  const totalVolumeUsd = volumes.reduce(
    (s, v) => s + Math.max(0, v.volumeUsd),
    0,
  );
  return {
    tokenId: context.tokenId,
    chain: context.chain,
    listingDate: listingTs,
    priceAtListing: first.priceUsd,
    priceAt7Days: seven.priceUsd,
    volumeByWallet: volumes
      .map((v) => ({ wallet: v.wallet, volumeUsd: v.volumeUsd }))
      .filter((v) => v.wallet && v.volumeUsd > 0),
    totalVolumeUsd,
  };
}
