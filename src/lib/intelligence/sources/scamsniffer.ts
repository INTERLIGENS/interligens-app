// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — ScamSniffer Blacklist Ingestor
// Fetches domain + address blacklists from GitHub raw JSON.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeDomain, normalizeAddress } from "../normalize";
import type { SourceRaw } from "./types";

const DOMAINS_URL =
  "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json";
const ADDRESSES_URL =
  "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json";

export async function fetchScamSniffer(): Promise<SourceRaw[]> {
  const [domainsRes, addressesRes] = await Promise.all([
    fetch(DOMAINS_URL),
    fetch(ADDRESSES_URL),
  ]);

  const results: SourceRaw[] = [];

  if (domainsRes.ok) {
    const domains: string[] = await domainsRes.json();
    for (const raw of domains) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      const value = normalizeDomain(raw);
      if (!value) continue;
      results.push({
        sourceSlug: "scamsniffer",
        sourceTier: 2,
        entityType: "DOMAIN",
        value,
        riskClass: "HIGH",
        matchBasis: "EXACT_DOMAIN",
        externalUrl:
          "https://github.com/scamsniffer/scam-database/blob/main/blacklist/domains.json",
      });
    }
  } else {
    console.warn(`ScamSniffer domains fetch failed: ${domainsRes.status}`);
  }

  if (addressesRes.ok) {
    const addresses: string[] = await addressesRes.json();
    for (const raw of addresses) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      const value = normalizeAddress(raw);
      if (!value) continue;
      results.push({
        sourceSlug: "scamsniffer",
        sourceTier: 2,
        entityType: "CONTRACT",
        value,
        chain: value.startsWith("0x") ? "ethereum" : undefined,
        riskClass: "HIGH",
        matchBasis: "EXACT_CONTRACT",
        externalUrl:
          "https://github.com/scamsniffer/scam-database/blob/main/blacklist/address.json",
      });
    }
  } else {
    console.warn(`ScamSniffer addresses fetch failed: ${addressesRes.status}`);
  }

  return results;
}
