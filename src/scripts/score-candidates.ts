/**
 * src/scripts/score-candidates.ts
 * PHASE 4 / 4.5 / 4.6 — aggregate observations into ShillCorrelationCandidate,
 * apply static router blacklist + dynamic Helius bot/router vetting, score.
 * DRY by default (writes nothing). --write to persist.
 *
 * Usage:
 *   pnpm tsx -r dotenv/config src/scripts/score-candidates.ts            # dry, top 20, vetting on
 *   ... --top=40
 *   ... --no-vet     # skip Helius vetting (static router filter only)
 *   ... --write      # persist candidates + exclusions
 *
 * Needs DATABASE_URL (+ HELIUS_API_KEY when vetting). DOTENV_CONFIG_PATH=.env.local.
 */

import { aggregateCandidates } from "@/lib/shill-correlation/aggregate";
import { fetchWalletProfile } from "@/lib/shill-correlation/wallet-profile";
import { classifyWalletProfile, type VetVerdict } from "@/lib/shill-correlation/vetting";

function makeVetter(nowSec: number) {
  let calls = 0;
  const vet = async (wallet: string): Promise<VetVerdict> => {
    const profile = await fetchWalletProfile(wallet, nowSec);
    calls += profile.heliusCalls;
    return classifyWalletProfile(profile);
  };
  return { vet, getCalls: () => calls };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = !argv.includes("--write");
  const vet = !argv.includes("--no-vet");
  const topArg = argv.find((a) => a.startsWith("--top="));
  const top = topArg ? parseInt(topArg.slice("--top=".length), 10) : 20;

  console.log("[score-candidates] start", {
    mode: dryRun ? "DRY (no writes)" : "WRITE",
    vetting: vet ? "ON (Helius)" : "OFF",
  });

  const now = new Date();
  const vetter = vet ? makeVetter(Math.floor(now.getTime() / 1000)) : null;
  const r = await aggregateCandidates({
    dryRun,
    now,
    vetWallet: vetter?.vet,
  });

  console.log("\n=== aggregation ===");
  console.log(
    "observations:", r.observationsScanned,
    "| analyzableEvents:", r.analyzableEvents,
    "| analyzableKols:", r.analyzableKols,
    "| total candidates:", r.candidates.length,
  );
  console.log(
    "exclusions:", r.exclusions.total, JSON.stringify(r.exclusions.byReason),
    "| walletsVetted:", r.walletsVetted,
    vetter ? `| heliusVettingCalls: ${vetter.getCalls()}` : "",
  );
  console.log(
    "SURVIVING:", r.surviving.length,
    "| byClassification:", JSON.stringify(r.byClassification),
    "| shortlist:", r.shortlistEligible,
    "| serious:", r.seriousCandidates,
  );

  console.log(`\n=== top ${Math.min(top, r.surviving.length)} SURVIVING candidates ===`);
  console.log("score  rec   spec  tim   sniper | obs/anz pre/near/post kols | tx30d toks | class/conf | kol -> wallet");
  for (const c of r.surviving.slice(0, top)) {
    const s = c.scores;
    const p = (n: number, w = 5) => String(n).padStart(w);
    console.log(
      `${p(s.correlationScore)} ${p(s.recurrenceScore)} ${p(s.specificityScore)} ${p(s.timingScore)} ${p(s.genericSniperPenalty)} | ` +
      `${c.observedShillCount}/${c.analyzableShillCount} ${c.preTweetCount}/${c.nearTweetCount}/${c.postTweetCount} k${c.distinctKolCount} | ` +
      `${c.walletTxCount30d ?? "-"} ${c.walletTokenAccounts ?? "-"} | ` +
      `${s.classification}/${s.confidence} | ${c.kolHandle} -> ${c.wallet.slice(0, 8)}…`,
    );
  }

  // Show the EXCLUDED recurring candidates (obs>=2) so over-exclusion is visible.
  const excludedMeaningful = r.candidates
    .filter((c) => c.excludedReason != null && c.observedShillCount >= 2)
    .sort((a, b) => b.scores.correlationScore - a.scores.correlationScore)
    .slice(0, 20);
  console.log(`\n=== excluded recurring candidates (obs>=2), top ${excludedMeaningful.length} ===`);
  console.log("score | obs/anz pre/near/post kols | tx30d toks | reason | kol -> wallet");
  for (const c of excludedMeaningful) {
    console.log(
      `${String(c.scores.correlationScore).padStart(5)} | ` +
      `${c.observedShillCount}/${c.analyzableShillCount} ${c.preTweetCount}/${c.nearTweetCount}/${c.postTweetCount} k${c.distinctKolCount} | ` +
      `${c.walletTxCount30d ?? "-"} ${c.walletTokenAccounts ?? "-"} | ${c.excludedReason} | ${c.kolHandle} -> ${c.wallet.slice(0, 8)}…`,
    );
  }

  if (r.written != null) console.log("\n=== writes ===\nupserted candidates:", r.written);
  else console.log("\n(DRY — no writes. Re-run with --write to persist.)");
}

main()
  .catch((e) => { console.error("[score-candidates] failed", e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
