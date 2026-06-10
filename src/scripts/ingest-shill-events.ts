/**
 * src/scripts/ingest-shill-events.ts
 * PHASE 2 manual trigger for the Shill Correlation Engine (shadow mode).
 *
 * Scans KolPromotionMention + SocialPostCandidate (read-only) and inserts new
 * ShillEvent rows. Idempotent — re-runs only insert previously-unseen events.
 *
 * Usage:
 *   pnpm tsx src/scripts/ingest-shill-events.ts            # full scan + write
 *   pnpm tsx src/scripts/ingest-shill-events.ts --dry      # build drafts, no write
 *   pnpm tsx src/scripts/ingest-shill-events.ts --since=2026-05-01 --limit=500
 *
 * DB target comes from DATABASE_URL (ep-square-band, pooled). Never db push.
 */

import { ingestShillEvents } from "@/lib/shill-correlation/ingest";
import type { IngestOptions } from "@/lib/shill-correlation/types";

function parseArgs(argv: string[]): IngestOptions {
  const opts: IngestOptions = {};
  for (const a of argv) {
    if (a === "--dry" || a === "--dry-run") {
      opts.dryRun = true;
    } else if (a.startsWith("--since=")) {
      const d = new Date(a.slice("--since=".length));
      if (!Number.isNaN(d.getTime())) opts.since = d;
    } else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) opts.limit = n;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log("[shill-correlation] ingest start", opts);
  const summary = await ingestShillEvents(opts);
  console.log(
    "[shill-correlation] ingest summary\n" + JSON.stringify(summary, null, 2),
  );
  if (summary.errors.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("[shill-correlation] ingest failed", e);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
