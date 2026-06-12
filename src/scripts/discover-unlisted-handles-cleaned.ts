/**
 * src/scripts/discover-unlisted-handles-cleaned.ts
 * Cleaned variant of discover-unlisted-handles.ts:
 *   - applies a denylist of protocol / L1-L2 / exchange / tool / infra handles
 *     and high-profile non-shiller real persons
 *   - re-sorts PRIMARILY by distinct referring KOLs (strong discovery signal),
 *     then by total mention count, then recency
 *
 * Read-only. Writes top 30 to /tmp/unlisted-handles-cleaned-2026-06-12.md
 *
 * Usage:
 *   pnpm tsx -r dotenv/config src/scripts/discover-unlisted-handles-cleaned.ts
 */

import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

const OUT = "/tmp/unlisted-handles-cleaned-2026-06-12.md";
const TOP_N = 30;
const MENTION_RE = /@([A-Za-z0-9_]{1,15})/g;

// Lowercased denylist: protocols, L1/L2 chains, exchanges, tools/infra,
// and high-profile non-shiller real persons. Not KOLs / signal-callers.
const DENYLIST = new Set([
  // explicitly called out by David
  "solana", "hyperliquidx", "0xpolygon", "ethereum", "bnbchain", "base",
  "arbitrum", "pumpfun", "polymarket", "binance", "telegram", "geckoterminal",
  "defillama", "metawin", "shufflecom", "collector_crypt", "humanityprot",
  "25xdotfun", "ravntools", "mt_gox_",
  // non-shiller real persons
  "toly", "saylor", "durov", "jessepollak",
  // other obvious L1/L2 / chains
  "polygon", "avax", "avalanche", "suinetwork", "sui", "aptos", "sei", "seinetwork",
  "tron", "trondao", "optimism", "blast", "blast_l2", "berachain", "monad",
  "monad_xyz", "ton", "ton_blockchain", "near", "cardano", "ripple", "litecoin",
  "dogecoin", "starknet", "zksync", "scroll_zkp", "mantle", "celestia",
  // exchanges / CEX
  "coinbase", "bybit_official", "bybit", "okx", "kraken", "kucoincom", "kucoin",
  "gate_io", "mexc_official", "bitget", "htx_global", "cryptocom", "robinhood",
  "upbit", "bitstamp",
  // tools / infra / analytics / wallets
  "dexscreener", "dextools", "birdeye_so", "jupiterexchange", "jup", "raydiumprotocol",
  "raydium", "tradewithphoton", "bullx_io", "gmgnai", "nansen_ai", "arkhamintel",
  "debankdefi", "etherscan", "solscanofficial", "heliuslabs", "phantom",
  "metamask", "pump_fun", "pumpdotfun", "moonshot", "photon_sol", "bloomtrading",
  "tweetdex", "rugcheckxyz", "bubblemaps", "chainalysis", "messaricrypto",
  "coingecko", "coinmarketcap", "tokenterminal",
  // other obvious non-KOL celebs / orgs
  "vitalikbuterin", "cz_binance", "elonmusk", "aeyakovenko", "realdonaldtrump",
  "brian_armstrong", "rajgokal", "zachxbt",
]);

type Agg = {
  display: string;
  mentionCount: number;
  referrers: Set<string>;
  lastSeen: Date | null;
};

async function main() {
  const kols = await prisma.kolProfile.findMany({ select: { handle: true } });
  const known = new Set(kols.map((k) => k.handle.toLowerCase()));

  const influencers = await prisma.influencer.findMany({ select: { id: true, handle: true } });
  const infHandle = new Map(influencers.map((i) => [i.id, i.handle.toLowerCase()]));

  const candidates = await prisma.socialPostCandidate.findMany({
    where: { rawText: { not: null } },
    select: { rawText: true, influencerId: true, postedAtUtc: true, discoveredAtUtc: true },
  });

  const agg = new Map<string, Agg>();
  let denied = 0;

  for (const c of candidates) {
    const text = c.rawText ?? "";
    const when = c.postedAtUtc ?? c.discoveredAtUtc ?? null;
    const referrer = c.influencerId;
    const referrerHandle = infHandle.get(referrer);

    const seenInThisPost = new Set<string>();
    let m: RegExpExecArray | null;
    MENTION_RE.lastIndex = 0;
    while ((m = MENTION_RE.exec(text)) !== null) {
      const raw = m[1];
      const key = raw.toLowerCase();
      if (seenInThisPost.has(key)) continue;
      seenInThisPost.add(key);

      if (known.has(key)) continue;
      if (referrerHandle && key === referrerHandle) continue;
      if (DENYLIST.has(key)) { denied++; continue; }

      let a = agg.get(key);
      if (!a) {
        a = { display: raw, mentionCount: 0, referrers: new Set(), lastSeen: null };
        agg.set(key, a);
      }
      a.mentionCount += 1;
      a.referrers.add(referrer);
      if (when && (!a.lastSeen || when > a.lastSeen)) a.lastSeen = when;
    }
  }

  // PRIMARY sort: distinct referring KOLs DESC, then mention count DESC, then recency DESC.
  const ranked = [...agg.values()].sort((x, y) => {
    if (y.referrers.size !== x.referrers.size) return y.referrers.size - x.referrers.size;
    if (y.mentionCount !== x.mentionCount) return y.mentionCount - x.mentionCount;
    const yt = y.lastSeen?.getTime() ?? 0;
    const xt = x.lastSeen?.getTime() ?? 0;
    return yt - xt;
  });

  const top = ranked.slice(0, TOP_N);
  const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

  const lines: string[] = [];
  lines.push("# Unlisted but frequently-mentioned handles — CLEANED");
  lines.push("");
  lines.push("Source: `SocialPostCandidate.rawText` @mentions by currently-monitored KOLs.");
  lines.push(`Generated: 2026-06-12 · ${candidates.length} posts scanned · ${agg.size} distinct handles after denylist · showing top ${top.length}.`);
  lines.push(`Sorted by distinct_referring_kols DESC, then mention_count DESC, then recency.`);
  lines.push(`Excludes: handles in KolProfile, self-mentions, ${DENYLIST.size}-entry protocol/exchange/tool/celeb denylist (${denied} mentions dropped).`);
  lines.push("");
  lines.push("| # | handle | distinct_referring_kols | mention_count | last_seen |");
  lines.push("|---|--------|-------------------------|---------------|-----------|");
  top.forEach((a, i) => {
    lines.push(`| ${i + 1} | @${a.display} | ${a.referrers.size} | ${a.mentionCount} | ${fmtDate(a.lastSeen)} |`);
  });
  lines.push("");

  writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`[cleaned] wrote ${OUT}`);
  console.log(`[cleaned] ${agg.size} distinct handles after denylist | ${denied} mentions dropped by denylist`);
  console.log("\n=== TOP 30 (cleaned) ===");
  console.log("rank  handle                    KOLs  mentions  last_seen");
  top.forEach((a, i) => {
    console.log(
      `${String(i + 1).padStart(2)}.   @${a.display.padEnd(22)} ${String(a.referrers.size).padStart(2)}    ${String(a.mentionCount).padStart(3)}      ${fmtDate(a.lastSeen)}`,
    );
  });
}

main()
  .catch((e) => {
    console.error("[cleaned] failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
