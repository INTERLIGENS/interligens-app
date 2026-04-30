import { describe, it, expect } from "vitest";
import { getAdapter, listAdapters } from "../registry";
import { RabbyAdapter } from "../rabby";
import { CoinbaseAdapter } from "../coinbase";
import { TrustWalletAdapter } from "../trustwallet";

describe("getAdapter", () => {
  it("returns RabbyAdapter for 'rabby'", () => {
    const adapter = getAdapter("rabby");
    expect(adapter).toBeInstanceOf(RabbyAdapter);
  });

  it("returns CoinbaseAdapter for 'coinbase'", () => {
    const adapter = getAdapter("coinbase");
    expect(adapter).toBeInstanceOf(CoinbaseAdapter);
  });

  it("returns TrustWalletAdapter for 'trustwallet'", () => {
    const adapter = getAdapter("trustwallet");
    expect(adapter).toBeInstanceOf(TrustWalletAdapter);
  });

  it("returns null for unknown wallet", () => {
    expect(getAdapter("metamask")).toBeNull();
    expect(getAdapter("phantom")).toBeNull();
    expect(getAdapter("")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(getAdapter("RABBY")).toBeInstanceOf(RabbyAdapter);
    expect(getAdapter("Coinbase")).toBeInstanceOf(CoinbaseAdapter);
    expect(getAdapter("TrustWallet")).toBeInstanceOf(TrustWalletAdapter);
  });

  it("each call returns a new instance", () => {
    const a = getAdapter("rabby");
    const b = getAdapter("rabby");
    expect(a).not.toBe(b);
  });
});

describe("listAdapters", () => {
  it("lists all registered adapters", () => {
    const list = listAdapters();
    expect(list).toContain("rabby");
    expect(list).toContain("coinbase");
    expect(list).toContain("trustwallet");
  });

  it("returns at least 3 adapters", () => {
    expect(listAdapters().length).toBeGreaterThanOrEqual(3);
  });
});

describe("WalletAdapter interface", () => {
  it("RabbyAdapter has correct supported chains", () => {
    const adapter = getAdapter("rabby")!;
    expect(adapter.supportedChains).toContain("ethereum");
    expect(adapter.supportedChains).not.toContain("solana");
    expect(adapter.supportedChains).not.toContain("tron");
  });

  it("TrustWalletAdapter supports all chains including tron", () => {
    const adapter = getAdapter("trustwallet")!;
    expect(adapter.supportedChains).toContain("tron");
    expect(adapter.supportedChains).toContain("solana");
  });

  it("CoinbaseAdapter supports solana", () => {
    const adapter = getAdapter("coinbase")!;
    expect(adapter.supportedChains).toContain("solana");
  });

  it("deeplink returns string for valid address", () => {
    const address = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    expect(typeof getAdapter("rabby")!.deeplink(address)).toBe("string");
    expect(typeof getAdapter("coinbase")!.deeplink(address)).toBe("string");
    expect(typeof getAdapter("trustwallet")!.deeplink(address)).toBe("string");
  });

  it("deeplink returns null for empty address", () => {
    expect(getAdapter("rabby")!.deeplink("")).toBeNull();
    expect(getAdapter("coinbase")!.deeplink("")).toBeNull();
    expect(getAdapter("trustwallet")!.deeplink("")).toBeNull();
  });

  it("connect throws not-implemented", async () => {
    const adapter = getAdapter("rabby")!;
    await expect(adapter.connect()).rejects.toThrow();
  });

  it("isInstalled returns false in node env (no window)", () => {
    expect(getAdapter("rabby")!.isInstalled()).toBe(false);
    expect(getAdapter("coinbase")!.isInstalled()).toBe(false);
    expect(getAdapter("trustwallet")!.isInstalled()).toBe(false);
  });
});
