// ─── Cluster discovery — single entity CLI ───────────────────────────────
// Usage:
//   npx tsx scripts/mm/runDiscovery.ts --entity gotbit
//   npx tsx scripts/mm/runDiscovery.ts --entity gotbit --dry-run
//   npx tsx scripts/mm/runDiscovery.ts --entity gotbit --max 10

import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { prisma } from "@/lib/prisma";
import { discoverNewWallets } from "@/lib/mm/discovery/clusterDiscovery";

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { entity?: string; dryRun: boolean; max?: number } = {
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--entity") {
      out.entity = args[++i];
    } else if (a === "--dry-run" || a === "--dryRun") {
      out.dryRun = true;
    } else if (a === "--max") {
      const n = Number.parseInt(args[++i] ?? "", 10);
      if (Number.isFinite(n)) out.max = n;
    }
  }
  return out;
}

async function main() {
  const { entity, dryRun, max } = parseArgs();
  if (!entity) {
    console.error("usage: tsx scripts/mm/runDiscovery.ts --entity <slug> [--dry-run] [--max N]");
    process.exit(1);
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl?.includes("ep-square-band")) {
    throw new Error("refusing to run: DATABASE_URL is not ep-square-band");
  }
  console.log(`[mm discovery] entity=${entity} dryRun=${dryRun} max=${max ?? "default"}`);
  const r = await discoverNewWallets(entity, {
    dryRun,
    maxSeedWallets: max,
  });
  console.log("");
  console.log("────────────────────────────────────────");
  console.log(`  Discovery — ${r.entitySlug}`);
  console.log("────────────────────────────────────────");
  console.log(`  Wallets tested       : ${r.walletsTested}`);
  console.log(`  New wallets found    : ${r.newWalletsFound}`);
  console.log(`  Attributions created : ${r.attributionsCreated}`);
  console.log(`  Clusters flagged     : ${r.clusters.length}`);
  console.log(`  Errors               : ${r.errors.length}`);
  if (r.clusters.length > 0) {
    console.log("  ──");
    for (const c of r.clusters.slice(0, 10)) {
      console.log(
        `   • cluster ${c.internalClusterId.slice(0, 20)}… seed=${c.seedWallet.slice(0, 10)}… +${c.newWallets.length} new wallets`,
      );
    }
  }
  if (r.errors.length > 0) {
    console.log("  ──");
    for (const e of r.errors.slice(0, 10)) {
      console.log(`   ! ${e.seedWallet} → ${e.message}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
