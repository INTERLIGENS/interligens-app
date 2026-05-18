import { describe, it, expect } from "vitest";
import {
  toClusterInput,
  toConcentrationInput,
  toPostListingPumpInput,
  toPriceAsymmetryInput,
  toWashTradingInput,
} from "@/lib/mm/data/transformer";
import type { EtherscanTokenTx, EtherscanTx } from "@/lib/mm/data/etherscan";
import type { HeliusTx } from "@/lib/mm/data/helius";
import type {
  BirdeyePricePoint,
  BirdeyeVolumeByWallet,
} from "@/lib/mm/data/birdeye";

const TARGET = "0xWALLET";
const TARGET_LC = TARGET.toLowerCase();

function mkEvmTx(
  from: string,
  to: string,
  blockNumber: number,
  timeStamp: number,
  hash = `tx-${blockNumber}`,
  value = "1000000000000000000",
): EtherscanTx {
  return {
    hash,
    blockNumber: String(blockNumber),
    timeStamp: String(timeStamp),
    from,
    to,
    value,
    gasPrice: "0",
    gasUsed: "0",
    isError: "0",
    input: "0x",
  };
}

function mkTokenTx(
  from: string,
  to: string,
  blockNumber: number,
  timeStamp: number,
  value = "1000000000000000000",
): EtherscanTokenTx {
  return {
    ...mkEvmTx(from, to, blockNumber, timeStamp, `token-${blockNumber}`, value),
    tokenName: "Example",
    tokenSymbol: "EX",
    tokenDecimal: "18",
    contractAddress: "0xTOKEN",
  };
}

// ─── WashTradingInput ────────────────────────────────────────────────────

describe("toWashTradingInput", () => {
  it("classifies BUY when the target wallet is the recipient", () => {
    const input = toWashTradingInput(
      [mkEvmTx("0xOther", TARGET, 100, 1_700_000_000)],
      TARGET,
      { tokenId: "ETH:wallet", chain: "ETHEREUM" },
    );
    expect(input.txs).toHaveLength(1);
    expect(input.txs[0].side).toBe("BUY");
    expect(input.txs[0].buyer).toBe(TARGET_LC);
  });

  it("classifies SELL when the target wallet is the sender", () => {
    const input = toWashTradingInput(
      [mkEvmTx(TARGET, "0xOther", 100, 1_700_000_000)],
      TARGET,
      { tokenId: "ETH:wallet", chain: "ETHEREUM" },
    );
    expect(input.txs[0].side).toBe("SELL");
  });

  it("drops self-transfers where from == to", () => {
    const input = toWashTradingInput(
      [mkEvmTx(TARGET, TARGET, 100, 1_700_000_000)],
      TARGET,
      { tokenId: "ETH:wallet", chain: "ETHEREUM" },
    );
    expect(input.txs).toHaveLength(0);
  });

  it("uses token transfer volume when tokenDecimal is present", () => {
    const input = toWashTradingInput(
      [mkTokenTx("0xA", TARGET, 100, 1_700_000_000, "5000000000000000000")],
      TARGET,
      { tokenId: "ETH:wallet", chain: "ETHEREUM" },
    );
    expect(input.txs[0].volumeUsd).toBeCloseTo(5, 5); // 5 tokens (unitless)
    expect(input.txs[0].tokenId).toBe("0xtoken");
  });

  it("handles Helius tx shape with token transfers", () => {
    const helius: HeliusTx = {
      signature: "sig-1",
      slot: 100,
      timestamp: 1_700_000_000,
      type: "TRANSFER",
      source: "SYSTEM_PROGRAM",
      fee: 1_000,
      feePayer: "A",
      tokenTransfers: [
        {
          fromUserAccount: "aaa",
          toUserAccount: TARGET_LC,
          mint: "MINT",
          tokenAmount: 42,
        },
      ],
    };
    const input = toWashTradingInput([helius], TARGET_LC, {
      tokenId: "MINT",
      chain: "SOLANA",
    });
    expect(input.txs).toHaveLength(1);
    expect(input.txs[0].side).toBe("BUY");
    expect(input.txs[0].volumeUsd).toBe(42);
    expect(input.txs[0].tokenId).toBe("MINT");
  });

  it("returns an empty tx list when input array is empty", () => {
    const input = toWashTradingInput([], TARGET, {
      tokenId: "x",
      chain: "ETHEREUM",
    });
    expect(input.txs).toEqual([]);
  });
});

// ─── ClusterInput ────────────────────────────────────────────────────────

describe("toClusterInput", () => {
  it("maps EVM tx objects to FundingTx edges", () => {
    const cluster = toClusterInput(
      [
        mkEvmTx("0xRoot", "0xChild1", 100, 1_700_000_000, "e1", "1000000000000000000"),
        mkEvmTx("0xRoot", "0xChild2", 101, 1_700_000_060, "e2", "2000000000000000000"),
      ],
      { targetWallet: "0xchild1", chain: "ETHEREUM" },
    );
    expect(cluster.fundingEdges).toHaveLength(2);
    expect(cluster.fundingEdges[0].from).toBe("0xroot");
    expect(cluster.fundingEdges[0].to).toBe("0xchild1");
    expect(cluster.fundingEdges[1].amountUsd).toBeCloseTo(2, 5);
  });

  it("maps Helius native transfers to FundingTx", () => {
    const cluster = toClusterInput(
      [
        {
          signature: "s",
          slot: 99,
          timestamp: 1_700_000_000,
          type: "TRANSFER",
          source: "SYSTEM_PROGRAM",
          fee: 0,
          feePayer: "A",
          nativeTransfers: [
            { fromUserAccount: "X", toUserAccount: "Y", amount: 10 },
          ],
        },
      ],
      { targetWallet: "y", chain: "SOLANA" },
    );
    expect(cluster.fundingEdges).toHaveLength(1);
    expect(cluster.fundingEdges[0].from).toBe("x");
    expect(cluster.fundingEdges[0].to).toBe("y");
  });

  it("passes through tokenActivity when provided", () => {
    const cluster = toClusterInput([], {
      targetWallet: "0xa",
      chain: "ETHEREUM",
      tokenActivity: [
        { wallet: "0xa", tokenId: "t", firstSeen: 0, lastSeen: 1, totalVolumeUsd: 1, txCount: 1 },
      ],
    });
    expect(cluster.tokenActivity).toHaveLength(1);
  });
});

// ─── ConcentrationInput ──────────────────────────────────────────────────

describe("toConcentrationInput", () => {
  it("keeps positive-volume wallets only", () => {
    const vols: BirdeyeVolumeByWallet[] = [
      { wallet: "A", volumeUsd: 100 },
      { wallet: "B", volumeUsd: 0 },
      { wallet: "", volumeUsd: 999 },
      { wallet: "C", volumeUsd: -5 }, // negative → filtered
    ];
    const c = toConcentrationInput(vols, { tokenId: "x", chain: "SOLANA" });
    expect(c.walletVolumes.map((v) => v.wallet)).toEqual(["A"]);
  });

  it("returns an empty array when input is empty", () => {
    const c = toConcentrationInput([], { tokenId: "x", chain: "ETHEREUM" });
    expect(c.walletVolumes).toEqual([]);
  });
});

// ─── PriceAsymmetryInput ────────────────────────────────────────────────

describe("toPriceAsymmetryInput", () => {
  it("derives price moves from consecutive price points", () => {
    const pts: BirdeyePricePoint[] = [
      { timestamp: 1_000, priceUsd: 1, volumeUsd: 100 },
      { timestamp: 2_000, priceUsd: 1.1, volumeUsd: 100 }, // +10%
      { timestamp: 3_000, priceUsd: 1.0, volumeUsd: 100 }, // -9.09%
    ];
    const p = toPriceAsymmetryInput(pts, {
      tokenId: "t",
      chain: "ETHEREUM",
      nowSeconds: 3_000,
    });
    expect(p.moves).toHaveLength(2);
    expect(p.moves[0].priceChangePct).toBeCloseTo(10, 1);
    expect(p.moves[1].priceChangePct).toBeCloseTo(-9.09, 1);
  });

  it("skips divide-by-zero when previous price is 0", () => {
    const p = toPriceAsymmetryInput(
      [
        { timestamp: 1_000, priceUsd: 0, volumeUsd: 10 },
        { timestamp: 2_000, priceUsd: 1, volumeUsd: 10 },
      ],
      { tokenId: "t", chain: "ETHEREUM" },
    );
    expect(p.moves).toEqual([]);
  });
});

// ─── PostListingPumpInput ───────────────────────────────────────────────

describe("toPostListingPumpInput", () => {
  it("picks the latest price at or before listing + 7 days", () => {
    const start = 1_700_000_000;
    const pts: BirdeyePricePoint[] = [
      { timestamp: start, priceUsd: 1, volumeUsd: 10 },
      { timestamp: start + 86_400, priceUsd: 2, volumeUsd: 10 },
      { timestamp: start + 7 * 86_400, priceUsd: 3, volumeUsd: 10 },
      { timestamp: start + 8 * 86_400, priceUsd: 5, volumeUsd: 10 }, // outside window
    ];
    const vols: BirdeyeVolumeByWallet[] = [{ wallet: "W", volumeUsd: 100 }];
    const out = toPostListingPumpInput(pts, vols, {
      tokenId: "t",
      chain: "ETHEREUM",
      listingDate: start,
    });
    expect(out.priceAtListing).toBe(1);
    expect(out.priceAt7Days).toBe(3);
    expect(out.totalVolumeUsd).toBe(100);
    expect(out.volumeByWallet).toHaveLength(1);
  });
});
