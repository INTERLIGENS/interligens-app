/**
 * Retail Vision Phase 6G — Seed wallets from 3 community sources.
 *
 * Sources :
 *   1. Friend.tech 2023 leak   → 33 ETH/Base wallets (chain="ETH")
 *   2. BlackHatWorld 2025      → 20 SOL wallets
 *   3. Dune query 4838225      → 16 SOL wallets
 *
 * Rules :
 *   - FriendTech : profile must already exist (skip if absent, do NOT
 *     create empty profile)
 *   - BHW / Dune : create KolProfile if absent (platform="x",
 *     publishable=false, publishStatus="draft")
 *   - Idempotent : skip if (kolHandle, address, chain) already exists
 *     (case-insensitive handle match)
 *   - Fail soft : one failure doesn't stop the rest
 *   - All wallets are attributionStatus="review", isPubliclyUsable=false
 *
 * Dry-run par défaut. Pour écrire :
 *     SEED_6G=1 pnpm tsx src/scripts/seed/phase6gWallets.ts
 */
import { prisma } from "@/lib/prisma";

interface SeedEntry {
  handle: string;
  address: string;
}

interface SourceDef {
  name: "friendtech_2023" | "bhw_2025" | "dune_4838225";
  chain: "ETH" | "SOL";
  attributionNote: string;
  createProfileIfMissing: boolean;
  entries: SeedEntry[];
}

// ── Source 1 — Friend.tech 2023 (33 ETH/Base wallets) ───────────────────
const FRIENDTECH_2023: SeedEntry[] = [
  { handle: "shmoonft", address: "0xf2cd0a7c2a3d3cd1705ce8f659ee85c86d9df3cf" },
  { handle: "wisdommatic", address: "0x01fa830192558a3d9b7f921a7d29e7788ac1c44e" },
  { handle: "solidtradesz", address: "0xecc41c65bce40d436a9c3cbac579a1201b1908e5" },
  { handle: "atitty_", address: "0xc7b090b7ff2b327c1f64a1e4d279fa7caaf52f91" },
  { handle: "herrocrypto", address: "0x5479f127a4d594208549c86f4b4903a1175a0311" },
  { handle: "0xsweep", address: "0xa6c4a623eda22de41e9134ba22c6c87d65ac8d42" },
  { handle: "noteezzy", address: "0xaee8b582be0229bd053b0421b22372abfe4f86ea" },
  { handle: "cryptotony__", address: "0x8a449a5ecc06e944516d510c11e3d8065f70925f" },
  { handle: "mattinweb3", address: "0x1d3410c7ad9e1fc2794e44ec8c92c8c689045232" },
  { handle: "cryptoposeidonn", address: "0x60f6f46a65dc720e593aa8448e5cd7c96cf6677b" },
  { handle: "teddycleps", address: "0x122c04c067235f7de216a03e5cfe674e65bab64d" },
  { handle: "web3maxx", address: "0x1ad79e680008ba6f92c149d4109efe80fc1a499d" },
  { handle: "dehkunle", address: "0x8a761726be4cade73d4375d9d151a9b413119cba" },
  { handle: "bysukie", address: "0x2a6706bed390cd930a48c4f8605d81c794b93a23" },
  { handle: "deviled_meggs_", address: "0xfbac1d0138f1643a310b61e708d814fe9709b700" },
  { handle: "gemsscope", address: "0x4acb826d55ade2d39db92e1c3120c4633decfe62" },
  { handle: "ix_wilson", address: "0xef2c772e7a38c55379aa84bd2a8a98f001b7b294" },
  { handle: "offshoda", address: "0xdde870d1cb7b76bcd9f50166c34542f3724b3643" },
  { handle: "thescalpingpro", address: "0x76060aaed61060bf64425fa9cce8e02d1ed6aa69" },
  { handle: "bullrun_gravano", address: "0x9303b33c10b468251c3d4aac59364be2566449b3" },
  { handle: "flowslikeosmo", address: "0x51d9cb0d382b00252b06523a2a92610bbddaf7ac" },
  { handle: "bagcalls", address: "0x56512d0ea66056ad270674749c019cc4dee95fb1" },
  { handle: "stevenascher", address: "0x3c49e7b5791bfd89cbcfdc0ff6b53a0b0f45122a" },
  { handle: "vikingxbt", address: "0xe64aee362ca102669c540d00644f17a307b74e69" },
  { handle: "presidentpush", address: "0x7dcc87e379ae9aef2238b57cf6451e2144055d53" },
  { handle: "cryptoanglio", address: "0x5ada76c32a570bbcbe54deae6f2d7ceaa67a922f" },
  { handle: "ikuzoeth", address: "0x61f30497224dbd11f203af0f4288b1d2504ed406" },
  { handle: "sexymichill", address: "0x1bcfb795d2dffe1d1e91130d74b0fb260043e29b" },
  { handle: "ola_crrypt", address: "0x167fc1a5aa0e11986a8e24529f158a120fdd36f3" },
  { handle: "roarweb3", address: "0x9c8865d928df6ceadd8dff2b314b0660a69ada81" },
  { handle: "busraeth", address: "0xee7e64d7b974fe65f7dc87e63641fe99592ffd4e" },
  { handle: "0xxghost", address: "0x52ddb97ac9ffd47e3a1f9d51766e9133e04643c1" },
  { handle: "cheatcoiner", address: "0x162eea13ad368a3c9696181d69fd1a938e58826d" },
];

// ── Source 2 — BlackHatWorld 2025 (20 SOL wallets) ──────────────────────
const BHW_2025: SeedEntry[] = [
  { handle: "frankdegods", address: "CRVidEDtEUTYZisCxBZkpELzhQc9eauMLR3FWg74tReL" },
  { handle: "NachSOL", address: "9jyqFiLnruggwNn4EQwBNFXwpbLM9hrA4hV59ytyAVVz" },
  { handle: "Ga__ke", address: "DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm" },
  { handle: "spunosounds", address: "GfXQesPe3Zuwg8JhAt6Cg8euJDTVx751enp9EQQmhzPH" },
  { handle: "Euris_JT", address: "DfMxre4cKmvogbLrPigxmibVTTQDuzjdXojWzjCXXhzj" },
  { handle: "leensx100", address: "7Dt5oUpxHWuKH8bCTXDLz2j3JyxA7jEmtzqCG6pnh96X" },
  { handle: "insentos", address: "7SDs3PjT2mswKQ7Zo4FTucn9gJdtuW4jaacPA65BseHS" },
  { handle: "404flipped", address: "AbcX4XBm7DJ3i9p29i6sU8WLmiW4FWY5tiwB9D6UBbcE" },
  { handle: "Solshotta", address: "dVs7zZksjFuq73xbtUC62brFXYYuxCuPSG4wZeGiHck" },
  { handle: "blobthechef", address: "pndujwi7BeaRRenYHSShyNQXAdBNEzKDR5jgzbheJFT" },
  { handle: "waddles_eth", address: "73LnJ7G9ffBDjEBGgJDdgvLUhD5APLonKrNiHsKDCw5B" },
  { handle: "Banks", address: "CkxVhktjqYuhsVfNQzqEZkwQ2gMU1wEFPM3FSSVXGjM9" },
  { handle: "FlippingProfits", address: "G5nxEXuFMfV74DSnsrSatqCW32F34XUnBeq3PfDS7w5E" },
  { handle: "orangie", address: "96sErVjEN7LNJ6Uvj63bdRWZxNuBngj56fnT9biHLKBf" },
  { handle: "ShockedJS", address: "4Bq5yvgoiZDsukGERb7aM52jDmbVPCpoihbztscZ5PeM" },
  { handle: "KenzoSOL_", address: "ECCKBDWX3MkEcf3bULbLBb9FvrEQLsmPMFTKFpvjzqgP" },
  { handle: "staqi_", address: "636N7frU8bUwYfyUAtvMQQsXhTFRuSWjxnEZihr5axGV" },
  { handle: "CookerFlips", address: "8deJ9xeUvXSJwicYptA9mHsU2rN2pDx37KWzkDkEXhU6" },
  { handle: "Cupseyy", address: "suqh5sHtr8HyJ7q8scBimULPkPpA557prMG47xCHQfK" },
  { handle: "traderpow", address: "2tgaERy66PYPEovadPh5y7coWjyURTmvKgdrHd9DAoxw" },
];

// ── Source 3 — Dune query 4838225 (16 SOL wallets) ──────────────────────
const DUNE_4838225: SeedEntry[] = [
  { handle: "CookerFlips", address: "8deJ9xeUvXSJwicYptA9mHsU2rN2pDx37KWzkDkEXhU6" },
  { handle: "traderpow", address: "8zFZHuSRuDpuAR7J6FzwyF3vKNx4CVW3DFHJerQhc7Zd" },
  { handle: "ohbrox", address: "7VBTpiiEjkwRbRGHJFUz6o5fWuhPFtAmy8JGhNqwHNnn" },
  { handle: "TobxG", address: "HmBmSYwYEgEZuBUYuDs9xofyqBAkw4ywugB1d7R7sTGh" },
  { handle: "igndex", address: "mW4PZB45isHmnjGkLpJvjKBzVS5NXzTJ8UDyug4gTsM" },
  { handle: "Ga__ke", address: "DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm" },
  { handle: "NachSOL", address: "ATKi3ZvMbo31pbgBgGSGQPDPKEbQ4oGzoDrwG2sms56k" },
  { handle: "BastilleBtc", address: "3kebnKw7cPdSkLRfiMEALyZJGZ4wdiSRvmoN4rD1yPzV" },
  { handle: "blknoiz06", address: "AVAZvHLR2PcWpDf8BXY4rVxNHYRBytycHkcB5z5QNXYm" },
  { handle: "GAntD", address: "215nhcAHjQQGgwpQSJQ7zR26etbjjtVdW74NLzwEgQjP" },
  { handle: "ChartFuMonkey", address: "7i7vHEv87bs135DuoJVKe9c7abentawA5ydfWcWc8iY2" },
  { handle: "0xZyaf", address: "F5TjPySiUJMdvqMZHnPP85Rc1vEirDGV5FR5P2vdVm429" },
  { handle: "ShockedJS", address: "6m5sW6EAPAHncxnzapi1iZVJNRb9RZFHQ3Bj7FD84X9rAF" },
  { handle: "gorillacapsol", address: "DpNVrtA3ERfKzX4F8Pi2CVykdJJjoNxyY5QgoytAwD26" },
  { handle: "insentos", address: "7SDs3PjT2mswKQ7Zo4FTucn9gJdtuW4jaacPA65BseHS" },
  { handle: "runitbackghost", address: "ApRnQN2HkbCn7W2WWiT2FEKvuKJp9LugRyAE1a9Hdz1" },
];

const SOURCES: SourceDef[] = [
  {
    name: "friendtech_2023",
    chain: "ETH",
    attributionNote:
      "Friend.tech 2023 leak — Base wallet linked voluntarily to Twitter handle",
    createProfileIfMissing: false,
    entries: FRIENDTECH_2023,
  },
  {
    name: "bhw_2025",
    chain: "SOL",
    attributionNote:
      "BlackHatWorld thread — community verified Solana memecoin KOL wallets",
    createProfileIfMissing: true,
    entries: BHW_2025,
  },
  {
    name: "dune_4838225",
    chain: "SOL",
    attributionNote:
      "Dune Analytics query 4838225 — community hardcoded KOL wallet mapping",
    createProfileIfMissing: true,
    entries: DUNE_4838225,
  },
];

interface SourceResult {
  source: SourceDef["name"];
  inputEntries: number;
  profilesCreated: number;
  profilesSkippedAbsent: number;
  walletsCreated: number;
  walletsSkippedExisting: number;
  errors: number;
}

async function seedSource(src: SourceDef, dryRun: boolean): Promise<SourceResult> {
  const result: SourceResult = {
    source: src.name,
    inputEntries: src.entries.length,
    profilesCreated: 0,
    profilesSkippedAbsent: 0,
    walletsCreated: 0,
    walletsSkippedExisting: 0,
    errors: 0,
  };

  // Pre-fetch all existing profiles (case-insensitive match). We do one
  // query per source to keep things snappy.
  const inputHandles = src.entries.map((e) => e.handle);
  const existingProfiles = await prisma.kolProfile.findMany({
    where: { handle: { in: inputHandles, mode: "insensitive" } },
    select: { handle: true },
  });
  const profileMap = new Map<string, string>(); // lc → canonical handle
  for (const p of existingProfiles) {
    profileMap.set(p.handle.toLowerCase(), p.handle);
  }

  for (const entry of src.entries) {
    const handleLc = entry.handle.toLowerCase();
    let canonicalHandle = profileMap.get(handleLc);

    // Step 1 — profile handling
    if (!canonicalHandle) {
      if (!src.createProfileIfMissing) {
        result.profilesSkippedAbsent += 1;
        console.log(
          `[6g:${src.name}] skip ${entry.handle} — no KolProfile found`
        );
        continue;
      }
      // Create draft profile
      if (dryRun) {
        result.profilesCreated += 1;
        canonicalHandle = entry.handle;
        profileMap.set(handleLc, canonicalHandle);
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
            `[6g:${src.name}] profile created ${entry.handle} (draft)`
          );
        } catch (err) {
          result.errors += 1;
          console.warn(
            `[6g:${src.name}] profile create failed for ${entry.handle}`,
            err instanceof Error ? err.message : err
          );
          continue;
        }
      }
    }

    // Step 2 — wallet upsert (manual dedup on handle+address+chain)
    try {
      const existing = await prisma.kolWallet.findFirst({
        where: {
          kolHandle: canonicalHandle!,
          address: entry.address,
          chain: src.chain,
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
          `[6g:${src.name}] WOULD create wallet ${canonicalHandle} ${entry.address} [${src.chain}]`
        );
        continue;
      }

      await prisma.kolWallet.create({
        data: {
          kolHandle: canonicalHandle!,
          address: entry.address,
          chain: src.chain,
          attributionSource: src.name,
          attributionNote: src.attributionNote,
          attributionStatus: "review",
          isPubliclyUsable: false,
          discoveredAt: new Date(),
        },
      });
      result.walletsCreated += 1;
      console.log(
        `[6g:${src.name}] wallet created ${canonicalHandle} ${entry.address} [${src.chain}]`
      );
    } catch (err) {
      result.errors += 1;
      console.warn(
        `[6g:${src.name}] wallet upsert failed for ${canonicalHandle ?? entry.handle}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return result;
}

async function main() {
  const dryRun = process.env.SEED_6G !== "1";
  console.log(`[6g-seed] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const results: SourceResult[] = [];
  for (const src of SOURCES) {
    console.log(
      `[6g-seed] === source=${src.name} chain=${src.chain} entries=${src.entries.length} ===`
    );
    const r = await seedSource(src, dryRun);
    results.push(r);
    console.log(`[6g-seed] ${src.name} summary:`, r);
  }

  const totals = results.reduce(
    (acc, r) => ({
      inputEntries: acc.inputEntries + r.inputEntries,
      profilesCreated: acc.profilesCreated + r.profilesCreated,
      profilesSkippedAbsent: acc.profilesSkippedAbsent + r.profilesSkippedAbsent,
      walletsCreated: acc.walletsCreated + r.walletsCreated,
      walletsSkippedExisting: acc.walletsSkippedExisting + r.walletsSkippedExisting,
      errors: acc.errors + r.errors,
    }),
    {
      inputEntries: 0,
      profilesCreated: 0,
      profilesSkippedAbsent: 0,
      walletsCreated: 0,
      walletsSkippedExisting: 0,
      errors: 0,
    }
  );

  console.log("[6g-seed] TOTALS:", totals);
  console.log(`[6g-seed] mode=${dryRun ? "DRY-RUN" : "WRITE"} — done`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[6g-seed] fatal", e);
  process.exit(1);
});
