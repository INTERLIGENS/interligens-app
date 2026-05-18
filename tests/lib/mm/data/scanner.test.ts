import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Prisma + data-layer mocks ───────────────────────────────────────────
// Mocks are intentionally typed as (...args: unknown[]) => unknown so they
// accept any shape of call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

const mmScoreUpsert = vi.fn<AnyFn>(async () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmScore: {
      upsert: (arg: unknown) => mmScoreUpsert(arg),
    },
  },
}));

const persistScanRun = vi.fn<AnyFn>(async () => ({ id: "run-persisted-1" }));
vi.mock("@/lib/mm/engine/scanRun/persist", () => ({
  persistScanRun: (result: unknown, opts: unknown) => persistScanRun(result, opts),
}));

const fetchWalletTransactions = vi.fn<AnyFn>();
const fetchTokenTransfers = vi.fn<AnyFn>();
vi.mock("@/lib/mm/data/etherscan", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mm/data/etherscan")>(
    "@/lib/mm/data/etherscan",
  );
  return {
    ...actual,
    fetchWalletTransactions: (address: unknown, chain: unknown, o: unknown, f: unknown) =>
      fetchWalletTransactions(address, chain, o, f),
    fetchTokenTransfers: (address: unknown, chain: unknown, tk: unknown, o: unknown, f: unknown) =>
      fetchTokenTransfers(address, chain, tk, o, f),
  };
});

const fetchSolanaTransactions = vi.fn<AnyFn>();
vi.mock("@/lib/mm/data/helius", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mm/data/helius")>(
    "@/lib/mm/data/helius",
  );
  return {
    ...actual,
    fetchSolanaTransactions: (address: unknown, o: unknown, f: unknown) =>
      fetchSolanaTransactions(address, o, f),
  };
});

const fetchTokenVolumeByWallet = vi.fn<AnyFn>();
const fetchTokenPriceHistory = vi.fn<AnyFn>();
vi.mock("@/lib/mm/data/birdeye", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mm/data/birdeye")>(
    "@/lib/mm/data/birdeye",
  );
  return {
    ...actual,
    fetchTokenVolumeByWallet: (address: unknown, chain: unknown, o: unknown, f: unknown) =>
      fetchTokenVolumeByWallet(address, chain, o, f),
    fetchTokenPriceHistory: (address: unknown, chain: unknown, o: unknown, f: unknown) =>
      fetchTokenPriceHistory(address, chain, o, f),
  };
});

import { scanToken, scanWallet } from "@/lib/mm/data/scanner";

beforeEach(() => {
  mmScoreUpsert.mockClear();
  persistScanRun.mockClear();
  fetchWalletTransactions.mockReset();
  fetchTokenTransfers.mockReset();
  fetchSolanaTransactions.mockReset();
  fetchTokenVolumeByWallet.mockReset();
  fetchTokenPriceHistory.mockReset();
});

describe("scanWallet (EVM)", () => {
  it("runs end-to-end and persists the scan run + cache", async () => {
    fetchWalletTransactions.mockResolvedValue([
      {
        hash: "h1",
        blockNumber: "100",
        timeStamp: "1700000000",
        from: "0xA",
        to: "0xWALLET",
        value: "1000000000000000000",
        gasPrice: "0",
        gasUsed: "0",
        isError: "0",
        input: "0x",
      },
    ]);
    fetchTokenTransfers.mockResolvedValue([]);

    const r = await scanWallet("0xWALLET", "ETHEREUM");
    expect(r.subjectId).toBe("0xWALLET");
    expect(r.subjectType).toBe("WALLET");
    expect(persistScanRun).toHaveBeenCalledTimes(1);
    expect(mmScoreUpsert).toHaveBeenCalledTimes(1);
  });

  it("logs upstream errors but still runs the engine (coverage degrades)", async () => {
    fetchWalletTransactions.mockRejectedValue(new Error("etherscan 429"));
    fetchTokenTransfers.mockRejectedValue(new Error("etherscan 500"));
    const r = await scanWallet("0xWALLET", "ETHEREUM");
    expect(r.coverage).toBe("low");
    // No crash — scanner completed and still persisted a (zero) scan run.
    expect(persistScanRun).toHaveBeenCalledTimes(1);
  });

  it("skips persistence when opts.persist=false", async () => {
    fetchWalletTransactions.mockResolvedValue([]);
    fetchTokenTransfers.mockResolvedValue([]);
    await scanWallet("0xWALLET", "ETHEREUM", { persist: false });
    expect(persistScanRun).not.toHaveBeenCalled();
    expect(mmScoreUpsert).not.toHaveBeenCalled();
  });
});

describe("scanWallet (SOLANA)", () => {
  it("uses the helius path for Solana", async () => {
    fetchSolanaTransactions.mockResolvedValue([
      {
        signature: "s1",
        slot: 99,
        timestamp: 1_700_000_000,
        type: "TRANSFER",
        source: "SYSTEM_PROGRAM",
        fee: 1_000,
        feePayer: "A",
        nativeTransfers: [
          { fromUserAccount: "X", toUserAccount: "Y", amount: 10 },
        ],
      },
    ]);
    const r = await scanWallet("Ysol", "SOLANA");
    expect(fetchWalletTransactions).not.toHaveBeenCalled();
    expect(fetchSolanaTransactions).toHaveBeenCalledTimes(1);
    expect(r.chain).toBe("SOLANA");
  });
});

describe("scanToken", () => {
  it("orchestrates birdeye volumes + price history", async () => {
    fetchTokenVolumeByWallet.mockResolvedValue([
      { wallet: "W1", volumeUsd: 10_000 },
      { wallet: "W2", volumeUsd: 5_000 },
    ]);
    fetchTokenPriceHistory.mockResolvedValue([
      { timestamp: 1_000, priceUsd: 1, volumeUsd: 10 },
      { timestamp: 2_000, priceUsd: 1.5, volumeUsd: 10 },
    ]);
    fetchTokenTransfers.mockResolvedValue([]);

    const r = await scanToken("0xTOKEN", "ETHEREUM");
    expect(r.subjectType).toBe("TOKEN");
    expect(fetchTokenVolumeByWallet).toHaveBeenCalledTimes(1);
    expect(fetchTokenPriceHistory).toHaveBeenCalledTimes(1);
  });

  it("skips Birdeye entirely when opts.skipBirdeye is true", async () => {
    fetchTokenVolumeByWallet.mockResolvedValue([]);
    fetchTokenPriceHistory.mockResolvedValue([]);
    await scanToken("0xTOKEN", "ETHEREUM", { skipBirdeye: true });
    expect(fetchTokenVolumeByWallet).not.toHaveBeenCalled();
    expect(fetchTokenPriceHistory).not.toHaveBeenCalled();
  });

  it("survives a birdeye outage with coverage=low", async () => {
    fetchTokenVolumeByWallet.mockRejectedValue(new Error("birdeye 500"));
    fetchTokenPriceHistory.mockRejectedValue(new Error("birdeye 500"));
    const r = await scanToken("0xTOKEN", "ETHEREUM");
    expect(r.coverage).toBe("low");
  });
});
