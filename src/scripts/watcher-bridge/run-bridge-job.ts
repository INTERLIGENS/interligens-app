// Manual runner for the Watcher Bridge cron-safety job (NOT a cron).
//   npx tsx src/scripts/watcher-bridge/run-bridge-job.ts --dry-run --limit 5
//   WATCHER_BRIDGE_ENABLED=true npx tsx src/scripts/watcher-bridge/run-bridge-job.ts --limit 25
// Kill switch honoured: without WATCHER_BRIDGE_ENABLED=true it is a no-op
// (writes a JobRunLog status='disabled').
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { runBridgeJob } from "@/lib/watcher-bridge/runBridgeJob";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1]
    ?? (args.includes("--limit") ? args[args.indexOf("--limit") + 1] : undefined);
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  const prisma = new PrismaClient();
  try {
    const r = await runBridgeJob(prisma, {
      ...(dryRun ? { dryRun: true } : {}),
      ...(limit != null ? { limit } : {}),
    });
    // Print metrics without the (potentially large) per-candidate results array.
    const summary = r.summary ? { ...r.summary, results: `[${r.summary.results.length} results omitted]` } : null;
    console.log(JSON.stringify({ status: r.status, dryRun: r.dryRun, jobRunLogId: r.jobRunLogId, reason: r.reason, summary }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
