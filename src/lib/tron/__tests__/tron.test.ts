import { describe, it, expect, vi } from "vitest";
import { isTronAddress } from "../rpc";
import { computeTronWalletScore, computeTronTokenScore } from "../scorer";

// ── isTronAddress ────────────────────────────────────────────────────────────

describe("isTronAddress", () => {
  it("accepts valid TRON address (T + 33 base58 chars)", () => {
    expect(isTronAddress("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6")).toBe(true);
    expect(isTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(true);
  });

  it("rejects ETH address", () => {
    expect(isTronAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(false);
  });

  it("rejects SOL address", () => {
    expect(isTronAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isTronAddress("")).toBe(false);
  });

  it("rejects address not starting with T", () => {
    expect(isTronAddress("AN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6")).toBe(false);
  });

  it("rejects address with invalid length", () => {
    expect(isTronAddress("TN3W4H6rK")).toBe(false);
    expect(isTronAddress("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6x")).toBe(false);
  });
});

// ── Scorer tests (with mocked RPC) ──────────────────────────────────────────

vi.mock("../rpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../rpc")>();
  return {
    ...actual,
    // Keep isTronAddress real, mock the network calls
    getTronAccount: vi.fn(),
    getTronTransactions: vi.fn(),
    getTRC20TokenInfo: vi.fn(),
    isUSDTBlacklisted: vi.fn(),
  };
});

import { getTronAccount, getTronTransactions, getTRC20TokenInfo, isUSDTBlacklisted } from "../rpc";

const mockGetTronAccount = vi.mocked(getTronAccount);
const mockGetTronTransactions = vi.mocked(getTronTransactions);
const mockGetTRC20TokenInfo = vi.mocked(getTRC20TokenInfo);
const mockIsUSDTBlacklisted = vi.mocked(isUSDTBlacklisted);

describe("computeTronWalletScore", () => {
  it("returns fallback for invalid address", async () => {
    const result = await computeTronWalletScore("not-a-tron-address");
    expect(result.fallback).toBe(true);
    expect(result.score).toBe(50);
    expect(result.tier).toBe("ORANGE");
  });

  it("returns fallback when TronGrid is down (null account)", async () => {
    mockGetTronAccount.mockResolvedValue(null);
    const result = await computeTronWalletScore("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6");
    expect(result.fallback).toBe(true);
    expect(result.data_source).toBe("fallback");
  });

  it("USDT_BLACKLISTED signal gives score >= 40", async () => {
    mockGetTronAccount.mockResolvedValue({
      address: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6",
      balance: 1000000,
      balanceTrx: 1,
      createTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      isFrozen: false,
      trc20Tokens: [],
    });
    mockIsUSDTBlacklisted.mockResolvedValue(true);
    mockGetTronTransactions.mockResolvedValue([
      { txId: "abc", timestamp: Date.now(), from: "T1", to: "T2", amount: 100, type: "Transfer" },
    ]);

    const result = await computeTronWalletScore("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6");
    expect(result.usdtBlacklisted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.signals.some((s) => s.kind === "USDT_BLACKLISTED")).toBe(true);
  });

  it("FROZEN_ACCOUNT signal is detected", async () => {
    mockGetTronAccount.mockResolvedValue({
      address: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6",
      balance: 0,
      balanceTrx: 0,
      createTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      isFrozen: true,
      trc20Tokens: [],
    });
    mockIsUSDTBlacklisted.mockResolvedValue(false);
    mockGetTronTransactions.mockResolvedValue([
      { txId: "abc", timestamp: Date.now(), from: "T1", to: "T2", amount: 100, type: "Transfer" },
    ]);

    const result = await computeTronWalletScore("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6");
    expect(result.isFrozen).toBe(true);
    expect(result.signals.some((s) => s.kind === "FROZEN_ACCOUNT")).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(35);
  });

  it("FRESH account (< 7 days) detected", async () => {
    mockGetTronAccount.mockResolvedValue({
      address: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6",
      balance: 1000000,
      balanceTrx: 1,
      createTime: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days old
      isFrozen: false,
      trc20Tokens: [],
    });
    mockIsUSDTBlacklisted.mockResolvedValue(false);
    mockGetTronTransactions.mockResolvedValue([
      { txId: "abc", timestamp: Date.now(), from: "T1", to: "T2", amount: 100, type: "Transfer" },
    ]);

    const result = await computeTronWalletScore("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6");
    expect(result.signals.some((s) => s.kind === "FRESH_CONTRACT")).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(20);
  });
});

describe("computeTronTokenScore", () => {
  it("returns fallback for invalid address", async () => {
    const result = await computeTronTokenScore("invalid");
    expect(result.fallback).toBe(true);
  });

  it("returns fallback when token info unavailable", async () => {
    mockGetTRC20TokenInfo.mockResolvedValue(null);
    mockIsUSDTBlacklisted.mockResolvedValue(false);
    mockGetTronTransactions.mockResolvedValue([]);

    const result = await computeTronTokenScore("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
    expect(result.fallback).toBe(true);
  });

  it("USDT blacklisted token scores >= 40", async () => {
    mockGetTRC20TokenInfo.mockResolvedValue({
      contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      name: "Scam Token",
      symbol: "SCAM",
      decimals: 6,
      totalSupply: 1000000,
      issuerAddress: "TScamIssuer11111111111111111111111",
      isBlacklisted: false,
    });
    mockIsUSDTBlacklisted.mockResolvedValue(true);
    mockGetTronTransactions.mockResolvedValue([
      { txId: "tx1", timestamp: Date.now(), from: "T1", to: "T2", amount: 1, type: "TriggerSmartContract" },
    ]);

    const result = await computeTronTokenScore("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
    expect(result.usdtBlacklisted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(40);
  });

  it("FRESH_CONTRACT detected for tokens < 7 days old", async () => {
    mockGetTRC20TokenInfo.mockResolvedValue({
      contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      name: "Fresh Token",
      symbol: "FRESH",
      decimals: 18,
      totalSupply: 1000000000,
      issuerAddress: "TFreshIssuer111111111111111111111111",
      isBlacklisted: false,
    });
    mockIsUSDTBlacklisted.mockResolvedValue(false);
    mockGetTronTransactions.mockResolvedValue([
      { txId: "tx1", timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, from: "T1", to: "T2", amount: 1, type: "TriggerSmartContract" },
    ]);

    const result = await computeTronTokenScore("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
    expect(result.signals.some((s) => s.kind === "FRESH_CONTRACT")).toBe(true);
  });
});
