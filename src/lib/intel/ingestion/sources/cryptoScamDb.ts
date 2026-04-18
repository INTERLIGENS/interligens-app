/**
 * CryptoScamDB blacklist ingest.
 *
 * Source: https://github.com/CryptoScamDB/blacklist
 *   - data/urls.yaml  — 2.1 MB of scam URLs + nested crypto addresses
 *
 * Each entry may have:
 *   - name / url / category / subcategory / description / reporter
 *   - addresses: { ETH: [...], BTC: [...], ... }
 *
 * We write:
 *   - DomainLabel rows for the host extracted from `url` or `name`
 *   - AddressLabel rows for every address inside `addresses`
 *
 * Licence: MIT per github.com/CryptoScamDB/blacklist LICENSE.
 * Addresses carry the matched category (Phishing / Scam / Fake ICO etc).
 */

import { bulkUpsertAddressLabels, bulkUpsertDomainLabels, type AddressLabelRow, type DomainLabelRow } from "../upsert/bulk";
import { normaliseDomain } from "../normalize/domain";
import { emptySummary, type IngestSummary } from "../run/types";

const URL_YAML = "https://raw.githubusercontent.com/CryptoScamDB/blacklist/master/data/urls.yaml";
const SOURCE_URL = "https://github.com/CryptoScamDB/blacklist";
const LICENSE = "MIT (per github.com/CryptoScamDB/blacklist)";
const SOURCE_NAME = "CryptoScamDB";

// Minimal YAML block parser — the file is uniform `- key: value` blocks
// separated by a leading `- ` at column 0. We split on `\n- ` so each
// entry is self-contained, then do a line-level regex per entry.
type Entry = {
  name: string | null;
  url: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  addresses: Record<string, string[]>;
};

function parseEntries(yaml: string): Entry[] {
  // Drop the leading "---\n" header and split. Using a multi-line regex.
  const body = yaml.replace(/^---\s*/m, "");
  const blocks = body.split(/\n-\s+/).map((b, i) => (i === 0 ? b.replace(/^-\s+/, "") : b));
  const entries: Entry[] = [];
  for (const b of blocks) {
    if (!b.trim()) continue;
    const lines = b.split(/\n/);
    const e: Entry = {
      name: null, url: null, category: null, subcategory: null, description: null, addresses: {},
    };
    let inAddr = false;
    let currentChain: string | null = null;
    for (const ln of lines) {
      // Top-level key:value
      if (!inAddr) {
        const m = /^\s*(name|url|category|subcategory|description|reporter):\s*"?([^\n"]*?)"?\s*$/.exec(ln);
        if (m) {
          const [, key, val] = m;
          if (key === "name") e.name = val;
          else if (key === "url") e.url = val;
          else if (key === "category") e.category = val;
          else if (key === "subcategory") e.subcategory = val;
          else if (key === "description") e.description = val;
          continue;
        }
        if (/^\s*addresses:/.test(ln)) { inAddr = true; continue; }
      } else {
        // addresses block. Could be `    ETH:` or `    - "0x…"`.
        const chainMatch = /^\s{2,6}([A-Z]{2,5}):\s*$/.exec(ln);
        if (chainMatch) {
          currentChain = chainMatch[1];
          e.addresses[currentChain] = [];
          continue;
        }
        const addrMatch = /^\s{4,}-\s*"?([^\n"]+?)"?\s*$/.exec(ln);
        if (addrMatch && currentChain) {
          e.addresses[currentChain].push(addrMatch[1].trim());
          continue;
        }
        // Blank or dedent — close the addresses section.
        if (/^\s*$/.test(ln)) continue;
        // Assume a new key outside `addresses:`.
        inAddr = false;
      }
    }
    entries.push(e);
  }
  return entries;
}

function chainFromKey(k: string): string {
  const up = k.toUpperCase();
  if (up === "ETH" || up === "ERC20" || up === "ERC-20" || up === "BSC" || up === "BNB" || up === "ARB" || up === "MATIC") return "EVM";
  if (up === "BTC") return "BTC";
  if (up === "SOL") return "SOL";
  if (up === "TRX" || up === "TRON") return "TRON";
  return up;
}

export async function ingestCryptoScamDb(): Promise<IngestSummary> {
  const summary = emptySummary("CryptoScamDB");
  const t0 = Date.now();

  let yaml: string;
  try {
    const r = await fetch(URL_YAML, { headers: { "user-agent": "interligens-intel-ingest/1" } });
    if (!r.ok) {
      summary.errors++;
      summary.note = `fetch_${r.status}`;
      summary.durationMs = Date.now() - t0;
      return summary;
    }
    yaml = await r.text();
  } catch (err) {
    summary.errors++;
    summary.note = err instanceof Error ? err.message : "fetch_failed";
    summary.durationMs = Date.now() - t0;
    return summary;
  }

  const entries = parseEntries(yaml);
  summary.fetched = entries.length;

  const domainRows: DomainLabelRow[] = [];
  const addrRows: AddressLabelRow[] = [];
  const domainSeen = new Set<string>();
  const addrSeen = new Set<string>();

  for (const e of entries) {
    const cat = e.category ?? "Scam";
    const sub = e.subcategory ?? "";
    const descr = e.description ?? "";
    const labelType = cat.toLowerCase() === "phishing" ? "PHISHING" : "SCAM_DOMAIN";

    const urlOrName = e.url ?? (e.name ? "http://" + e.name : null);
    if (urlOrName) {
      const dom = normaliseDomain(urlOrName);
      if (dom && !domainSeen.has(dom)) {
        domainSeen.add(dom);
        domainRows.push({
          domain: dom,
          labelType,
          label: `CryptoScamDB: ${cat}${sub ? " / " + sub : ""}`,
          confidence: "medium",
          category: sub || cat.toLowerCase(),
          sourceName: SOURCE_NAME,
          sourceUrl: SOURCE_URL,
          evidence: descr || `Listed in CryptoScamDB/urls.yaml — ${cat}`,
          visibility: "public",
          license: LICENSE,
        });
        summary.normalised++;
      }
    }

    for (const [k, list] of Object.entries(e.addresses)) {
      const chain = chainFromKey(k);
      for (const raw of list) {
        const addr = raw.trim();
        if (!addr || addr.length < 10) continue;
        const norm = chain === "EVM" ? addr.toLowerCase() : addr;
        const dedup = `${chain}:${norm}`;
        if (addrSeen.has(dedup)) continue;
        addrSeen.add(dedup);
        addrRows.push({
          address: norm,
          chain,
          labelType: "SCAM",
          label: `CryptoScamDB: ${cat}${sub ? " / " + sub : ""}`,
          confidence: "medium",
          sourceName: SOURCE_NAME,
          sourceUrl: SOURCE_URL,
          evidence: descr || `Linked to ${e.name ?? e.url ?? "CryptoScamDB entry"}`,
          visibility: "public",
          license: LICENSE,
        });
        summary.normalised++;
      }
    }
  }

  const d = await bulkUpsertDomainLabels(domainRows);
  const a = await bulkUpsertAddressLabels(addrRows);
  summary.upserted = d.upserted + a.upserted;
  summary.errors += d.errors + a.errors;
  summary.note = `domains=${d.upserted} addresses=${a.upserted}`;

  summary.durationMs = Date.now() - t0;
  return summary;
}
