/**
 * Real-CATS academic dataset ingest.
 *
 * Source: https://github.com/sjdseu/Real-CATS
 *   - CB.tsv: 40,032 criminal BTC addresses
 *   - BB.tsv: 90,176 benign BTC addresses (exchange customers)
 *   - CE.tsv: 12,561 criminal ETH addresses
 *   - BE.tsv: 16,020 benign ETH addresses
 *
 * TSV shape: column 0 = address, column 1 = label (e.g. "Ransomware",
 * "Blackmail Scam", "Exchange").
 *
 * Licence note: the repo publishes under implicit academic research
 * terms — the dataset is offered as a research contribution. Rows carry
 * sourceUrl + license attribution; non-commercial internal use only.
 */

import { bulkUpsertAddressLabels, type AddressLabelRow } from "../upsert/bulk";
import { emptySummary, type IngestSummary } from "../run/types";

const BASE = "https://raw.githubusercontent.com/sjdseu/Real-CATS/master";
const SOURCE_URL = "https://github.com/sjdseu/Real-CATS";
const LICENSE = "Real-CATS academic dataset — research use only";
const SOURCE_NAME = "Real-CATS (academic)";

type FileSpec = {
  file: string;
  chain: "BTC" | "EVM";
  kind: "criminal" | "benign";
};

const FILES: FileSpec[] = [
  { file: "CB.tsv", chain: "BTC", kind: "criminal" },
  { file: "BB.tsv", chain: "BTC", kind: "benign" },
  { file: "CE.tsv", chain: "EVM", kind: "criminal" },
  { file: "BE.tsv", chain: "EVM", kind: "benign" },
];

async function fetchTsv(url: string): Promise<string[][]> {
  const res = await fetch(url, {
    headers: { "user-agent": "interligens-intel-ingest/1" },
  });
  if (!res.ok) throw new Error(`fetch_${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  // Skip header
  return lines
    .slice(1)
    .filter((l) => l.length > 0)
    .map((l) => l.split("\t"));
}

export async function ingestRealCats(): Promise<IngestSummary> {
  const summary = emptySummary("Real-CATS");
  const t0 = Date.now();

  for (const spec of FILES) {
    let rowsTsv: string[][];
    try {
      rowsTsv = await fetchTsv(`${BASE}/${spec.file}`);
    } catch (err) {
      summary.errors++;
      console.error("[real-cats] fetch failed", spec.file, err);
      continue;
    }

    const rows: AddressLabelRow[] = [];
    const seen = new Set<string>();
    for (const row of rowsTsv) {
      summary.fetched++;
      const addr = (row[0] ?? "").trim();
      const rawLabel = (row[1] ?? "").trim();
      if (!addr || addr.length < 10) { summary.skipped++; continue; }

      // Chain-specific address normalisation.
      const normAddr = spec.chain === "EVM" ? addr.toLowerCase() : addr;
      const dedup = `${spec.chain}:${normAddr}`;
      if (seen.has(dedup)) { summary.skipped++; continue; }
      seen.add(dedup);
      summary.normalised++;

      const labelType = spec.kind === "criminal" ? "SCAM" : "LEGITIMATE";
      const label = spec.kind === "criminal"
        ? `Real-CATS criminal: ${rawLabel || "unclassified"}`
        : `Real-CATS benign: ${rawLabel || "exchange"}`;
      const confidence: "low" | "medium" | "high" = spec.kind === "criminal" ? "medium" : "medium";

      rows.push({
        address: normAddr,
        chain: spec.chain,
        labelType,
        label,
        confidence,
        sourceName: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        evidence: `Real-CATS/${spec.file} (academic research dataset)`,
        visibility: "internal_only",
        license: LICENSE,
      });
    }

    const { upserted, errors } = await bulkUpsertAddressLabels(rows);
    summary.upserted += upserted;
    summary.errors += errors;
  }

  summary.durationMs = Date.now() - t0;
  return summary;
}
