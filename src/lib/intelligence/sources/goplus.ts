// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — GoPlus Security Ingestor
// Realtime per-address lookup. Not a batch fetcher — called on-demand during
// pipeline execution for a specific token CA / address.
// Weight: 0.15 in intelligence scoring.
// Cache miss → scoring continues, never errors.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeAddress } from "../normalize";
import type { SourceRaw } from "./types";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const TIMEOUT_MS = 5_000;

// Chain ID mapping for GoPlus API
const CHAIN_IDS: Record<string, string> = {
  ethereum: "1",
  bsc: "56",
  polygon: "137",
  arbitrum: "42161",
  optimism: "10",
  avalanche: "43114",
  fantom: "250",
  solana: "solana",
};

interface GoPlusTokenResult {
  is_honeypot?: string;
  is_blacklisted?: string;
  is_open_source?: string;
  is_proxy?: string;
  is_mintable?: string;
  owner_change_balance?: string;
  can_take_back_ownership?: string;
  hidden_owner?: string;
  selfdestruct?: string;
  external_call?: string;
  buy_tax?: string;
  sell_tax?: string;
  is_anti_whale?: string;
  cannot_sell_all?: string;
  trust_list?: string;
  holder_count?: string;
  total_supply?: string;
  [key: string]: unknown;
}

interface GoPlusResponse {
  code: number;
  message: string;
  result: Record<string, GoPlusTokenResult>;
}

/**
 * Realtime GoPlus lookup for a single token contract address.
 * Returns SourceRaw[] (0 or 1 entries). Cache miss → empty array, never throws.
 */
export async function fetchGoPlusToken(
  contractAddress: string,
  chain: string = "ethereum"
): Promise<SourceRaw[]> {
  try {
    const chainId = CHAIN_IDS[chain] ?? "1";
    const addr = normalizeAddress(contractAddress);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const url = `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${addr}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[goplus] HTTP ${res.status} for ${addr}`);
      return [];
    }

    const json: GoPlusResponse = await res.json();
    if (json.code !== 1 || !json.result) return [];

    const data = json.result[addr.toLowerCase()] ?? json.result[addr];
    if (!data) return [];

    // Compute risk signals
    const signals: string[] = [];
    if (data.is_honeypot === "1") signals.push("honeypot");
    if (data.is_blacklisted === "1") signals.push("blacklisted");
    if (data.is_mintable === "1") signals.push("mintable");
    if (data.owner_change_balance === "1") signals.push("owner_change_balance");
    if (data.can_take_back_ownership === "1") signals.push("reclaim_ownership");
    if (data.hidden_owner === "1") signals.push("hidden_owner");
    if (data.selfdestruct === "1") signals.push("selfdestruct");
    if (data.external_call === "1") signals.push("external_call");
    if (data.cannot_sell_all === "1") signals.push("cannot_sell_all");

    const sellTax = parseFloat(data.sell_tax ?? "0");
    if (sellTax > 0.1) signals.push(`high_sell_tax_${(sellTax * 100).toFixed(0)}pct`);

    const buyTax = parseFloat(data.buy_tax ?? "0");
    if (buyTax > 0.1) signals.push(`high_buy_tax_${(buyTax * 100).toFixed(0)}pct`);

    // If no risk signals, don't create an observation
    if (signals.length === 0) return [];

    // Determine risk class
    const isHoneypot = data.is_honeypot === "1";
    const isBlacklisted = data.is_blacklisted === "1";
    const hasCritical = isHoneypot || isBlacklisted || data.selfdestruct === "1";
    const hasSevere =
      data.hidden_owner === "1" ||
      data.can_take_back_ownership === "1" ||
      data.owner_change_balance === "1" ||
      data.cannot_sell_all === "1" ||
      sellTax > 0.5;

    const riskClass = hasCritical ? "HIGH" : hasSevere ? "MEDIUM" : "LOW";

    return [
      {
        sourceSlug: "goplus",
        sourceTier: 2,
        entityType: "TOKEN_CA",
        value: addr,
        chain,
        riskClass,
        matchBasis: "EXACT_TOKEN_CA",
        label: signals.join(","),
        externalUrl: `https://gopluslabs.io/token-security/${chainId}/${addr}`,
        meta: {
          signals,
          sellTax: data.sell_tax,
          buyTax: data.buy_tax,
          isHoneypot: data.is_honeypot,
          holderCount: data.holder_count,
          isOpenSource: data.is_open_source,
        },
      },
    ];
  } catch (err: unknown) {
    // Cache miss → scoring continues, never errors
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("abort")) {
      console.warn(`[goplus] lookup failed for ${contractAddress}: ${msg}`);
    }
    return [];
  }
}

/**
 * GoPlus address security lookup (wallet, not token).
 */
export async function fetchGoPlusAddress(
  address: string,
  chain: string = "ethereum"
): Promise<SourceRaw[]> {
  try {
    const chainId = CHAIN_IDS[chain] ?? "1";
    const addr = normalizeAddress(address);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const url = `${GOPLUS_BASE}/address_security/${addr}?chain_id=${chainId}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const json = await res.json();
    if (json.code !== 1 || !json.result) return [];

    const data = json.result;
    const signals: string[] = [];

    if (data.honeypot_related_address === "1") signals.push("honeypot_related");
    if (data.phishing_activities === "1") signals.push("phishing");
    if (data.blacklist_doubt === "1") signals.push("blacklist_doubt");
    if (data.stealing_attack === "1") signals.push("stealing_attack");
    if (data.blackmail_activities === "1") signals.push("blackmail");
    if (data.cybercrime === "1") signals.push("cybercrime");
    if (data.money_laundering === "1") signals.push("money_laundering");
    if (data.financial_crime === "1") signals.push("financial_crime");
    if (data.darkweb_transactions === "1") signals.push("darkweb");
    if (data.fake_kyc === "1") signals.push("fake_kyc");
    if (data.malicious_mining_activities === "1") signals.push("malicious_mining");

    if (signals.length === 0) return [];

    const hasCritical = signals.some((s) =>
      ["phishing", "stealing_attack", "cybercrime", "money_laundering", "financial_crime"].includes(s)
    );

    return [
      {
        sourceSlug: "goplus",
        sourceTier: 2,
        entityType: "ADDRESS",
        value: addr,
        chain,
        riskClass: hasCritical ? "HIGH" : "MEDIUM",
        matchBasis: "EXACT_ADDRESS",
        label: signals.join(","),
        externalUrl: `https://gopluslabs.io/address-security/${addr}`,
        meta: { signals, raw: data },
      },
    ];
  } catch {
    return [];
  }
}
