/**
 * ANTI-REGRESSION — TigerScore engine output (Commit 14/15 of REFLEX V1).
 *
 * Locks the deterministic output of `computeTigerScore(input)` for 20
 * fixtures (10 SOL, 10 EVM) covering the principal driver combinations.
 * If any future change to src/lib/tigerscore/engine.ts (or its imports)
 * shifts the score, tier, drivers, or confidence on any fixture, the
 * matching snapshot diff fails CI.
 *
 * Verified via `git diff main..HEAD -- src/lib/tigerscore` (empty at
 * Commit 14): REFLEX commits 1–7c did not touch the engine, so this
 * snapshot file IS the main-branch baseline.
 */
import { describe, it, expect } from "vitest";
import {
  computeTigerScore,
  type TigerInput,
} from "@/lib/tigerscore/engine";

interface Fixture {
  label: string;
  input: TigerInput;
}

const SOL_FIXTURES: Fixture[] = [
  {
    label: "SOL — benign top-cap (deep liquidity, old, no casefile)",
    input: {
      chain: "SOL", scan_type: "token", no_casefile: true,
      mint_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      market_url: "https://dex.example/usdc",
      pair_age_days: 1200, liquidity_usd: 50_000_000, fdv_usd: 50_000_000_000,
      volume_24h_usd: 200_000_000, scam_lineage: "NONE",
      confirmedCriticalClaims: 0,
    },
  },
  {
    label: "SOL — fresh pump-like (young pair, low liq, no casefile)",
    input: {
      chain: "SOL", scan_type: "token", no_casefile: true,
      mint_address: "PumpFunNewbie1111111111111111111111111111pump",
      market_url: "https://pump.fun/coin/x",
      pair_age_days: 1, liquidity_usd: 5_000, fdv_usd: 50_000,
      volume_24h_usd: 100_000, scam_lineage: "NONE",
      confirmedCriticalClaims: 0,
    },
  },
  {
    label: "SOL — casefile match + 2 confirmed critical claims",
    input: {
      chain: "SOL", scan_type: "token", no_casefile: false,
      mint_address: "CaseFileMint11111111111111111111111111111111",
      market_url: "https://dex.example/case",
      pair_age_days: 90, liquidity_usd: 50_000, fdv_usd: 1_000_000,
      volume_24h_usd: 50_000, scam_lineage: "CONFIRMED",
      confirmedCriticalClaims: 2,
    },
  },
  {
    label: "SOL — scam_lineage REFERENCED (no casefile, mid liq)",
    input: {
      chain: "SOL", scan_type: "token", no_casefile: true,
      pair_age_days: 30, liquidity_usd: 200_000, fdv_usd: 5_000_000,
      volume_24h_usd: 1_000_000, scam_lineage: "REFERENCED",
      confirmedCriticalClaims: 0,
    },
  },
  {
    label: "SOL — freeze + mint authority both active",
    input: {
      chain: "SOL", scan_type: "token", no_casefile: true,
      freezeAuthority: true, mintAuthorityActive: true,
      pair_age_days: 365, liquidity_usd: 100_000, fdv_usd: 2_000_000,
      volume_24h_usd: 50_000, scam_lineage: "NONE",
      confirmedCriticalClaims: 0,
    },
  },
  {
    label: "SOL — mutable metadata + freeze authority",
    input: {
      chain: "SOL", scan_type: "token", no_casefile: true,
      freezeAuthority: true, mutableMetadata: true,
      pair_age_days: 100, liquidity_usd: 500_000, fdv_usd: 10_000_000,
      volume_24h_usd: 200_000, scam_lineage: "NONE",
      confirmedCriticalClaims: 0,
    },
  },
  {
    label: "SOL — unknown programs interaction",
    input: {
      chain: "SOL", scan_type: "token", no_casefile: true,
      unknownPrograms: 3,
      pair_age_days: 200, liquidity_usd: 1_000_000, fdv_usd: 30_000_000,
      volume_24h_usd: 500_000, scam_lineage: "NONE",
      confirmedCriticalClaims: 0,
    },
  },
  {
    label: "SOL — top10 holder concentration 85%",
    input: {
      chain: "SOL", scan_type: "token", no_casefile: true,
      top10_holder_pct: 85,
      pair_age_days: 365, liquidity_usd: 1_000_000, fdv_usd: 20_000_000,
      volume_24h_usd: 500_000, scam_lineage: "NONE",
      confirmedCriticalClaims: 0,
    },
  },
  {
    label: "SOL — wallet scan (no casefile/market context)",
    input: {
      chain: "SOL", scan_type: "wallet",
      scam_lineage: "NONE", confirmedCriticalClaims: 0,
    },
  },
  {
    label: "SOL — full red flag stack (everything bad)",
    input: {
      chain: "SOL", scan_type: "token", no_casefile: false,
      freezeAuthority: true, mintAuthorityActive: true, mutableMetadata: true,
      unknownPrograms: 5, top10_holder_pct: 92,
      pair_age_days: 2, liquidity_usd: 1_000, fdv_usd: 100_000,
      volume_24h_usd: 50_000, scam_lineage: "CONFIRMED",
      confirmedCriticalClaims: 4,
    },
  },
];

const EVM_FIXTURES: Fixture[] = [
  {
    label: "EVM — clean EOA on ETH (no flags)",
    input: {
      chain: "ETH", evm_is_contract: false, evm_known_bad: false,
      evm_active_chains: ["ethereum"], txCount: 12,
    },
  },
  {
    label: "EVM — clean contract on Base",
    input: {
      chain: "BASE", evm_is_contract: true, evm_known_bad: false,
      evm_active_chains: ["base"], txCount: 1,
    },
  },
  {
    label: "EVM — known-bad address (high-confidence)",
    input: {
      chain: "ETH", evm_is_contract: false, evm_known_bad: true,
      evm_active_chains: ["ethereum", "base", "arbitrum"], txCount: 247,
    },
  },
  {
    label: "EVM — unlimited approval × 1",
    input: {
      chain: "ETH", evm_is_contract: false,
      unlimitedApprovals: 1, approvalsTotal: 3,
    },
  },
  {
    label: "EVM — high approvals (no unlimited)",
    input: {
      chain: "ETH", evm_is_contract: false,
      unlimitedApprovals: 0, approvalsTotal: 12,
    },
  },
  {
    label: "EVM — wallet active on 3 chains",
    input: {
      chain: "ETH", evm_is_contract: false,
      evm_active_chains: ["ethereum", "base", "arbitrum"],
      txCount: 80, evm_balance_eth: 1.5,
    },
  },
  {
    label: "EVM — watchlist hit",
    input: {
      chain: "ETH", evm_is_contract: false,
      evm_in_watchlist: true, txCount: 30,
    },
  },
  {
    label: "EVM — address-poisoning lookalike",
    input: {
      chain: "ETH", evm_is_contract: false,
      addressPoisoning: true,
    },
  },
  {
    label: "EVM — known-bad + unlimited approvals (worst case)",
    input: {
      chain: "ETH", evm_is_contract: false, evm_known_bad: true,
      unlimitedApprovals: 2, approvalsTotal: 8,
      addressPoisoning: true, txCount: 300,
    },
  },
  {
    label: "EVM — Arbitrum fresh contract",
    input: {
      chain: "ARBITRUM", evm_is_contract: true, evm_known_bad: false,
      evm_active_chains: ["arbitrum"], txCount: 5,
    },
  },
];

describe.each(SOL_FIXTURES)("TigerScore snapshot — $label", ({ input }) => {
  it("matches the locked output", () => {
    expect(computeTigerScore(input)).toMatchSnapshot();
  });
});

describe.each(EVM_FIXTURES)("TigerScore snapshot — $label", ({ input }) => {
  it("matches the locked output", () => {
    expect(computeTigerScore(input)).toMatchSnapshot();
  });
});
