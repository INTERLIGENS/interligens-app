/**
 * Retail Vision Phase 6H — Seed wallets from Arkham Intelligence.
 *
 * Source: Arkham Intelligence entity/KOL tracking (April 2026).
 * 9 KOLs, mixed SOL + ETH wallets. Arkham is a confirmed-attribution
 * platform, so these wallets land as attributionStatus="confirmed",
 * confidence="high", isPubliclyUsable=true — EXCEPT ETH Friend.tech
 * wallets, which remain `review` / isPubliclyUsable=false pending
 * manual editorial check (Friend.tech self-links are not forensically
 * equivalent to Arkham's standard entity attribution).
 *
 * Rules:
 *   - Idempotent: dedup on (kolHandle, address) — case-insensitive
 *     handle match.
 *   - Fail soft: one failure doesn't stop the rest.
 *   - Create KolProfile as draft if absent (publishable=false,
 *     publishStatus="draft", displayName=handle).
 *
 * Dry-run par défaut. Pour écrire :
 *     SEED_ARKHAM=1 pnpm tsx src/scripts/seed/phase6hArkhamWallets.ts
 */
import { prisma } from "@/lib/prisma";

interface SeedEntry {
  handle: string;
  chain: "SOL" | "ETH";
  address: string;
  label?: string;
  // Friend.tech ETH wallets → publiclyUsable=false, status="review"
  friendtech?: boolean;
  // Optional per-wallet note suffix (e.g. "OpenSea primary")
  noteSuffix?: string;
}

const ARKHAM_NOTE_BASE =
  "Arkham Intelligence — wallet attribution via Arkham entity/KOL tracking (April 2026)";

const ENTRIES: SeedEntry[] = [
  // ── GordonGekko (SOL × 8) ──────────────────────────────────────────────
  { handle: "GordonGekko", chain: "SOL", address: "EshePcy1RMFQxLTju2wZhXkjUCFuvrHoFsqgoyEY2dtE", label: "arkham:EsheP" },
  { handle: "GordonGekko", chain: "SOL", address: "6LWfpKyK9TqYeH3JVh5S6UkvhVCwDh9xoy2Yksf8AobN", label: "arkham:6LWfp" },
  { handle: "GordonGekko", chain: "SOL", address: "4RGhiFfRM2X6jHX4FCd84XnHqiEizJVyCRB7K6kWwkTk", label: "arkham:4RGhi" },
  { handle: "GordonGekko", chain: "SOL", address: "92cbCAtS7P41RMM8a4mHnDxFf62LRjkXG6ijb3sZJD4k", label: "arkham:92cbC" },
  { handle: "GordonGekko", chain: "SOL", address: "5FqraQVN9h3KCm5MFZVUjyy9cxgtjjQhsG8d49SaDish", label: "arkham:5Fqra" },
  { handle: "GordonGekko", chain: "SOL", address: "5dFS77phioUb1sxzWiwb62qndihLLQgCrhNpBh9yq19v", label: "arkham:5dFS7" },
  { handle: "GordonGekko", chain: "SOL", address: "4yscBpfbcB1wmviW4854CYqVz1KgjKoKRpg4uf5XSLe3", label: "arkham:4yscB" },
  { handle: "GordonGekko", chain: "SOL", address: "4hTdXks2jzySX5Lk7J8Rs1grj5Sx5Wk3nL9HqxdtmQqa", label: "arkham:4hTdX" },

  // ── bkokoski (ETH — Friend.tech → review) ──────────────────────────────
  { handle: "bkokoski", chain: "ETH", address: "0xC71FC27bdD2Eb8B6aA676d2cB8BD2357fC94FB18", friendtech: true, label: "arkham:friendtech" },

  // ── lynk0x (SOL × 6) ───────────────────────────────────────────────────
  { handle: "lynk0x", chain: "SOL", address: "6DBFUngmz6BVQNF9dpBcavsgZreQK9jb2TeK4Q6sxbdJ" },
  { handle: "lynk0x", chain: "SOL", address: "9tKeCiY99eh2UQDQFZgARAP7uY42FjGH27eJjqwKZKan" },
  { handle: "lynk0x", chain: "SOL", address: "34VvuZe8Kb2orJuzKqkZ2Lc4di1FryLWWmtZSTiqTid3" },
  { handle: "lynk0x", chain: "SOL", address: "ECJz2Q5kK7CEQc6efFs4iM5GQ9uS6neC4t25AwgFEPvx" },
  { handle: "lynk0x", chain: "SOL", address: "CkPFGv2Wv1vwdWjtXioEgb8jhZQfs3eVZez3QCetu7xD" },
  { handle: "lynk0x", chain: "SOL", address: "5EBv3dWXkwCEZCz63zhDpxdJTnpkzrxwhP4bL7GRz4iV" },

  // ── eddyxbt (SOL × 5) ──────────────────────────────────────────────────
  { handle: "eddyxbt", chain: "SOL", address: "791FqduegwAG16TqGdpAvFcuKQGct5Tv38yfDSUcGuLg" },
  { handle: "eddyxbt", chain: "SOL", address: "95gwhXEzRqjJJHJrnFARCbCS5yYRNQrKKA1C5bLDTrWF" },
  { handle: "eddyxbt", chain: "SOL", address: "AtzA6w7G7GJYdNsZmyDne6kT6ZeX1aPRK9AsswwKKjfM" },
  { handle: "eddyxbt", chain: "SOL", address: "93nQrxEF8YpJqdcvipvLKDrdemQYxpPb9bCf57t2WFt3" },
  { handle: "eddyxbt", chain: "SOL", address: "2jknmaF6xHJhZ2bdWPoV1E1MAuxFcRedHNgHczLuVG2p" },

  // ── CookerFlips (SOL) ──────────────────────────────────────────────────
  { handle: "CookerFlips", chain: "SOL", address: "7jy1TbdT1d14yr1tkdQSNyMqToFm2FdMVHz65v5JJU6z" },

  // ── blknoiz06 / Ansem (multi-chain) ────────────────────────────────────
  { handle: "blknoiz06", chain: "SOL", address: "DUiSaGggAFVfnzGJVADxJtu2xqny5DKi4hDLdJVjgMMn" },
  { handle: "blknoiz06", chain: "ETH", address: "0xE9825fD47c5D863b1AeCbA3707aBcc7c8B49b88d", friendtech: true, label: "arkham:friendtech" },
  { handle: "blknoiz06", chain: "ETH", address: "0x03A101901BaFA5d179aDa227B3fC2c3CEc4cE000", label: "arkham:opensea", noteSuffix: "OpenSea primary" },
  { handle: "blknoiz06", chain: "SOL", address: "HAs8hvTB8ZH6dBG26KQGik4fxitNYi41jnYd49bvtime" },

  // ── thedefiape (SOL) ───────────────────────────────────────────────────
  { handle: "thedefiape", chain: "SOL", address: "EJJY8PTowweitmGN6YpYpgzZbqPcMscjE4esDYff44Wu" },

  // ── noahhcalls (SOL × 4) ───────────────────────────────────────────────
  { handle: "noahhcalls", chain: "SOL", address: "GepdiuCTcgD2PV9VfbqtTJBL5Z1uwX2ZXEYhrrf6odcs" },
  { handle: "noahhcalls", chain: "SOL", address: "BQHYdi3us498fZyPjsTcYpYmqdMnqarzQBFrUVJ2Lv4P" },
  { handle: "noahhcalls", chain: "SOL", address: "9mtwJwy2CokPUrcBNepexzUGBgPnEX1UEQeTHb89Xc7L" },
  { handle: "noahhcalls", chain: "SOL", address: "36Z6uvT71JhVVLEHdNL64vDr35fhpFiwhPiJUUhu7Zig" },

  // ── solfistooshort (SOL × 2) ───────────────────────────────────────────
  { handle: "solfistooshort", chain: "SOL", address: "ABNktzUGgEaoT7SBvmt8geRuAuataVwPr7sGvEWZpoaz" },
  { handle: "solfistooshort", chain: "SOL", address: "HrzwmVvcVkCxqGqkJ6gZvFmkDHRemmnPRKs5ogyCpssu" },
];

interface SeedResult {
  inputEntries: number;
  profilesCreated: number;
  profilesExisting: number;
  walletsCreated: number;
  walletsSkippedExisting: number;
  walletsReviewOnly: number;
  errors: number;
}

async function seed(dryRun: boolean): Promise<SeedResult> {
  const result: SeedResult = {
    inputEntries: ENTRIES.length,
    profilesCreated: 0,
    profilesExisting: 0,
    walletsCreated: 0,
    walletsSkippedExisting: 0,
    walletsReviewOnly: 0,
    errors: 0,
  };

  // Pre-fetch existing profiles (case-insensitive).
  const uniqueHandles = Array.from(new Set(ENTRIES.map((e) => e.handle)));
  const existingProfiles = await prisma.kolProfile.findMany({
    where: { handle: { in: uniqueHandles, mode: "insensitive" } },
    select: { handle: true },
  });
  const profileMap = new Map<string, string>(); // lc → canonical
  for (const p of existingProfiles) {
    profileMap.set(p.handle.toLowerCase(), p.handle);
  }
  result.profilesExisting = profileMap.size;

  for (const entry of ENTRIES) {
    const handleLc = entry.handle.toLowerCase();
    let canonicalHandle = profileMap.get(handleLc);

    // Step 1 — ensure profile exists (create draft if absent).
    if (!canonicalHandle) {
      if (dryRun) {
        result.profilesCreated += 1;
        canonicalHandle = entry.handle;
        profileMap.set(handleLc, canonicalHandle);
        console.log(
          `[6h:arkham] WOULD create profile ${entry.handle} (draft)`
        );
      } else {
        try {
          const created = await prisma.kolProfile.create({
            data: {
              handle: entry.handle,
              displayName: entry.handle,
              platform: "x",
              publishable: false,
              publishStatus: "draft",
            },
            select: { handle: true },
          });
          canonicalHandle = created.handle;
          profileMap.set(handleLc, canonicalHandle);
          result.profilesCreated += 1;
          console.log(
            `[6h:arkham] profile created ${entry.handle} (draft)`
          );
        } catch (err) {
          result.errors += 1;
          console.warn(
            `[6h:arkham] profile create failed for ${entry.handle}`,
            err instanceof Error ? err.message : err
          );
          continue;
        }
      }
    }

    // Step 2 — wallet upsert (dedup on kolHandle+address, any chain).
    try {
      const existing = await prisma.kolWallet.findFirst({
        where: {
          kolHandle: canonicalHandle!,
          address: entry.address,
        },
        select: { id: true, chain: true, attributionSource: true },
      });
      if (existing) {
        result.walletsSkippedExisting += 1;
        console.log(
          `[6h:arkham] skip existing ${canonicalHandle} ${entry.address} (chain=${existing.chain}, src=${existing.attributionSource ?? "—"})`
        );
        continue;
      }

      const isReview = entry.friendtech === true;
      const attributionStatus = isReview ? "review" : "confirmed";
      const isPubliclyUsable = !isReview;
      const label = entry.label ?? "arkham:kol";
      const noteParts = [
        ARKHAM_NOTE_BASE,
        isReview ? "Friend.tech (Base) self-link — manual review required" : null,
        entry.noteSuffix ?? null,
      ].filter(Boolean);
      const attributionNote = noteParts.join(" — ");

      if (isReview) result.walletsReviewOnly += 1;

      if (dryRun) {
        result.walletsCreated += 1;
        console.log(
          `[6h:arkham] WOULD create wallet ${canonicalHandle} ${entry.address} [${entry.chain}] status=${attributionStatus} usable=${isPubliclyUsable}`
        );
        continue;
      }

      await prisma.kolWallet.create({
        data: {
          kolHandle: canonicalHandle!,
          address: entry.address,
          chain: entry.chain,
          label,
          confidence: "high",
          attributionSource: "arkham_intel",
          attributionNote,
          attributionStatus,
          isPubliclyUsable,
          discoveredAt: new Date(),
        },
      });
      result.walletsCreated += 1;
      console.log(
        `[6h:arkham] wallet created ${canonicalHandle} ${entry.address} [${entry.chain}] status=${attributionStatus}`
      );
    } catch (err) {
      result.errors += 1;
      console.warn(
        `[6h:arkham] wallet upsert failed for ${canonicalHandle ?? entry.handle} ${entry.address}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return result;
}

async function main() {
  const dryRun = process.env.SEED_ARKHAM !== "1";
  console.log(`[6h-arkham] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);
  console.log(`[6h-arkham] entries=${ENTRIES.length}`);

  const result = await seed(dryRun);
  console.log("[6h-arkham] RESULT:", result);
  console.log(`[6h-arkham] mode=${dryRun ? "DRY-RUN" : "WRITE"} — done`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[6h-arkham] fatal", e);
  process.exit(1);
});
