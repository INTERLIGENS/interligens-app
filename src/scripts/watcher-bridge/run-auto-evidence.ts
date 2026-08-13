// Manual batch runner for the Watcher Bridge auto-evidence creator (Sprint 3).
// NOT wired into the cron. Invoke manually:
//   npx tsx src/scripts/watcher-bridge/run-auto-evidence.ts --dry-run --limit 10
//   npx tsx src/scripts/watcher-bridge/run-auto-evidence.ts --ids id1,id2,id3
//   npx tsx src/scripts/watcher-bridge/run-auto-evidence.ts --limit 50   (live)
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { runAutoEvidenceBatch } from "@/lib/watcher-bridge/createAutoEvidenceSnapshot";
import { PrismaEvidenceStore } from "@/lib/evidence-chain/store/prisma";
import { evidenceR2ConfigFromEnv, buildEvidenceR2 } from "@/lib/evidence-chain/r2";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const idsArg = args.find((a) => a.startsWith("--ids="))?.split("=")[1]
    ?? (args.includes("--ids") ? args[args.indexOf("--ids") + 1] : undefined);
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1]
    ?? (args.includes("--limit") ? args[args.indexOf("--limit") + 1] : undefined);

  const candidateIds = idsArg ? idsArg.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  const prisma = new PrismaClient();
  try {
    // Chaîne de preuve (CC-OFFLINE-56) : artefact JSON canonique par candidate.
    // Script lancé depuis un host avec openssl → TSA tentée au fil de l'eau.
    const cfg = evidenceR2ConfigFromEnv();
    const chain = dryRun ? null : {
      store: new PrismaEvidenceStore(prisma),
      r2: cfg ? { s3: buildEvidenceR2(cfg), bucket: cfg.bucket } : null,
      tsaEnabled: true,
    };
    const summary = await runAutoEvidenceBatch(prisma, { candidateIds, limit, dryRun, chain });
    console.log(JSON.stringify({ mode: dryRun ? "DRY_RUN" : "LIVE", ...summary }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
