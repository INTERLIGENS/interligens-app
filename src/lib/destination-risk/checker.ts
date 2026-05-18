// src/lib/destination-risk/checker.ts

import { computeTigerScore } from "@/lib/tigerscore/engine";
import type { TigerInput } from "@/lib/tigerscore/engine";

export type DestinationChain = "solana" | "ethereum" | "base" | "arbitrum";
export type DestRiskLevel    = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE";
export type FlagType =
  | "KNOWN_SCAMMER"
  | "MIXER"
  | "CEX_FLAGGED"
  | "FRESH_WALLET"
  | "INTEL_MATCH"
  | "BLACKLIST";
export type RecommendedAction = "BLOCK" | "WARN" | "PROCEED";

export interface DestinationRiskInput {
  destination: string;
  chain: DestinationChain;
  amount_usd?: number;
  token_symbol?: string;
}

export interface DestinationFlag {
  type: FlagType;
  label: string;
  source: string;
}

export interface DestinationRiskResult {
  destination: string;
  risk_level: DestRiskLevel;
  flags: DestinationFlag[];
  tiger_score?: number;
  intel_match?: boolean;
  explanation_en: string;
  explanation_fr: string;
  recommended_action: RecommendedAction;
  checked_at: Date;
}

// ── Injectable dependency types ───────────────────────────────────────────────

export type LabelLookupFn = (address: string) => Promise<{
  label: string;
  category: string;
  source: string;
} | null>;

export type VaultScanFn = (
  chain: string,
  address: string,
) => Promise<{
  severity: string;
  match: boolean;
  categories: string[];
} | null>;

// ── Category → flag type mapping ──────────────────────────────────────────────

const SCAMMER_CATS   = new Set(["scammer", "drainer", "phishing", "exploiter"]);
const MIXER_CATS     = new Set(["mixer", "tornado", "tornado_adjacent"]);
const BLACKLIST_CATS = new Set(["ofac", "amf", "sanctioned", "blacklist"]);
const CEX_CATS       = new Set(["cex"]);

function categoryToFlagType(category: string): FlagType {
  const c = category.toLowerCase();
  if (SCAMMER_CATS.has(c)) return "KNOWN_SCAMMER";
  if (MIXER_CATS.has(c))   return "MIXER";
  if (BLACKLIST_CATS.has(c)) return "BLACKLIST";
  if (CEX_CATS.has(c))     return "CEX_FLAGGED";
  return "INTEL_MATCH";
}

function isHighSeverityCat(category: string): boolean {
  const c = category.toLowerCase();
  return SCAMMER_CATS.has(c) || MIXER_CATS.has(c) || BLACKLIST_CATS.has(c);
}

// ── Fresh wallet detection ────────────────────────────────────────────────────

const SEVEN_DAYS_S = 7 * 86_400;

async function isFreshWallet(
  address: string,
  chain: DestinationChain,
  fetchFn: typeof fetch,
): Promise<boolean> {
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - SEVEN_DAYS_S;
  try {
    if (chain === "solana") {
      const key = process.env.HELIUS_API_KEY ?? "";
      if (!key) return false;
      const res = await fetchFn(
        `https://mainnet.helius-rpc.com/?api-key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getSignaturesForAddress",
            params: [address, { limit: 50 }],
          }),
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!res.ok) return false;
      const data = (await res.json()) as { result?: Array<{ blockTime?: number }> };
      const sigs = data.result ?? [];
      if (sigs.length === 0 || sigs.length >= 50) return false;
      const oldest = sigs[sigs.length - 1];
      return (oldest.blockTime ?? 0) > sevenDaysAgo;
    }

    // EVM: Etherscan first tx
    const API_BASE: Record<Exclude<DestinationChain, "solana">, string> = {
      ethereum: "https://api.etherscan.io",
      base:     "https://api.basescan.org",
      arbitrum: "https://api.arbiscan.io",
    };
    const apiKey = process.env.ETHERSCAN_API_KEY ?? "";
    const base   = API_BASE[chain as Exclude<DestinationChain, "solana">];
    const params = new URLSearchParams({
      module: "account",
      action: "txlist",
      address,
      sort: "asc",
      page: "1",
      offset: "1",
      apikey: apiKey || "YourApiKeyToken",
    });
    const res = await fetchFn(`${base}/api?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      status: string;
      result?: Array<{ timeStamp?: string }>;
    };
    if (data.status !== "1" || !Array.isArray(data.result) || !data.result[0]) {
      return false;
    }
    const firstTs = parseInt(data.result[0].timeStamp ?? "0", 10);
    return firstTs > sevenDaysAgo;
  } catch {
    return false;
  }
}

// ── Risk level aggregation ────────────────────────────────────────────────────

const RISK_ORDER: DestRiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"];

function maxRisk(a: DestRiskLevel, b: DestRiskLevel): DestRiskLevel {
  return RISK_ORDER.indexOf(a) <= RISK_ORDER.indexOf(b) ? a : b;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function checkDestinationRisk(
  input: DestinationRiskInput,
  _lookupFn?: LabelLookupFn,
  _vaultFn?: VaultScanFn,
  _fetchFn?: typeof fetch,
): Promise<DestinationRiskResult> {
  const fetchFn   = _fetchFn ?? fetch;
  const flags: DestinationFlag[] = [];
  let riskLevel: DestRiskLevel   = "SAFE";
  let tigerScore: number | undefined;
  let intelMatch                 = false;

  // ── 1. WalletLabel quick lookup ───────────────────────────────────────────
  let labelResult: Awaited<ReturnType<LabelLookupFn>> = null;
  if (_lookupFn) {
    labelResult = await _lookupFn(input.destination).catch(() => null);
  } else {
    try {
      const { lookupAddress } = await import("@/lib/labels/lookup");
      labelResult = await lookupAddress(input.destination);
    } catch {
      labelResult = null;
    }
  }

  if (labelResult) {
    intelMatch = true;
    const cat      = labelResult.category.toLowerCase();
    const flagType = categoryToFlagType(cat);

    flags.push({
      type: flagType,
      label: labelResult.label,
      source: labelResult.source,
    });

    if (SCAMMER_CATS.has(cat) || MIXER_CATS.has(cat) || BLACKLIST_CATS.has(cat)) {
      riskLevel = maxRisk(riskLevel, "CRITICAL");
    } else {
      riskLevel = maxRisk(riskLevel, "HIGH");
    }
  }

  // ── 2. Intel Vault deep lookup ────────────────────────────────────────────
  let vaultResult: Awaited<ReturnType<VaultScanFn>> = null;
  if (_vaultFn) {
    vaultResult = await _vaultFn(input.chain, input.destination).catch(() => null);
  } else {
    try {
      const { vaultLookup } = await import("@/lib/intel-vault/scan-lookup");
      const v = await vaultLookup(input.chain, input.destination);
      if (v.match) {
        vaultResult = { severity: v.severity, match: v.match, categories: v.categories };
      }
    } catch {
      vaultResult = null;
    }
  }

  if (vaultResult?.match) {
    intelMatch = true;
    const sev = vaultResult.severity;

    if (!flags.length) {
      flags.push({
        type: "INTEL_MATCH",
        label: `Intel Vault: ${vaultResult.categories.join(", ") || sev}`,
        source: "intel-vault",
      });
    }

    // ── 3. TigerScore from vault evidence ──────────────────────────────────
    const chainMap: Record<DestinationChain, TigerInput["chain"]> = {
      solana:   "SOL",
      ethereum: "ETH",
      base:     "BASE",
      arbitrum: "ARBITRUM",
    };
    const tigerInput: TigerInput = {
      chain:          chainMap[input.chain],
      scan_type:      "wallet",
      evm_known_bad:  sev === "high" || sev === "critical",
      scam_lineage:
        vaultResult.categories.some((c) => SCAMMER_CATS.has(c.toLowerCase()))
          ? "CONFIRMED"
          : vaultResult.categories.some((c) => ["phishing", "exploiter"].includes(c.toLowerCase()))
            ? "REFERENCED"
            : "NONE",
    };
    const tigerResult = computeTigerScore(tigerInput);
    tigerScore = tigerResult.score;

    if (sev === "critical") {
      riskLevel = maxRisk(riskLevel, "CRITICAL");
    } else if (sev === "high" || tigerResult.score > 70) {
      riskLevel = maxRisk(riskLevel, "HIGH");
    } else if (sev === "medium") {
      riskLevel = maxRisk(riskLevel, "MEDIUM");
    }
  }

  // ── 4. Fresh wallet check ─────────────────────────────────────────────────
  if (riskLevel === "SAFE" || riskLevel === "LOW") {
    const fresh = await isFreshWallet(input.destination, input.chain, fetchFn);
    if (fresh) {
      flags.push({
        type: "FRESH_WALLET",
        label: "Wallet created < 7 days ago",
        source: "on-chain",
      });
      riskLevel = maxRisk(riskLevel, "MEDIUM");
    }
  }

  // ── Build result ──────────────────────────────────────────────────────────
  const recommended: RecommendedAction =
    riskLevel === "CRITICAL" ? "BLOCK"
    : riskLevel === "HIGH" || riskLevel === "MEDIUM" ? "WARN"
    : "PROCEED";

  const explanation_en =
    riskLevel === "CRITICAL"
      ? `STOP. This address has been flagged as dangerous (${flags[0]?.label ?? "Intel match"}). Do not send funds.`
      : riskLevel === "HIGH"
        ? `CAUTION. This address shows risk signals. Review carefully before sending.`
        : riskLevel === "MEDIUM"
          ? `This address is new or has limited history. Proceed with caution.`
          : "This destination address appears clean.";

  const explanation_fr =
    riskLevel === "CRITICAL"
      ? `STOP. Cette adresse a été signalée comme dangereuse (${flags[0]?.label ?? "correspondance Intel"}). Ne pas envoyer de fonds.`
      : riskLevel === "HIGH"
        ? `ATTENTION. Cette adresse présente des signaux de risque. Vérifiez avant d'envoyer.`
        : riskLevel === "MEDIUM"
          ? `Cette adresse est nouvelle ou a un historique limité. Procédez avec prudence.`
          : "Cette adresse de destination semble propre.";

  return {
    destination: input.destination,
    risk_level: riskLevel,
    flags,
    tiger_score: tigerScore,
    intel_match: intelMatch,
    explanation_en,
    explanation_fr,
    recommended_action: recommended,
    checked_at: new Date(),
  };
}
