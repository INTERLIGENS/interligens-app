import { describe, it, expect } from "vitest";
import { computeTigerScoreFromScan, type ScanNormalized } from "./adapter";
import { computeTigerScore } from "./engine";
import green from "./__fixtures__/green.json";
import orange from "./__fixtures__/orange.json";
import red from "./__fixtures__/red.json";

describe("computeTigerScoreFromScan", () => {
  it("GREEN fixture => verdict GREEN, score 0-30, no CRITICAL driver", () => {
    const r = computeTigerScoreFromScan(green as ScanNormalized);
    expect(r.tier).toBe("GREEN");
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(30);
    expect(r.drivers.some(d => d.severity === "critical")).toBe(false);
    expect(r.meta.version).toBe("p1");
  });

  it("ORANGE fixture => verdict ORANGE, score 31-69, at least 1 MED/HIGH driver", () => {
    const r = computeTigerScoreFromScan(orange as ScanNormalized);
    expect(r.tier).toBe("ORANGE");
    expect(r.score).toBeGreaterThan(30);
    expect(r.score).toBeLessThan(70);
    expect(r.drivers.some(d => d.severity === "med" || d.severity === "high")).toBe(true);
  });

  it("RED fixture => verdict RED, score 70-100, CRITICAL driver present", () => {
    const r = computeTigerScoreFromScan(red as ScanNormalized);
    expect(r.tier).toBe("RED");
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.drivers.some(d => d.severity === "critical")).toBe(true);
  });

  it("RED fixture => known_bad evidence before provider in top 3", () => {
    const r = computeTigerScoreFromScan(red as ScanNormalized);
    expect(r.evidence.length).toBeLessThanOrEqual(3);
    const knownBadIdx = r.evidence.findIndex(e => e.id.startsWith("known_bad"));
    const providerIdx = r.evidence.findIndex(e => e.id === "provider");
    if (knownBadIdx >= 0 && providerIdx >= 0) {
      expect(knownBadIdx).toBeLessThan(providerIdx);
    }
  });

  it("Invariant: rpc_down=true => evidence includes RPC_SOURCE with FALLBACK badge", () => {
    const input: ScanNormalized = {
      chain: "ETH",
      rpc_down: true,
      rpc_error: "All endpoints failed",
      signals: {},
    };
    const r = computeTigerScoreFromScan(input);
    expect(r.evidence.length).toBeLessThanOrEqual(3);
    const rpcItem = r.evidence.find(e => e.id === "rpc_down");
    expect(rpcItem).toBeTruthy();
    expect(rpcItem?.badge).toBe("FALLBACK");
  });

  it("Invariant: rpc_fallback_used=true => FALLBACK guaranteed in top 3 even with 3 spenders", () => {
    const input: ScanNormalized = {
      chain: "SOL",
      data_source: "rpc_fallback",
      source_detail: "https://rpc.ankr.com/solana",
      rpc_fallback_used: true,
      signals: {
        spenders: [
          "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
          "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
          "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
        ],
      },
    };
    const r = computeTigerScoreFromScan(input);
    expect(r.evidence.length).toBeLessThanOrEqual(3);
    expect(r.evidence.some(e => e.badge === "FALLBACK")).toBe(true);
  });

  it("Invariant: score always in 0-100", () => {
    const extreme: ScanNormalized = {
      chain: "ETH",
      signals: {
        unlimitedApprovals: 99,
        confirmedCriticalClaims: 99,
        knownBadAddresses: 99,
        freezeAuthority: true,
        mintAuthorityActive: true,
        txCount: 0,
        unknownPrograms: 99,
      },
    };
    const r = computeTigerScoreFromScan(extreme);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("computeTigerScore — market boosters SOL token", () => {
  it("1) addr endswith pump + no_casefile => score >=25 + driver pump_fun", () => {
    const r = computeTigerScore({
      chain: "SOL",
      scan_type: "token",
      no_casefile: true,
      mint_address: "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump",
    });
    expect(r.score).toBeGreaterThanOrEqual(30);
    expect(r.drivers.some(d => d.id === "pump_fun")).toBe(true);
  });

  it("2) pair_age_days=1 => driver fresh_pool present", () => {
    const r = computeTigerScore({
      chain: "SOL",
      scan_type: "token",
      no_casefile: true,
      mint_address: "SomeMint",
      pair_age_days: 1,
    });
    expect(r.drivers.some(d => d.id === "fresh_pool")).toBe(true);
  });

  it("3) fdv/liquidity ratio=100 => driver fdv_liquidity_ratio present", () => {
    const r = computeTigerScore({
      chain: "SOL",
      scan_type: "token",
      no_casefile: true,
      mint_address: "SomeMint",
      fdv_usd: 10_000_000,
      liquidity_usd: 100_000,
    });
    expect(r.drivers.some(d => d.id === "fdv_liquidity_ratio")).toBe(true);
  });

  it("4) tous les boosters combinés => cap à +50", () => {
    const r = computeTigerScore({
      chain: "SOL",
      scan_type: "token",
      no_casefile: true,
      mint_address: "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump",
      pair_age_days: 1,
      fdv_usd: 50_000_000,
      liquidity_usd: 100_000,
      volume_24h_usd: 2_000_000,
    });
    // Boosters raw = 30+20+20+15 = 85 mais cap à 50
    // Score = 0 base + 50 cap
    expect(r.score).toBeLessThanOrEqual(50);
    expect(r.drivers.length).toBeGreaterThanOrEqual(3);
  });
});
