// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — OFAC SDN Ingestor
// Fetches SDN XML, extracts digital currency addresses from <sdnEntry> nodes.
// ─────────────────────────────────────────────────────────────────────────────

import { XMLParser } from "fast-xml-parser";
import { normalizeAddress } from "../normalize";
import type { SourceRaw } from "./types";

const SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.xml";

const CURRENCY_TO_CHAIN: Record<string, string> = {
  ETH: "ethereum",
  ERC20: "ethereum",
  USDT: "ethereum",
  USDC: "ethereum",
  BTC: "bitcoin",
  XBT: "bitcoin",
  SOL: "solana",
  XMR: "monero",
  LTC: "litecoin",
  ZEC: "zcash",
  TRX: "tron",
  BSC: "bsc",
  ARB: "arbitrum",
  DASH: "dash",
};

function mapChain(currencyType: string): string | undefined {
  return CURRENCY_TO_CHAIN[currencyType.toUpperCase()];
}

function extractCurrencyType(idType: string): string {
  // Format: "Digital Currency Address - USDT"
  const match = idType.match(/Digital Currency Address\s*-\s*(\w+)/i);
  return match ? match[1].toUpperCase() : "ETH";
}

export async function fetchOfac(): Promise<SourceRaw[]> {
  const res = await fetch(SDN_URL);
  if (!res.ok) throw new Error(`OFAC fetch failed: ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const doc = parser.parse(xml);

  const entries = doc?.sdnList?.sdnEntry;
  if (!entries) return [];

  const list = Array.isArray(entries) ? entries : [entries];
  const results: SourceRaw[] = [];

  for (const entry of list) {
    const ids = entry.idList?.id;
    if (!ids) continue;

    const idArr = Array.isArray(ids) ? ids : [ids];
    for (const id of idArr) {
      const idType = typeof id.idType === "string" ? id.idType : "";
      if (!idType.toLowerCase().includes("digital currency address")) continue;

      const address = id.idNumber;
      if (!address || typeof address !== "string") continue;

      const currencyType = extractCurrencyType(idType);

      results.push({
        sourceSlug: "ofac",
        sourceTier: 1,
        entityType: "ADDRESS",
        value: normalizeAddress(address),
        chain: mapChain(currencyType),
        riskClass: "SANCTION",
        matchBasis: "EXACT_ADDRESS",
        jurisdiction: "US",
        listType: "SDN",
        externalUrl: "https://sanctionssearch.ofac.treas.gov/",
        meta: { currencyType },
      });
    }
  }

  return results;
}
