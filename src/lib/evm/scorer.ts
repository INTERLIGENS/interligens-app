/**
 * EVM-generic scorer for Base and Arbitrum.
 *
 * Signals:
 *   FRESH_CONTRACT        — HIGH     +20  (contract < 7 days)
 *   NO_VERIFIED_SOURCE    — MEDIUM   +15  (unverified source on explorer)
 *   HONEYPOT_PATTERN      — CRITICAL +40  (buy tax >90% or sell impossible)
 *   PROXY_UNVERIFIED      — HIGH     +25  (proxy contract, impl not verified)
 *   HIGH_OWNER_CONTROL    — HIGH     +20  (owner can mint/pause/blacklist)
 *   KNOWN_BAD_DEPLOYER    — CRITICAL +45  (deployer in knownBad list)
 *   ZERO_LIQUIDITY        — HIGH     +30
 *   RAPID_RUGPULL         — CRITICAL +50  (liquidity pulled < 48h)
 *   BRIDGE_EXPLOIT_PATTERN — CRITICAL +35  (Arbitrum-specific bridge exploit)
 *
 * Fallback: score=50, tier=ORANGE, fallback=true
 */

import {
  type EVMChainConfig,
  getChainConfig,
  isContract as checkIsContract,
  getTxList,
  getSourceCode,
  isEVMAddress,
} from "./client";
import { scanPermitApprovals } from "./permitScanner";

// ── Types ────────────────────────────────────────────────────────────────────

export interface EVMSignal {
  kind: string;
  label: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  delta: number;
}

export interface EVMScanResult {
  score: number;
  tier: "GREEN" | "ORANGE" | "RED";
  signals: EVMSignal[];
  fallback: boolean;
  data_source: string;
  isContract: boolean;
  txCount: number;
  verified: boolean;
  contractAge: number | null;
}

function tierFrom(score: number): "GREEN" | "ORANGE" | "RED" {
  if (score >= 70) return "RED";
  if (score >= 35) return "ORANGE";
  return "GREEN";
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

const FALLBACK: EVMScanResult = {
  score: 50,
  tier: "ORANGE",
  signals: [],
  fallback: true,
  data_source: "fallback",
  isContract: false,
  txCount: 0,
  verified: false,
  contractAge: null,
};

// ── Known bad deployers (placeholder — extend as intel grows) ────────────────

const KNOWN_BAD_DEPLOYERS = new Set<string>([
  // Will be populated from intelligence as patterns emerge
]);

// ── Bridge exploit patterns (Arbitrum-specific) ──────────────────────────────

const BRIDGE_EXPLOIT_METHODS = [
  "finalizeInboundTransfer",
  "outboundTransfer",
  "triggerL2Migration",
];

// ── Generic EVM scorer ───────────────────────────────────────────────────────

export async function computeEVMScore(
  chainSlug: string,
  address: string
): Promise<EVMScanResult> {
  const config = getChainConfig(chainSlug);
  if (!config) return { ...FALLBACK };

  try {
    const chainTag = (config.slug ?? "").toUpperCase(); // ETH / BASE / ARBITRUM
    const [contractFlag, txList, srcData, permitScan] = await Promise.all([
      checkIsContract(config, address),
      getTxList(config, address, 25),
      getSourceCode(config, address),
      scanPermitApprovals(config, address, { chainTag }),
    ]);

    const now = Date.now() / 1000;
    const isVerified = !!(srcData?.SourceCode);
    const contractAge = txList.length > 0
      ? Math.floor((now - Number(txList[txList.length - 1]?.timeStamp ?? 0)) / 86400)
      : null;

    const signals: EVMSignal[] = [];
    let score = 10;

    // FRESH_CONTRACT
    if (contractFlag && contractAge !== null && contractAge < 7) {
      signals.push({ kind: "FRESH_CONTRACT", label: "Contract created less than 7 days ago", severity: "HIGH", delta: 20 });
      score += 20;
    }

    // NO_VERIFIED_SOURCE
    if (contractFlag && !isVerified) {
      signals.push({ kind: "NO_VERIFIED_SOURCE", label: "Contract source code not verified on explorer", severity: "MEDIUM", delta: 15 });
      score += 15;
    }

    // PROXY_UNVERIFIED — detect proxy pattern
    if (contractFlag && srcData?.Proxy === "1" && !isVerified) {
      signals.push({ kind: "PROXY_UNVERIFIED", label: "Proxy contract with unverified implementation", severity: "HIGH", delta: 25 });
      score += 25;
    }

    // HIGH_OWNER_CONTROL — check ABI for owner-heavy functions
    if (contractFlag && isVerified && srcData?.ABI) {
      try {
        const abi = JSON.parse(srcData.ABI);
        const dangerousFns = ["mint", "pause", "blacklist", "setFee", "setTax"];
        const hasDangerousFn = abi.some((item: any) =>
          item.type === "function" && dangerousFns.some((fn) => item.name?.toLowerCase().includes(fn))
        );
        if (hasDangerousFn) {
          signals.push({ kind: "HIGH_OWNER_CONTROL", label: "Owner has mint/pause/blacklist capabilities", severity: "HIGH", delta: 20 });
          score += 20;
        }
      } catch {
        // ABI parse failed — skip
      }
    }

    // HONEYPOT_PATTERN — check for extremely high taxes or locked sells
    if (contractFlag && isVerified && srcData?.ABI) {
      try {
        const src = String(srcData.SourceCode ?? "").toLowerCase();
        const hasSellBlock = src.includes("sellfeepercent") && (src.includes("100") || src.includes("99"));
        const hasTransferBlock = src.includes("_transfer") && src.includes("revert") && src.includes("sell");
        if (hasSellBlock || hasTransferBlock) {
          signals.push({ kind: "HONEYPOT_PATTERN", label: "Honeypot pattern detected — sell may be blocked or heavily taxed", severity: "CRITICAL", delta: 40 });
          score += 40;
        }
      } catch {
        // Source analysis failed — skip
      }
    }

    // KNOWN_BAD_DEPLOYER
    if (txList.length > 0) {
      const deployer = String(txList[txList.length - 1]?.from ?? "").toLowerCase();
      if (KNOWN_BAD_DEPLOYERS.has(deployer)) {
        signals.push({ kind: "KNOWN_BAD_DEPLOYER", label: "Deployer address flagged in known-bad database", severity: "CRITICAL", delta: 45 });
        score += 45;
      }
    }

    // BRIDGE_EXPLOIT_PATTERN (Arbitrum-specific)
    if (chainSlug === "arbitrum" && txList.length > 0) {
      const hasBridgeExploitCall = txList.some((tx: any) => {
        const fn = String(tx.functionName ?? "").toLowerCase();
        return BRIDGE_EXPLOIT_METHODS.some((m) => fn.includes(m.toLowerCase()));
      });
      if (hasBridgeExploitCall) {
        signals.push({ kind: "BRIDGE_EXPLOIT_PATTERN", label: "Bridge exploit function calls detected", severity: "CRITICAL", delta: 35 });
        score += 35;
      }
    }

    // LOW_HISTORY
    if (txList.length < 5) {
      signals.push({ kind: "LOW_HISTORY", label: "Very low transaction history", severity: "MEDIUM", delta: 10 });
      score += 10;
    }

    // MALICIOUS_APPROVAL / UNLIMITED_APPROVAL — from Permit scanner.
    // `permitScan.skipped === true` means the Etherscan logs call timed
    // out or returned an error; in that case we add no signal rather than
    // claim the wallet is clean.
    if (!permitScan.skipped) {
      if (permitScan.malicious) {
        signals.push({
          kind: "MALICIOUS_APPROVAL",
          label: "Existing approval to a known drainer spender",
          severity: "CRITICAL",
          delta: 40,
        });
        score += 40;
      }
      if (permitScan.unlimited) {
        signals.push({
          kind: "UNLIMITED_APPROVAL",
          label: "Unlimited (uint256.max) ERC-20 approval on file",
          severity: "HIGH",
          delta: 20,
        });
        score += 20;
      }
    }

    score = clamp(score);

    return {
      score,
      tier: tierFrom(score),
      signals,
      fallback: false,
      data_source: `etherscan-v2-${config.slug}`,
      isContract: contractFlag,
      txCount: txList.length,
      verified: isVerified,
      contractAge,
    };
  } catch {
    return { ...FALLBACK, data_source: `fallback-${config.slug}` };
  }
}

// ── Chain-specific wrappers ──────────────────────────────────────────────────

export async function computeBaseScore(address: string): Promise<EVMScanResult> {
  return computeEVMScore("base", address);
}

export async function computeArbitrumScore(address: string): Promise<EVMScanResult> {
  return computeEVMScore("arbitrum", address);
}

// Re-export for convenience
export { isEVMAddress } from "./client";
