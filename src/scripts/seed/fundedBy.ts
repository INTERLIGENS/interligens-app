/**
 * Retail Vision — funded-by seed script.
 *
 * Dry-run by default. To actually upsert rows, run with:
 *   SEED_FUNDEDBY=1 pnpm tsx src/scripts/seed/fundedBy.ts
 *
 * Results are appended to MIGRATION_RETAILVISION.md section "FundedBy Results".
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resolveFundedBy, type FundedByResult } from "@/lib/helius/fundedBy";

const DOC_PATH = path.join(process.cwd(), "MIGRATION_RETAILVISION.md");

async function main() {
  const dryRun = process.env.SEED_FUNDEDBY !== "1";
  const wallets = await prisma.kolWallet.findMany({
    where: { chain: { in: ["SOL", "SOLANA"] }, status: "active" },
    select: { id: true, address: true, chain: true, kolHandle: true },
  });

  console.log(`[fundedBy seed] ${wallets.length} wallets (dryRun=${dryRun})`);

  if (dryRun) {
    for (const w of wallets.slice(0, 5)) {
      console.log(`  would resolve ${w.kolHandle} ${w.address}`);
    }
    console.log("Set SEED_FUNDEDBY=1 to execute.");
    return;
  }

  const results: FundedByResult[] = [];
  let okCount = 0;
  let edgeCount = 0;
  let projectLinked = 0;

  for (const w of wallets) {
    const r = await resolveFundedBy(w.id);
    results.push(r);
    if (r.ok) okCount++;
    if (r.edgeId) edgeCount++;
    if (r.isProjectLinked) projectLinked++;
    console.log(`  ${w.kolHandle} ${w.address} -> ${r.edgeId ?? r.error ?? "noop"}`);
    await new Promise((res) => setTimeout(res, 150));
  }

  const errors = results.filter((r) => !r.ok);
  const ts = new Date().toISOString();
  const row = `| ${ts} | ${wallets.length} | ${edgeCount} | ${projectLinked} | ${errors.length} |\n`;

  try {
    const doc = await fs.readFile(DOC_PATH, "utf8");
    if (doc.includes("No runs yet.")) {
      await fs.writeFile(DOC_PATH, doc.replace("No runs yet.\n", row));
    } else {
      await fs.writeFile(DOC_PATH, doc + row);
    }
  } catch (err) {
    console.error("Failed to append results to MIGRATION_RETAILVISION.md:", err);
  }

  console.log(`[fundedBy seed] done. ok=${okCount} edges=${edgeCount} projectLinked=${projectLinked} errors=${errors.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
