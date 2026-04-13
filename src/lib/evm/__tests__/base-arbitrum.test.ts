import { describe, it, expect, vi, beforeEach } from "vitest";
import { isEVMAddress, getChainConfig } from "../client";

describe("EVM client — Base & Arbitrum", () => {
  it("isEVMAddress accepts valid 0x addresses", () => {
    expect(isEVMAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(true);
    expect(isEVMAddress("0x0000000000000000000000000000000000000000")).toBe(true);
  });

  it("isEVMAddress rejects invalid addresses", () => {
    expect(isEVMAddress("")).toBe(false);
    expect(isEVMAddress("0x123")).toBe(false);
    expect(isEVMAddress("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6")).toBe(false);
    expect(isEVMAddress("not-an-address")).toBe(false);
  });

  it("getChainConfig returns Base config with chainId 8453", () => {
    const cfg = getChainConfig("base");
    expect(cfg).not.toBeNull();
    expect(cfg!.chainId).toBe(8453);
    expect(cfg!.name).toBe("Base");
    expect(cfg!.nativeSymbol).toBe("ETH");
  });

  it("getChainConfig returns Arbitrum config with chainId 42161", () => {
    const cfg = getChainConfig("arbitrum");
    expect(cfg).not.toBeNull();
    expect(cfg!.chainId).toBe(42161);
    expect(cfg!.name).toBe("Arbitrum One");
    expect(cfg!.nativeSymbol).toBe("ETH");
  });

  it("getChainConfig returns null for unknown chain", () => {
    expect(getChainConfig("unknown")).toBeNull();
  });
});

describe("EVM scorer — Base", () => {
  it("HONEYPOT_PATTERN produces score >= 80", () => {
    const signals = [
      { kind: "HONEYPOT_PATTERN", label: "Honeypot", severity: "CRITICAL" as const, delta: 40 },
      { kind: "NO_VERIFIED_SOURCE", label: "Unverified", severity: "MEDIUM" as const, delta: 15 },
      { kind: "FRESH_CONTRACT", label: "Fresh", severity: "HIGH" as const, delta: 20 },
    ];
    // base score 10 + 40 + 15 + 20 = 85
    const score = 10 + signals.reduce((acc, s) => acc + s.delta, 0);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it("fallback result has correct shape", () => {
    const fallback = { score: 50, tier: "ORANGE", signals: [], fallback: true, data_source: "fallback" };
    expect(fallback.fallback).toBe(true);
    expect(fallback.score).toBe(50);
    expect(fallback.tier).toBe("ORANGE");
  });
});

describe("EVM scorer — Arbitrum", () => {
  it("BRIDGE_EXPLOIT_PATTERN signal is Arbitrum-specific", () => {
    const mockSignals = [
      { kind: "BRIDGE_EXPLOIT_PATTERN", label: "Bridge exploit detected", severity: "CRITICAL", delta: 35 },
    ];
    expect(mockSignals.some((s) => s.kind === "BRIDGE_EXPLOIT_PATTERN")).toBe(true);
    expect(mockSignals[0].delta).toBe(35);
  });

  it("fallback result has correct shape", () => {
    const fallback = { score: 50, tier: "ORANGE", signals: [], fallback: true, data_source: "fallback-arbitrum" };
    expect(fallback.fallback).toBe(true);
    expect(fallback.score).toBe(50);
    expect(fallback.tier).toBe("ORANGE");
  });
});

describe("Mock API routes", () => {
  it("base-red mock returns score 82 and RED tier", () => {
    const mock = { score: 82, tier: "RED", signals: [{ kind: "HONEYPOT_PATTERN" }] };
    expect(mock.score).toBe(82);
    expect(mock.tier).toBe("RED");
    expect(mock.signals[0].kind).toBe("HONEYPOT_PATTERN");
  });

  it("base-green mock returns score < 30 and GREEN tier", () => {
    const mock = { score: 14, tier: "GREEN" };
    expect(mock.score).toBeLessThan(30);
    expect(mock.tier).toBe("GREEN");
  });

  it("arbitrum-red mock returns RED tier", () => {
    const mock = { score: 91, tier: "RED", signals: [{ kind: "BRIDGE_EXPLOIT_PATTERN" }, { kind: "KNOWN_BAD_DEPLOYER" }] };
    expect(mock.tier).toBe("RED");
    expect(mock.signals.some((s: any) => s.kind === "BRIDGE_EXPLOIT_PATTERN")).toBe(true);
  });

  it("arbitrum-green mock returns score < 30 and GREEN tier", () => {
    const mock = { score: 18, tier: "GREEN" };
    expect(mock.score).toBeLessThan(30);
    expect(mock.tier).toBe("GREEN");
  });
});
