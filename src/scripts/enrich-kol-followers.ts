/**
 * src/scripts/enrich-kol-followers.ts
 * Watcher enrichment ONLY — backfill X profile metadata for KolProfile rows
 * where followerCount IS NULL. No detection, no token scan.
 *
 * For each handle:
 *   - getUserByUsername() via the existing X API client
 *   - update followerCount, bio (if empty), lastEnrichedAt
 *
 * NOTE: KolProfile has no avatarUrl column (it lives on other models), so avatar
 * backfill is intentionally skipped here — would need an additive Neon migration.
 *   - suspended / not_found handles are skipped + logged (followerCount stays NULL)
 *
 * Idempotent (re-running only re-touches rows still at followerCount NULL).
 * Rate-limited: >=1s sleep between calls.
 *
 * Usage:
 *   pnpm tsx -r dotenv/config src/scripts/enrich-kol-followers.ts
 *   (DOTENV_CONFIG_PATH=.env.local for DATABASE_URL + X_BEARER_TOKEN)
 */

import { prisma } from "@/lib/prisma";
import { getUserByUsername, hasToken } from "@/lib/xapi/client";

const SLEEP_MS = 1_000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function bucket(n: number): string {
  if (n < 10_000) return "under_10k";
  if (n < 25_000) return "10k_25k";
  if (n < 50_000) return "25k_50k";
  if (n < 100_000) return "50k_100k";
  if (n < 250_000) return "100k_250k";
  return "over_250k";
}

const BUCKET_ORDER = [
  "under_10k",
  "10k_25k",
  "25k_50k",
  "50k_100k",
  "100k_250k",
  "over_250k",
];

async function main() {
  if (!hasToken()) {
    throw new Error("X_BEARER_TOKEN not configured — aborting");
  }

  const rows = await prisma.kolProfile.findMany({
    where: { followerCount: null },
    select: { id: true, handle: true, bio: true },
    orderBy: { handle: "asc" },
  });

  console.log(`[enrich] ${rows.length} KolProfile rows with followerCount IS NULL`);
  console.log(`[enrich] est. cost ~$${(rows.length * 0.01).toFixed(2)} (${rows.length} X API calls)\n`);

  let enriched = 0;
  let skipped = 0; // suspended / not_found / null response
  let errors = 0; // unexpected exceptions during update
  const skippedHandles: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tag = `[${i + 1}/${rows.length}] @${row.handle}`;

    let user;
    try {
      user = await getUserByUsername(row.handle);
    } catch (e) {
      errors++;
      console.error(`${tag} — ERROR during fetch: ${e}`);
      await sleep(SLEEP_MS);
      continue;
    }

    if (!user) {
      skipped++;
      skippedHandles.push(row.handle);
      console.warn(`${tag} — skipped (suspended / not_found / no response)`);
      await sleep(SLEEP_MS);
      continue;
    }

    const followers = user.public_metrics?.followers_count;
    if (typeof followers !== "number") {
      skipped++;
      skippedHandles.push(row.handle);
      console.warn(`${tag} — skipped (no public_metrics.followers_count)`);
      await sleep(SLEEP_MS);
      continue;
    }

    const data: {
      followerCount: number;
      lastEnrichedAt: Date;
      bio?: string;
    } = {
      followerCount: followers,
      lastEnrichedAt: new Date(),
    };
    // Only fill bio when currently empty (don't clobber curated data).
    if (!row.bio && user.description) data.bio = user.description;

    try {
      await prisma.kolProfile.update({ where: { id: row.id }, data });
      enriched++;
      console.log(`${tag} — ${followers.toLocaleString()} followers (${bucket(followers)})`);
    } catch (e) {
      errors++;
      console.error(`${tag} — ERROR during update: ${e}`);
    }

    await sleep(SLEEP_MS);
  }

  // ─── Final distribution across the FULL table ───────────────────
  const all = await prisma.kolProfile.findMany({
    where: { followerCount: { not: null } },
    select: { followerCount: true },
  });
  const dist: Record<string, number> = Object.fromEntries(
    BUCKET_ORDER.map((b) => [b, 0]),
  );
  for (const r of all) {
    if (typeof r.followerCount === "number") dist[bucket(r.followerCount)]++;
  }

  console.log("\n========================================");
  console.log("ENRICHMENT REPORT");
  console.log("========================================");
  console.log(`Total enriched:            ${enriched}`);
  console.log(`Total suspended/not found: ${skipped}`);
  console.log(`Total errors:              ${errors}`);
  if (skippedHandles.length) {
    console.log(`\nSkipped handles (${skippedHandles.length}):`);
    console.log("  " + skippedHandles.map((h) => `@${h}`).join(", "));
  }
  console.log("\nFinal distribution by follower bucket (all rows with followerCount):");
  for (const b of BUCKET_ORDER) {
    console.log(`  ${b.padEnd(12)} ${dist[b]}`);
  }
  console.log(`  ${"TOTAL".padEnd(12)} ${all.length}`);
  console.log("========================================");
}

main()
  .catch((e) => {
    console.error("[enrich] failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
