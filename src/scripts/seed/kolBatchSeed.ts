/**
 * Retail Vision Phase 6A — KolProfile batch seed (~200 handles).
 *
 * Curated 5-tier list of KOL twitter handles to track. Each row gets the
 * minimum viable shape (handle + displayName=handle + platform="x" + tier).
 * No scoring, no publication, no wallet, no fabricated metadata.
 *
 * Idempotent: case-insensitive existence check against KolProfile.handle.
 * Existing rows are NEVER modified (no tier overwrite, no rename).
 *
 * Dry-run par défaut. Pour écrire :
 *     SEED_BATCH=1 pnpm tsx src/scripts/seed/kolBatchSeed.ts
 */
import { prisma } from "@/lib/prisma";

interface BatchEntry {
  handle: string;
  tier: string; // "1".."5"
}

const TIER_1 = [
  "apemp5", "tedpillows", "regrets10x", "fuelkek", "moondat", "jeremyybtc",
  "shmoonft", "wisdommatic", "eddyxbt", "daokwondo", "solidtradesz",
  "atitty_", "sibeleth", "herrocrypto", "0xsweep", "arcane_crypto_",
  "mediagiraffes",
];

const TIER_2 = [
  "9trevv", "noteezzy", "officialskywee1", "brommmyy", "farmercist_eth",
  "cryptotony__", "renzosalpha", "cottonxbt", "mattinweb3", "jrcryptex",
  "its_braz", "broskisol", "bazza_aped", "cryptostorm", "leochain0",
  "cryptoposeidonn", "realpabloheman", "bon_g", "darky1k", "vee",
  "teddycleps", "mduz_nft", "bloodweb3", "web3maxx", "dehkunle",
  "bryanrosswins",
];

const TIER_3 = [
  "mobymedia", "bysukie", "c_potens", "xelf_sol", "solfistooshort",
  "crypto_ed7", "lin_dao_", "littlemustacho", "rutradebtc", "cryptolady_m",
  "lockedinlucas", "deviled_meggs_", "noahhcalls", "gemsscope", "dmtland_",
  "drallio", "dyorwgmi", "ix_wilson", "offshoda", "advyth", "wasted0x",
  "thescalpingpro", "bullrun_gravano", "itsthurstxn", "jetxbt", "notdecu",
  "dotcomparker", "flowslikeosmo", "bagcalls", "capitalist0g", "thedefiape",
  "cryptoazyra", "parcifap_defi", "cryptopizzagirl", "rypto_", "xiacalls",
  "trapjuicesol", "stevenascher", "cryptobullying", "rozer100x", "cometcalls",
  "fwtyo", "web3niels", "deg_ape", "block100x", "kokid951", "lowkeyrich_",
];

const TIER_4 = [
  "rizzy1c", "cryptowifeyx", "fezweb3", "vikingxbt", "ferreweb3",
  "alaouicapital", "raintures", "odicrypt", "jamiekingston", "purpurrp",
  "princeracks", "tvbzify", "praxmedia", "ezmoneygems", "web3righteous",
  "luno_sol1", "degenbrody", "adameshelton", "decentralpapi", "lugweb3",
  "parsa_nftt", "vainxyz", "nbweb3", "presidentpush", "mostangrybull",
  "queencryptoooo", "bruca", "zacknfa", "vasta", "hairhustler128", "hubzify",
  "satoshi0wl", "aisarcore", "cryptoda_bless", "bitcoinzac", "crypto_queen_x",
  "aleyweb3", "hiswatdofg", "kryptohumphrey", "cryptoanglio", "solana_emperor",
  "macee", "romejayx", "aleex6ix", "ikuzoeth", "abgweb3", "marcell0x1",
  "eth_danx", "evancrypt", "sexymichill", "cryptobaldwiniv", "ola_crrypt",
  "de_rugger", "brookcalls_", "bronsixbt", "henrys0x", "genuinedegen",
  "dacryptogeneral", "elhousesol", "roarweb3", "busraeth", "mistoor",
  "selor", "0xxghost", "retrickk_crypto",
];

const TIER_5 = [
  "lhzzr", "wtfisdavee", "spond", "krypto_hybrid", "og_terry0x", "liamchucky",
  "mortyweb3", "steezehuman", "xxldubem", "_thespacebyte", "trentlowtf",
  "obeyguvy", "seph_jim", "nftpriest_1", "zeusrebirth", "goboovi", "leoweb3_5",
  "tunmi_f", "cryptoextension", "web3warrior", "ghostassassinnn",
  "azglobalnetwork", "monsteraco_nft", "astaweb3", "scrambler_sol",
  "goodnessdefi", "katherine_xbt", "cardcabz", "matrixonchain", "mowkiweb3",
  "hellerincrypto", "zilyic", "degencruise", "lockweb8", "soapweb3", "jeffnfa",
  "astro_nuel", "ony3oku", "lillyvivvi",
];

function buildBatch(): BatchEntry[] {
  const out: BatchEntry[] = [];
  const seen = new Set<string>();
  const push = (handles: string[], tier: string) => {
    for (const h of handles) {
      const key = h.toLowerCase();
      if (seen.has(key)) {
        console.warn(`[batch-seed] duplicate handle in input: ${h} (tier ${tier})`);
        continue;
      }
      seen.add(key);
      out.push({ handle: h, tier });
    }
  };
  push(TIER_1, "1");
  push(TIER_2, "2");
  push(TIER_3, "3");
  push(TIER_4, "4");
  push(TIER_5, "5");
  return out;
}

async function main() {
  const dryRun = process.env.SEED_BATCH !== "1";
  console.log(`[batch-seed] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const batch = buildBatch();
  console.log(`[batch-seed] input: ${batch.length} unique handles across 5 tiers`);

  // Single case-insensitive existence query
  const allLower = batch.map(b => b.handle.toLowerCase());
  const existing = await prisma.kolProfile.findMany({
    where: { handle: { in: allLower, mode: "insensitive" } },
    select: { handle: true },
  });
  const existingLower = new Set(existing.map(e => e.handle.toLowerCase()));
  console.log(`[batch-seed] ${existingLower.size} of these handles already exist (case-insensitive)`);

  let created = 0;
  let skipped = 0;
  let errors = 0;
  const tierCounts: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

  for (const entry of batch) {
    if (existingLower.has(entry.handle.toLowerCase())) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`[batch-seed] would create handle=${entry.handle} tier=${entry.tier}`);
      created += 1;
      tierCounts[entry.tier] += 1;
      continue;
    }
    try {
      await prisma.kolProfile.create({
        data: {
          handle: entry.handle,
          displayName: entry.handle,
          platform: "x",
          tier: entry.tier,
          // label, riskFlag, confidence, status, publishable, publishStatus,
          // rugCount all use schema defaults — "unknown", "unverified", "low",
          // "active", false, "draft", 0. No scoring, no publication.
        },
      });
      console.log(`[batch-seed] create handle=${entry.handle} tier=${entry.tier}`);
      created += 1;
      tierCounts[entry.tier] += 1;
    } catch (err) {
      errors += 1;
      console.warn("[batch-seed] create failed (soft)", {
        handle: entry.handle,
        tier: entry.tier,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("[batch-seed] summary", {
    input: batch.length,
    created: dryRun ? `${created} (preview)` : created,
    skipped,
    errors,
    byTier: tierCounts,
  });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[batch-seed] fatal", e);
  process.exit(1);
});
