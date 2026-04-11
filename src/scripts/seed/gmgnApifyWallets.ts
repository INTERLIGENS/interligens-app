/**
 * Retail Vision Phase 6G-bis — Seed GMGN KOL wallets (Apify export).
 *
 * Source : GMGN KOL Monitor, April 2026 Apify export. Chaque entry est
 * un handle Twitter + un wallet Solana taggué `kol` sur GMGN.
 *
 * Rules :
 *   - Profile missing → create draft (platform="x", publishable=false,
 *     publishStatus="draft")
 *   - Idempotent : skip si (kolHandle, address) déjà présent
 *   - Fail soft : une erreur par entry est comptée, la boucle continue
 *   - attributionStatus="review", isPubliclyUsable=false — signal
 *     community non vérifié
 *
 * Dry-run par défaut. Pour écrire :
 *     SEED_GMGN=1 pnpm tsx src/scripts/seed/gmgnApifyWallets.ts
 */
import { prisma } from "@/lib/prisma";

interface SeedEntry {
  handle: string;
  wallet: string;
}

const ATTRIBUTION_SOURCE = "gmgn_apify_2026";
const ATTRIBUTION_NOTE =
  "GMGN KOL Monitor — tag kol confirmé, April 2026";

const KOLS: SeedEntry[] = [
  { handle: "AlekssRG", wallet: "8gW5oJqmrDk7Ja8kpTcwba3tDFx4PuexgYg9QdCCZDiM" },
  { handle: "Bofofbow", wallet: "9kdkBsuwmxHtsr3GBQDygFSmaW7p42SyboNqTfaH5L8M" },
  { handle: "CookerFlips", wallet: "8deJ9xeUvXSJwicYptA9mHsU2rN2pDx37KWzkDkEXhU6" },
  { handle: "Cupseyy", wallet: "suqh5sHtr8HyJ7q8scBimULPkPpA557prMG47xCHQfK" },
  { handle: "Esee06257", wallet: "4uCT4g7YHH4xxfmfNfKUDenwGrRNGoZ9Ay1XFxfUGhQG" },
  { handle: "FASHRCrypto", wallet: "719sfKUjiMThumTt2u39VMGn612BZyCcwbM5Pe8SqFYz" },
  { handle: "KayTheDoc", wallet: "DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt" },
  { handle: "Limfork", wallet: "BQVz7fQ1WsQmSTMY3umdPEPPTm1sdcBcX9sP7o6kPRmB" },
  { handle: "Lowskii_gg", wallet: "41uh7g1DxYaYXdtjBiYCHcgBniV9Wx57b7HU7RXmx1Gg" },
  { handle: "MBGBuzzer", wallet: "7wZExpdax4ocdQGyw9YPaEnwpMhz4sDrzLouDcHRRgBN" },
  { handle: "MageArez", wallet: "65NRohHfdjJhm7oW9kvPfvT8jRWpxg2KbhecVGQSJ3jR" },
  { handle: "Mystayor", wallet: "5qWge4zUyQenk53EhAAQ5yP4LWxuvdqJpRBZZbGd4tv9" },
  { handle: "SQester", wallet: "EEzVPVJmt6u7qPpAN8LwaASpLxBujB3frFuUgRZS5TGm" },
  { handle: "ShrekCrypto_", wallet: "DePxtKV64QagrqRECzPwNUUexSG26whjmxS8bXMG86YV" },
  { handle: "TheRealZrool", wallet: "99i9uVA7Q56bY22ajKKUfTZTgTeP5yCtVGsrG9J4pDYQ" },
  { handle: "VeloceSVJ", wallet: "2W14ahXD3XBfWJchQ4K5NLXmguWWcTTUTuHDhEzeuvP3" },
  { handle: "Zemrics", wallet: "EP5mvfhGv6x1XR33Fd8eioiYjtRXAawafPmkz9xBpDvG" },
  { handle: "assasin_eth", wallet: "6LChaYRYtEYjLEHhzo4HdEmgNwu2aia8CM8VhR9wn6n7" },
  { handle: "daumenxyz", wallet: "8MaVa9kdt3NW4Q5HyNAm1X5LbR8PQRVDc1W8NMVK88D5" },
  { handle: "deecayz", wallet: "Dv32u9mvSXGVNshf7xM7afuMoPRifQxzuzEjfmfMysZY" },
  { handle: "ieatjeets", wallet: "D1H83ueSw5Nxy5okxH7VBfV4jRnqAK5Mm1tm3JAj3m5t" },
  { handle: "igndex", wallet: "mW4PZB45isHmnjGkLpJvjKBzVS5NXzTJ8UDyug4gTsM" },
  { handle: "insidecalls", wallet: "4NtyFqqRzvHWsTmJZoT26H9xtL7asWGTxpcpCxiKax9a" },
  { handle: "jijo_exe", wallet: "4BdKaxN8G6ka4GYtQQWk4G4dZRUTX2vQH9GcXdBREFUk" },
  { handle: "kilorippy", wallet: "kiLogfWUXp7nby7Xi6R9t7u8ERQyRdAzg6wBjvuE49u" },
  { handle: "kreo444", wallet: "BCnqsPEtA1TkgednYEebRpkmwFRJDCjMQcKZMMtEdArc" },
  { handle: "notdecu", wallet: "4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9" },
  { handle: "orangie", wallet: "DuQabFqdC9eeBULVa7TTdZYxe8vK8ct5DZr4Xcf7docy" },
  { handle: "pullupso", wallet: "65paNEG8m7mCVoASVF2KbRdU21aKXdASSB9G3NjCSQuE" },
  { handle: "radiancebrr", wallet: "FAicXNV5FVqtfbpn4Zccs71XcfGeyxBSGbqLDyDJZjke" },
  { handle: "s1mple_s1mple", wallet: "AeLaMjzxErZt4drbWVWvcxpVyo8p94xu5vrg41eZPFe3" },
  { handle: "shahh", wallet: "7xwDKXNG9dxMsBSCmiAThp7PyDaUXbm23irLr7iPeh7w" },
  { handle: "shenron__1", wallet: "BxpFcT9fkZwKHuvXPKcfxo6k5v28VJdzozXD2scAgsn" },
  { handle: "silverpencil234", wallet: "BtMBMPkoNbnLF9Xn552guQq528KKXcsNBNNBre3oaQtr" },
  { handle: "theonomix", wallet: "Bi4rd5FH5bYEN8scZ7wevxNZyNmKHdaBcvewdPFxYdLt" },
  { handle: "trenchguerilla", wallet: "9St6ETbe3CFitw6UNSd8kg7kZ6STXy71wEGiERqQj89U" },
  { handle: "untaxxable", wallet: "2T5NgDDidkvhJQg8AHDi74uCFwgp25pYFMRZXBaCUNBH" },
  { handle: "xrpvibes", wallet: "2vmSJAobSX3CrDdMBfYq1tT5wzmguTxWSSitoqQV9ft4" },
];

interface Result {
  inputEntries: number;
  profilesCreated: number;
  walletsCreated: number;
  walletsSkippedExisting: number;
  errors: number;
}

async function main() {
  const dryRun = process.env.SEED_GMGN !== "1";
  console.log(`[gmgn-seed] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  // Pre-fetch all existing profiles (case-insensitive).
  const inputHandles = KOLS.map((k) => k.handle);
  const existingProfiles = await prisma.kolProfile.findMany({
    where: { handle: { in: inputHandles, mode: "insensitive" } },
    select: { handle: true },
  });
  const profileMap = new Map<string, string>();
  for (const p of existingProfiles) {
    profileMap.set(p.handle.toLowerCase(), p.handle);
  }

  const result: Result = {
    inputEntries: KOLS.length,
    profilesCreated: 0,
    walletsCreated: 0,
    walletsSkippedExisting: 0,
    errors: 0,
  };

  for (const k of KOLS) {
    const handleLc = k.handle.toLowerCase();
    let canonicalHandle = profileMap.get(handleLc);

    // Step 1 — profile upsert
    if (!canonicalHandle) {
      if (dryRun) {
        result.profilesCreated += 1;
        canonicalHandle = k.handle;
        profileMap.set(handleLc, canonicalHandle);
      } else {
        try {
          const created = await prisma.kolProfile.create({
            data: {
              handle: k.handle,
              displayName: k.handle,
              platform: "x",
              publishable: false,
              publishStatus: "draft",
            },
            select: { handle: true },
          });
          canonicalHandle = created.handle;
          profileMap.set(handleLc, canonicalHandle);
          result.profilesCreated += 1;
          console.log(`[gmgn-seed] profile created ${k.handle} (draft)`);
        } catch (err) {
          result.errors += 1;
          console.warn(
            `[gmgn-seed] profile create failed for ${k.handle}`,
            err instanceof Error ? err.message : err
          );
          continue;
        }
      }
    }

    // Step 2 — wallet upsert (manual dedup on handle+address)
    try {
      const existing = await prisma.kolWallet.findFirst({
        where: {
          kolHandle: canonicalHandle!,
          address: k.wallet,
        },
        select: { id: true },
      });
      if (existing) {
        result.walletsSkippedExisting += 1;
        continue;
      }

      if (dryRun) {
        result.walletsCreated += 1;
        console.log(
          `[gmgn-seed] WOULD create wallet ${canonicalHandle} ${k.wallet}`
        );
        continue;
      }

      await prisma.kolWallet.create({
        data: {
          kolHandle: canonicalHandle!,
          address: k.wallet,
          chain: "SOL",
          label: "gmgn:kol",
          attributionSource: ATTRIBUTION_SOURCE,
          attributionNote: ATTRIBUTION_NOTE,
          attributionStatus: "review",
          isPubliclyUsable: false,
          discoveredAt: new Date(),
        },
      });
      result.walletsCreated += 1;
      console.log(`[gmgn-seed] wallet created ${canonicalHandle} ${k.wallet}`);
    } catch (err) {
      result.errors += 1;
      console.warn(
        `[gmgn-seed] wallet upsert failed for ${canonicalHandle ?? k.handle}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log("[gmgn-seed] summary:", result);
  console.log(`[gmgn-seed] mode=${dryRun ? "DRY-RUN" : "WRITE"} — done`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[gmgn-seed] fatal", e);
  process.exit(1);
});
