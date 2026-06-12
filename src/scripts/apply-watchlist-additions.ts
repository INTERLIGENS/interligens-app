/**
 * src/scripts/apply-watchlist-additions.ts
 * Apply the reviewed watchlist expansion (2026-06-12) to KolProfile.
 *   - 29 new rows, status='draft', isActive=true (DB default), label/tier per wave
 *   - follower counts from already-fetched X data (NO new API calls)
 *   - flag 4 broken reference anchors (internalNote), non-destructive
 * Idempotent: skips any handle already present (case-insensitive).
 *
 * Usage: pnpm tsx -r dotenv/config src/scripts/apply-watchlist-additions.ts [--write]
 *   (default DRY; pass --write to persist)
 */

import { prisma } from "@/lib/prisma";

type Add = { handle: string; followerCount: number | null; chainFocus: string };
const WAVES: { label: string; tier: string; rows: Add[] }[] = [
  {
    label: "signal_caller", tier: "T1",
    rows: [
      { handle: "scottmelker", followerCount: 1_085_845, chainFocus: "multi" },
      { handle: "TheCryptoDog", followerCount: 853_792, chainFocus: "multi" },
      { handle: "CryptoCred", followerCount: 777_220, chainFocus: "multi" },
      { handle: "MartiniGuyYT", followerCount: 706_755, chainFocus: "multi" },
      { handle: "Trader_XO", followerCount: 548_282, chainFocus: "multi" },
      { handle: "DaanCrypto", followerCount: 415_851, chainFocus: "multi" },
      { handle: "KoroushAK", followerCount: 378_207, chainFocus: "multi" },
      { handle: "CryptoBusy", followerCount: 187_549, chainFocus: "multi" },
      { handle: "52kskew", followerCount: 124_830, chainFocus: "multi" },
      { handle: "CryptoJelleNL", followerCount: 115_219, chainFocus: "multi" },
      { handle: "CastilloTrading", followerCount: 104_381, chainFocus: "multi" },
      { handle: "cryptoWZRD_", followerCount: 103_970, chainFocus: "multi" },
    ],
  },
  {
    label: "organic_mention", tier: "T2",
    rows: [
      { handle: "amitisinvesting", followerCount: 442_159, chainFocus: "multi" },
      { handle: "0xMerp", followerCount: 46_954, chainFocus: "SOL" },
      { handle: "0xRiver8", followerCount: 28_623, chainFocus: "SOL" },
      { handle: "0xCryptoshi", followerCount: 24_218, chainFocus: "SOL" },
      { handle: "0xEthan", followerCount: 87_160, chainFocus: "SOL" },
      { handle: "Jackkk", followerCount: 42_300, chainFocus: "SOL" },
      { handle: "0xMakesy", followerCount: 7_107, chainFocus: "SOL" },
      { handle: "0xuberM", followerCount: 16_347, chainFocus: "SOL" },
      { handle: "0xkyle__", followerCount: null, chainFocus: "SOL" }, // X not_found at fetch
      { handle: "0xBiZzy", followerCount: 46_267, chainFocus: "SOL" },
      { handle: "0xSammy", followerCount: 89_055, chainFocus: "SOL" },
      { handle: "0xIT4I", followerCount: 30_242, chainFocus: "SOL" },
      { handle: "0xAbhiP", followerCount: 60_755, chainFocus: "SOL" },
    ],
  },
  {
    label: "promo_watch", tier: "T3",
    rows: [
      { handle: "cryptogems555", followerCount: 445_895, chainFocus: "multi" },
      { handle: "Alanlegits", followerCount: 337_280, chainFocus: "multi" },
      { handle: "CryptoThro", followerCount: 210_958, chainFocus: "multi" },
      { handle: "alterfind_", followerCount: 209_623, chainFocus: "multi" },
    ],
  },
];

const ANCHOR_FLAGS: Record<string, string> = {
  jeremyybtc: "not_found_2026_06_12",
  apemp5: "suspended_2026_06_12",
  cryptostorm: "wrong_handle_2026_06_12",
  leochain0: "wrong_handle_2026_06_12",
};

async function main() {
  const write = process.argv.slice(2).includes("--write");
  console.log(`[apply] mode: ${write ? "WRITE" : "DRY"}\n`);

  const existing = new Set(
    (await prisma.kolProfile.findMany({ select: { handle: true } })).map((k) => k.handle.toLowerCase()),
  );

  const perWave: Record<string, { added: string[]; skipped: string[] }> = {};
  for (const wave of WAVES) {
    perWave[wave.label] = { added: [], skipped: [] };
    for (const r of wave.rows) {
      if (existing.has(r.handle.toLowerCase())) {
        perWave[wave.label].skipped.push(r.handle);
        continue;
      }
      if (write) {
        await prisma.kolProfile.create({
          data: {
            handle: r.handle,
            displayName: r.handle,
            label: wave.label,
            tier: wave.tier,
            status: "draft",
            followerCount: r.followerCount, // isActive defaults true at DB level
            ...(r.followerCount === null ? { internalNote: "x_not_found_at_add_2026_06_12" } : {}),
          },
        });
      }
      perWave[wave.label].added.push(r.handle);
      existing.add(r.handle.toLowerCase());
    }
    console.log(
      `[${wave.label}/${wave.tier}] add=${perWave[wave.label].added.length} skip=${perWave[wave.label].skipped.length}` +
        (perWave[wave.label].skipped.length ? ` (skipped: ${perWave[wave.label].skipped.join(", ")})` : ""),
    );
  }

  // Flag broken anchors (non-destructive: internalNote only, keep row + status).
  console.log("\n[anchors] flagging broken reference handles in KolProfile:");
  let flagged = 0;
  for (const [h, flag] of Object.entries(ANCHOR_FLAGS)) {
    if (write) {
      const n = await prisma.$executeRawUnsafe(
        `UPDATE "KolProfile" SET "internalNote" = $1 WHERE lower("handle") = lower($2)`,
        flag,
        h,
      );
      console.log(`  @${h.padEnd(14)} -> internalNote='${flag}' (${n} row)`);
      flagged += Number(n);
    } else {
      console.log(`  @${h.padEnd(14)} -> internalNote='${flag}' (DRY)`);
      flagged++;
    }
  }

  const totalAdded = Object.values(perWave).reduce((a, w) => a + w.added.length, 0);
  const totalSkipped = Object.values(perWave).reduce((a, w) => a + w.skipped.length, 0);
  console.log("\n========================================");
  console.log(`TOTAL added: ${totalAdded} | skipped(existing): ${totalSkipped} | anchors flagged: ${flagged}`);
  for (const wave of WAVES) console.log(`  ${wave.label.padEnd(16)} ${perWave[wave.label].added.length} added`);
  if (!write) console.log("\n(DRY — re-run with --write to persist)");
  console.log("========================================");
}

main()
  .catch((e) => { console.error("[apply] failed", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); process.exit(process.exitCode ?? 0); });
