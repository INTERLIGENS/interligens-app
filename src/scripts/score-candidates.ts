/**
 * src/scripts/score-candidates.ts
 * PHASE 4 — aggregate observations into ShillCorrelationCandidate + score.
 * DRY by default (writes nothing). --write to persist.
 *
 * Usage:
 *   pnpm tsx -r dotenv/config src/scripts/score-candidates.ts            # dry, top 20
 *   ... --top=40
 *   ... --write
 *
 * Needs DATABASE_URL (DOTENV_CONFIG_PATH=.env.local). No on-chain / X calls.
 */

import { aggregateCandidates } from "@/lib/shill-correlation/aggregate";

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = !argv.includes("--write");
  const topArg = argv.find((a) => a.startsWith("--top="));
  const top = topArg ? parseInt(topArg.slice("--top=".length), 10) : 20;

  console.log("[score-candidates] start", { mode: dryRun ? "DRY (no writes)" : "WRITE" });
  const r = await aggregateCandidates({ dryRun });

  console.log("\n=== aggregation ===");
  console.log("observationsScanned:", r.observationsScanned, "| analyzableEvents:", r.analyzableEvents);
  console.log("candidates:", r.candidates.length,
    "| shortlistEligible:", r.shortlistEligible, "| seriousCandidates:", r.seriousCandidates);
  console.log("byClassification:", JSON.stringify(r.byClassification));
  console.log("byConfidence:", JSON.stringify(r.byConfidence));

  console.log(`\n=== top ${Math.min(top, r.candidates.length)} by correlationScore ===`);
  console.log("score  rec   spec  tim   exit  sniper | obs/anz pre/near/post kols | class / conf | kol -> wallet");
  for (const c of r.candidates.slice(0, top)) {
    const s = c.scores;
    const pad = (n: number, w = 5) => String(n).padStart(w);
    console.log(
      `${pad(s.correlationScore)} ${pad(s.recurrenceScore)} ${pad(s.specificityScore)} ${pad(s.timingScore)} ${pad(s.exitScore)} ${pad(s.genericSniperPenalty)} | ` +
      `${c.observedShillCount}/${c.analyzableShillCount} ${c.preTweetCount}/${c.nearTweetCount}/${c.postTweetCount} k${c.distinctKolCount} | ` +
      `${s.classification}/${s.confidence} | ${c.kolHandle} -> ${c.wallet.slice(0, 8)}…`,
    );
  }

  if (r.written != null) console.log("\n=== writes ===\nupserted candidates:", r.written);
  else console.log("\n(DRY — no writes. Re-run with --write to persist.)");
}

main()
  .catch((e) => { console.error("[score-candidates] failed", e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
