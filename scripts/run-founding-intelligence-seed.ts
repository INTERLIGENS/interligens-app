/**
 * Founding Intelligence Seed — unified runner.
 *
 * Usage (repo root):
 *   npx tsx --env-file=.env.local scripts/run-founding-intelligence-seed.ts
 *   npx tsx --env-file=.env.local scripts/run-founding-intelligence-seed.ts --source=metamask
 *   npx tsx --env-file=.env.local scripts/run-founding-intelligence-seed.ts --source=ofac
 *   npx tsx --env-file=.env.local scripts/run-founding-intelligence-seed.ts --dry-run
 *
 * Sources supported:
 *   - metamask, phantom, scamsniffer-domains, scamsniffer-addresses,
 *     ofac, defillama
 *
 * The "all" default runs every P0 ingestor sequentially. Each one is
 * idempotent and prints a structured summary line.
 */

import { ingestMetaMaskPhishing } from "@/lib/intel/ingestion/sources/metamaskPhishing";
import { ingestPhantomBlocklist } from "@/lib/intel/ingestion/sources/phantomBlocklist";
import { ingestScamSnifferDomains } from "@/lib/intel/ingestion/sources/scamSnifferDomains";
import { ingestScamSniffer as ingestScamSnifferAddresses } from "@/lib/intel/scamSniffer";
import { ingestOfac } from "@/lib/intel/ofac";
import { ingestDefiLlama } from "@/lib/intel/ingestion/sources/defiLlamaProtocols";
import type { IngestSummary } from "@/lib/intel/ingestion/run/types";

type Runner = () => Promise<IngestSummary | { fetched: number; upserted: number; errors: number; durationMs: number; [k: string]: unknown }>;

const RUNNERS: Record<string, Runner> = {
  metamask: ingestMetaMaskPhishing,
  phantom: ingestPhantomBlocklist,
  "scamsniffer-domains": ingestScamSnifferDomains,
  "scamsniffer-addresses": async () => {
    const r = await ingestScamSnifferAddresses();
    return { ...r, source: "ScamSniffer_addresses", normalised: r.fetched, updated: 0, skipped: 0 };
  },
  ofac: async () => {
    const r = await ingestOfac();
    return { ...r, source: "OFAC_SDN", normalised: r.fetched, updated: 0, skipped: 0 };
  },
  defillama: ingestDefiLlama,
};

function parseArgs(argv: string[]): { source: string; dryRun: boolean } {
  let source = "all";
  let dryRun = false;
  for (const a of argv) {
    if (a.startsWith("--source=")) source = a.slice("--source=".length);
    if (a === "--dry-run") dryRun = true;
  }
  return { source, dryRun };
}

async function main() {
  const { source, dryRun } = parseArgs(process.argv.slice(2));

  const list = source === "all" ? Object.keys(RUNNERS) : [source];
  const unknown = list.filter((s) => !(s in RUNNERS));
  if (unknown.length > 0) {
    console.error("Unknown source(s):", unknown.join(", "));
    console.error("Valid:", Object.keys(RUNNERS).join(", "));
    process.exit(2);
  }

  if (dryRun) {
    console.log(`[dry-run] would run:`, list.join(", "));
    process.exit(0);
  }

  const results: Array<Record<string, unknown>> = [];
  for (const s of list) {
    console.log(`\n→ ${s} starting…`);
    try {
      const r = await RUNNERS[s]();
      console.log(`✓ ${s}:`, r);
      results.push({ ...r, source: s });
    } catch (err) {
      console.error(`✗ ${s} failed:`, err);
      results.push({ source: s, error: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log("\n=== Summary ===");
  for (const r of results) {
    console.log(JSON.stringify(r));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
