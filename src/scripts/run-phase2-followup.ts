/**
 * src/scripts/run-phase2-followup.ts
 * PHASE 2 follow-up + PHASE 3 Track 1 (recent-window engine).
 *
 * Runs: resolve+tag tickers -> enrich timestamps (X API) -> filter recent
 * window -> Helius buyer extraction. DRY by default (writes nothing).
 *
 * Usage:
 *   pnpm tsx -r dotenv/config src/scripts/run-phase2-followup.ts
 *   ... --write            # persist ShillEvent tags + buyer observations
 *   ... --hours=72         # recent-window size (default 72)
 *   ... --enrich-days=7    # X enrichment max tweet age (default 7)
 *   ... --max-pages=20     # Helius page budget per event
 *
 * Needs HELIUS_API_KEY + X_BEARER_TOKEN + DATABASE_URL (DOTENV_CONFIG_PATH=.env.local).
 */

import { runPhase2Followup, type Phase2FollowupOptions } from "@/lib/shill-correlation/backfill";

function parseArgs(argv: string[]): Phase2FollowupOptions {
  const opts: Phase2FollowupOptions = { dryRun: true, heliusMaxPages: 20 };
  for (const a of argv) {
    if (a === "--write") opts.dryRun = false;
    else if (a.startsWith("--hours=")) opts.recentWindowHours = parseInt(a.slice(8), 10);
    else if (a.startsWith("--enrich-days=")) opts.enrichMaxAgeDays = parseInt(a.slice(14), 10);
    else if (a.startsWith("--max-pages=")) opts.heliusMaxPages = parseInt(a.slice(12), 10);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log("[phase2-followup] start", { ...opts, mode: opts.dryRun ? "DRY (no writes)" : "WRITE" });

  const r = await runPhase2Followup(opts);

  console.log("\n=== STEP 1-2  resolution + timestamp enrichment ===");
  console.log("totalEvents:", r.totalEvents, "| tweetsRequested:", r.tweetsRequested, "| tweetsResolved:", r.tweetsResolved);
  console.log("resolutionStatus:", JSON.stringify(r.resolutionCounts));
  console.log("timestampSource:", JSON.stringify(r.timestampCounts));

  console.log("\n=== STEP 3  recent-window filter ===");
  console.log("recentWindow(<=window):", r.recentWindowCount,
    "| excludedDateOnly:", r.recentExcludedDateOnly,
    "| unresolvedMint:", r.recentUnresolvedMint,
    "| eligibleForHelius:", r.eligibleForHeliusCount);

  console.log("\n=== STEP 4  Helius buyer extraction (DRY, mint-dedup) ===");
  console.log(
    `eligible events: ${r.eligibleForHeliusCount} across ${r.distinctMintsFetched} distinct mints (one super-window fetch each)`,
  );
  for (const x of r.heliusResults) {
    console.log(
      `  ${x.tokenMint.slice(0, 10)}… pages=${x.pagesFetched} cov=${x.windowCovered} ` +
        `txInWin=${x.txInWindow} obs=${x.observations} amb=${x.ambiguous}` +
        (x.error ? ` err=${x.error}` : ""),
    );
  }
  console.log("heliusSummary:", JSON.stringify(r.heliusSummary));

  if (r.writes) {
    console.log("\n=== STEP 5  writes ===");
    console.log(JSON.stringify(r.writes, null, 2));
  } else {
    console.log("\n(DRY — no writes. Re-run with --write to persist.)");
  }
}

main()
  .catch((e) => {
    console.error("[phase2-followup] failed", e);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
