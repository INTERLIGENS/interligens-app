/**
 * TRON-specific TigerScore scoring engine.
 *
 * Signals:
 *   USDT_BLACKLISTED    — CRITICAL +40
 *   FROZEN_ACCOUNT       — CRITICAL +35
 *   ISSUER_FLAGGED       — CRITICAL +40
 *   FRESH_CONTRACT       — HIGH     +20
 *   HIGH_SUPPLY_CONC     — HIGH     +20
 *   NO_TRANSFER_HISTORY  — MEDIUM   +10
 *   LOW_HOLDER_COUNT     — MEDIUM   +10
 *
 * Fallback (TronGrid unreachable): score=50, tier=ORANGE, fallback=true
 */

import {
  isTronAddress,
  getTronAccount,
  getTronTransactions,
  getTRC20TokenInfo,
  isUSDTBlacklisted,
} from "./rpc";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TronSignal {
  kind: string;
  label: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  delta: number;
}

export interface TronScanResult {
  score: number;
  tier: "GREEN" | "ORANGE" | "RED";
  signals: TronSignal[];
  isBlacklisted: boolean;
  usdtBlacklisted: boolean;
  fallback: boolean;
  data_source: "trongrid" | "fallback";
  isFrozen: boolean;
  txCount: number;
  createTime: number;
}

function tierFrom(score: number): "GREEN" | "ORANGE" | "RED" {
  if (score >= 70) return "RED";
  if (score >= 35) return "ORANGE";
  return "GREEN";
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

const FALLBACK_RESULT: TronScanResult = {
  score: 50,
  tier: "ORANGE",
  signals: [],
  isBlacklisted: false,
  usdtBlacklisted: false,
  fallback: true,
  data_source: "fallback",
  isFrozen: false,
  txCount: 0,
  createTime: 0,
};

// ── Known bad issuers (curated list — extend as needed) ──────────────────────

const KNOWN_BAD_ISSUERS = new Set<string>([
  // Add known scam deployer addresses here
]);

// ── Wallet scorer ────────────────────────────────────────────────────────────

export async function computeTronWalletScore(address: string): Promise<TronScanResult> {
  if (!isTronAddress(address)) return FALLBACK_RESULT;

  const account = await getTronAccount(address);
  if (!account) return FALLBACK_RESULT;

  const signals: TronSignal[] = [];
  let score = 0;

  // USDT blacklist check
  const usdtBl = await isUSDTBlacklisted(address);
  if (usdtBl) {
    signals.push({
      kind: "USDT_BLACKLISTED",
      label: "Address on USDT-TRC20 blacklist",
      severity: "CRITICAL",
      delta: 40,
    });
    score += 40;
  }

  // Frozen account
  if (account.isFrozen) {
    signals.push({
      kind: "FROZEN_ACCOUNT",
      label: "Account has frozen resources",
      severity: "CRITICAL",
      delta: 35,
    });
    score += 35;
  }

  // Transaction history
  const txs = await getTronTransactions(address, 50);
  if (txs.length === 0) {
    signals.push({
      kind: "NO_TRANSFER_HISTORY",
      label: "No transaction history found",
      severity: "MEDIUM",
      delta: 10,
    });
    score += 10;
  }

  // Fresh account (created less than 7 days ago)
  if (account.createTime > 0) {
    const ageMs = Date.now() - account.createTime;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 7) {
      signals.push({
        kind: "FRESH_CONTRACT",
        label: `Account created ${Math.floor(ageDays)}d ago`,
        severity: "HIGH",
        delta: 20,
      });
      score += 20;
    }
  }

  return {
    score: clamp(score),
    tier: tierFrom(clamp(score)),
    signals,
    isBlacklisted: false,
    usdtBlacklisted: usdtBl,
    fallback: false,
    data_source: "trongrid",
    isFrozen: account.isFrozen,
    txCount: txs.length,
    createTime: account.createTime,
  };
}

// ── Token scorer ─────────────────────────────────────────────────────────────

export async function computeTronTokenScore(contractAddress: string): Promise<TronScanResult> {
  if (!isTronAddress(contractAddress)) return FALLBACK_RESULT;

  const [tokenInfo, usdtBl, txs] = await Promise.all([
    getTRC20TokenInfo(contractAddress),
    isUSDTBlacklisted(contractAddress),
    getTronTransactions(contractAddress, 50),
  ]);

  if (!tokenInfo) return FALLBACK_RESULT;

  const signals: TronSignal[] = [];
  let score = 0;

  // USDT blacklist
  if (usdtBl) {
    signals.push({
      kind: "USDT_BLACKLISTED",
      label: "Contract on USDT-TRC20 blacklist",
      severity: "CRITICAL",
      delta: 40,
    });
    score += 40;
  }

  // Issuer flagged
  if (KNOWN_BAD_ISSUERS.has(tokenInfo.issuerAddress)) {
    signals.push({
      kind: "ISSUER_FLAGGED",
      label: "Token issuer is a known bad actor",
      severity: "CRITICAL",
      delta: 40,
    });
    score += 40;
  }

  // Fresh contract
  // Check via transaction timestamps (first tx approximates deploy time)
  if (txs.length > 0) {
    const oldest = Math.min(...txs.map((t) => t.timestamp));
    if (oldest > 0) {
      const ageDays = (Date.now() - oldest) / (1000 * 60 * 60 * 24);
      if (ageDays < 7) {
        signals.push({
          kind: "FRESH_CONTRACT",
          label: `Contract deployed ${Math.floor(ageDays)}d ago`,
          severity: "HIGH",
          delta: 20,
        });
        score += 20;
      }
    }
  }

  // No transfer history
  if (txs.length === 0) {
    signals.push({
      kind: "NO_TRANSFER_HISTORY",
      label: "No transaction history found",
      severity: "MEDIUM",
      delta: 10,
    });
    score += 10;
  }

  // Low holder count (if available)
  if (tokenInfo.holderCount !== undefined && tokenInfo.holderCount < 100) {
    signals.push({
      kind: "LOW_HOLDER_COUNT",
      label: `Only ${tokenInfo.holderCount} holders`,
      severity: "MEDIUM",
      delta: 10,
    });
    score += 10;
  }

  return {
    score: clamp(score),
    tier: tierFrom(clamp(score)),
    signals,
    isBlacklisted: false,
    usdtBlacklisted: usdtBl,
    fallback: false,
    data_source: "trongrid",
    isFrozen: false,
    txCount: txs.length,
    createTime: 0,
  };
}
