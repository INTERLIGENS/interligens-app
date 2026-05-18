// ─── Cluster discovery — all entities CLI ────────────────────────────────
// Walks every MmEntity and runs discoverNewWallets() one at a time with
// a 30s rate-limit pause between entities to stay under Etherscan /
// Helius quotas.
//
// Usage:
//   npx tsx scripts/mm/runDiscoveryAll.ts
//   npx tsx scripts/mm/runDiscoveryAll.ts --dry-run
//   npx tsx scripts/mm/runDiscoveryAll.ts --sleep 60

import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { prisma } from "@/lib/prisma";
import { discoverNewWallets } from "@/lib/mm/discovery/clusterDiscovery";

const DEFAULT_SLEEP_SECONDS = 30;

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { dryRun: boolean; sleepSeconds: number } = {
    dryRun: false,
    sleepSeconds: DEFAULT_SLEEP_SECONDS,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run" || a === "--dryRun") out.dryRun = true;
    if (a === "--sleep") {
      const n = Number.parseInt(args[++i] ?? "", 10);
      if (Number.isFinite(n) && n >= 0) out.sleepSeconds = n;
    }
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { dryRun, sleepSeconds } = parseArgs();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl?.includes("ep-square-band")) {
    throw new Error("refusing to run: DATABASE_URL is not ep-square-band");
  }

  const entities = await prisma.mmEntity.findMany({
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
  console.log(
    `[mm discovery-all] ${entities.length} entities, sleep=${sleepSeconds}s, dryRun=${dryRun}`,
  );

  const totals = {
    entities: 0,
    walletsTested: 0,
    newWalletsFound: 0,
    attributionsCreated: 0,
    errors: 0,
  };

  for (const [i, e] of entities.entries()) {
    console.log(`[mm discovery-all] (${i + 1}/${entities.length}) ${e.slug}`);
    try {
      const r = await discoverNewWallets(e.slug, { dryRun });
      totals.entities += 1;
      totals.walletsTested += r.walletsTested;
      totals.newWalletsFound += r.newWalletsFound;
      totals.attributionsCreated += r.attributionsCreated;
      totals.errors += r.errors.length;
      console.log(
        `  ↳ tested=${r.walletsTested} new=${r.newWalletsFound} persisted=${r.attributionsCreated} errors=${r.errors.length}`,
      );
    } catch (err) {
      totals.errors += 1;
      console.error(
        `  ↳ failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (i < entities.length - 1 && sleepSeconds > 0) {
      await sleep(sleepSeconds * 1_000);
    }
  }

  console.log("");
  console.log("────────────────────────────────────────");
  console.log("  Discovery — global summary");
  console.log("────────────────────────────────────────");
  console.log(`  Entities processed    : ${totals.entities}`);
  console.log(`  Wallets tested        : ${totals.walletsTested}`);
  console.log(`  New wallets found     : ${totals.newWalletsFound}`);
  console.log(`  Attributions created  : ${totals.attributionsCreated}`);
  console.log(`  Errors (total)        : ${totals.errors}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
