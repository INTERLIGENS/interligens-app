/**
 * src/scripts/fetch-shill-buyers.ts
 * PHASE 3 — fetch on-chain buyers for pending ShillEvents via Helius.
 *
 * Defaults to a DRY sample of 2 events (no writes, no status change) so the
 * Helius pipeline can be validated on 1-2 mints before any fan-out.
 *
 * Usage:
 *   pnpm tsx -r dotenv/config src/scripts/fetch-shill-buyers.ts
 *     --> dry sample, 2 most-recent pending events
 *   ... --mint=<MINT> --limit=1            # target one token
 *   ... --limit=10                          # bigger dry sample
 *   ... --write                             # persist + advance processingStatus
 *   ... --max-pages=20                      # raise per-event page budget
 *
 * Needs HELIUS_API_KEY + DATABASE_URL (DOTENV_CONFIG_PATH=.env.local).
 */

import { processPendingSample, type SampleOptions } from "@/lib/shill-correlation/process";

function parseArgs(argv: string[]): SampleOptions {
  const opts: SampleOptions = { dryRun: true };
  for (const a of argv) {
    if (a === "--write") opts.dryRun = false;
    else if (a.startsWith("--mint=")) opts.mint = a.slice("--mint=".length);
    else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) opts.limit = n;
    } else if (a.startsWith("--max-pages=")) {
      const n = parseInt(a.slice("--max-pages=".length), 10);
      if (Number.isFinite(n) && n > 0) opts.maxPages = n;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log("[shill-correlation] buyer-fetch start", {
    ...opts,
    mode: opts.dryRun ? "DRY (no writes)" : "WRITE",
  });

  const results = await processPendingSample(opts);

  let pages = 0;
  let obs = 0;
  let amb = 0;
  let incomplete = 0;
  for (const r of results) {
    pages += r.pagesFetched;
    obs += r.observations;
    amb += r.ambiguous;
    if (!r.windowCovered) incomplete++;
    console.log(
      `  ${r.shillEventId} ${r.tokenMint.slice(0, 8)}… ` +
        `status=${r.status} pages=${r.pagesFetched} cov=${r.windowCovered} ` +
        `txInWin=${r.txInWindow} obs=${r.observations} amb=${r.ambiguous} ` +
        `written=${r.written}${r.error ? ` err=${r.error}` : ""}`,
    );
  }

  console.log("[shill-correlation] buyer-fetch summary", {
    events: results.length,
    totalPagesFetched: pages,
    totalObservations: obs,
    totalAmbiguous: amb,
    eventsWithIncompleteWindow: incomplete,
    errored: results.filter((r) => r.error).length,
  });

  if (results.some((r) => r.error)) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("[shill-correlation] buyer-fetch failed", e);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
