/**
 * OpenSanctions ingest — crypto-wallet rows from the IL MOD and US FBI
 * Lazarus-group datasets.
 *
 * Source: https://www.opensanctions.org/
 *   - https://data.opensanctions.org/datasets/latest/il_mod_crypto/targets.simple.csv
 *   - https://data.opensanctions.org/datasets/latest/us_fbi_lazarus_crypto/targets.simple.csv
 *
 * CSV shape:
 *   id, schema, name, aliases, …, identifiers, … dataset, first_seen, last_seen
 *
 * Only rows with schema="CryptoWallet" become labels. The `name` field
 * carries the wallet address itself; `identifiers` repeats it.
 *
 * Licence: OpenSanctions is CC-BY-4.0 (attribution required). We store
 * the dataset name + sourceUrl on every row.
 */

import { bulkUpsertAddressLabels, type AddressLabelRow } from "../upsert/bulk";
import { emptySummary, type IngestSummary } from "../run/types";

const SOURCES: Array<{ slug: string; label: string }> = [
  { slug: "il_mod_crypto", label: "OpenSanctions: Israel MOD crypto" },
  { slug: "us_fbi_lazarus_crypto", label: "OpenSanctions: FBI Lazarus crypto" },
];

const LICENSE = "CC-BY-4.0 (OpenSanctions — attribution required)";
const SOURCE_NAME = "OpenSanctions";

// Very small CSV parser — handles commas inside quoted fields.
function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === "\"" && line[i + 1] === "\"") { cur += "\""; i++; }
      else if (c === "\"") inQuote = false;
      else cur += c;
    } else {
      if (c === ",") { out.push(cur); cur = ""; }
      else if (c === "\"") inQuote = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Rough chain classifier from the address itself (OpenSanctions doesn't
// consistently include a chain code — the CSV's `identifiers` field is
// often just the address).
function inferChain(addr: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(addr)) return "EVM";
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return "TRON";
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/.test(addr)) return "BTC";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) return "SOL";
  if (/^X[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return "DASH";
  if (/^[14][1-9A-HJ-NP-Za-km-z]{93}$/.test(addr)) return "XMR";
  return "OTHER";
}

export async function ingestOpenSanctions(): Promise<IngestSummary> {
  const summary = emptySummary("OpenSanctions_crypto");
  const t0 = Date.now();

  const rows: AddressLabelRow[] = [];
  const seen = new Set<string>();

  for (const src of SOURCES) {
    const url = `https://data.opensanctions.org/datasets/latest/${src.slug}/targets.simple.csv`;
    try {
      const r = await fetch(url, {
        headers: { "user-agent": "interligens-intel-ingest/1", accept: "text/csv" },
      });
      if (!r.ok) {
        summary.errors++;
        console.warn(`[opensanctions] ${src.slug} fetch_${r.status}`);
        continue;
      }
      const text = await r.text();
      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      if (lines.length === 0) continue;
      const header = parseCsvRow(lines[0]);
      const schemaIdx = header.indexOf("schema");
      const nameIdx = header.indexOf("name");
      const datasetIdx = header.indexOf("dataset");
      const idIdx = header.indexOf("id");

      for (let i = 1; i < lines.length; i++) {
        summary.fetched++;
        const cols = parseCsvRow(lines[i]);
        if (cols[schemaIdx] !== "CryptoWallet") { summary.skipped++; continue; }
        const addr = (cols[nameIdx] ?? "").trim();
        if (!addr || addr.length < 10) { summary.skipped++; continue; }
        const chain = inferChain(addr);
        const norm = chain === "EVM" ? addr.toLowerCase() : addr;
        const dedup = `${chain}:${norm}`;
        if (seen.has(dedup)) { summary.skipped++; continue; }
        seen.add(dedup);
        summary.normalised++;

        const osId = cols[idIdx] ?? "";
        const dataset = cols[datasetIdx] ?? src.slug;
        rows.push({
          address: norm,
          chain,
          labelType: "SANCTIONS",
          label: src.label,
          confidence: "high",
          entityName: dataset,
          sourceName: SOURCE_NAME,
          sourceUrl: `https://www.opensanctions.org/entities/${osId}/`,
          evidence: `${dataset} (OpenSanctions entity ${osId})`,
          visibility: "public",
          license: LICENSE,
        });
      }
    } catch (err) {
      summary.errors++;
      console.error(`[opensanctions] ${src.slug} failed`, err);
    }
  }

  const { upserted, errors } = await bulkUpsertAddressLabels(rows);
  summary.upserted = upserted;
  summary.errors += errors;
  summary.durationMs = Date.now() - t0;
  return summary;
}
