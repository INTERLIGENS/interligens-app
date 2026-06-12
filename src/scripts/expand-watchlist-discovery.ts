/**
 * src/scripts/expand-watchlist-discovery.ts
 * Watchlist expansion — vet the cleaned unlisted shortlist (STEP 1) and discover
 * brand-new KOL candidates via X recent-search (STEP 2). REPORT ONLY — writes
 * nothing to KolProfile / handles.ts.
 *
 * Outputs:
 *   /tmp/vetted-unlisted-top30.md
 *   /tmp/discovered-new-kols-2026-06-12.md
 * + a STEP 3 summary to stdout.
 *
 * Budget: getUserByUsername (STEP 1, ~30 calls) + search pages (STEP 2, hard cap
 * MAX_SEARCH_CALLS). Each search page resolves its authors inline (expansions),
 * so author follower counts cost no extra calls.
 *
 * Usage:
 *   pnpm tsx -r dotenv/config src/scripts/expand-watchlist-discovery.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { getUserByUsername, searchRecentWithAuthors, hasToken, type XUser, type XTweet } from "@/lib/xapi/client";

const MIN_FOLLOWERS = 25_000;
const AGE_CUTOFF = new Date("2026-05-13T00:00:00Z"); // >=30d old as of 2026-06-12
const MAX_SEARCH_CALLS = 60; // hard cap (<200 budget; ~$0.60)
const PAGES_PER_QUERY = 6;
const DISCOVER_CAP = 100;

const VETTED_OUT = "/tmp/vetted-unlisted-top30.md";
const DISCOVER_OUT = "/tmp/discovered-new-kols-2026-06-12.md";

const CRYPTO_RE = /crypto|trader|trading|defi|degen|solana|\bsol\b|memecoin|pump|nft|web3|altcoin|\$[A-Za-z]|onchain|on-chain|alpha|gem|ape|trenches|chart|bitcoin|\bbtc\b|\beth\b|airdrop|token|hodl|signal|caller/i;
const NONLATIN_RE = /[　-鿿가-힯Ѐ-ӿ؀-ۿ]/g;

// Shill signal patterns (client-side scoring of tweet text).
const SIG = {
  pumpfun: /pump\.fun|pumpdotfun|pump_fun/i,
  multiplier: /\b\d{2,4}x\b|100x|1000x/i,
  apegem: /\b(ape|gem|aping|send it|sendit|full send)\b/i,
  ca: /\b(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/,
  cashtag: /\$[A-Za-z][A-Za-z0-9]{1,9}\b/,
  callit: /called it|from my call|i called|my call|called at|aped at/i,
};

let xCalls = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ageOk(u: XUser): boolean {
  if (!u.created_at) return true; // unknown → benefit of the doubt
  return new Date(u.created_at) <= AGE_CUTOFF;
}
function bioEnglishish(bio?: string): boolean {
  if (!bio) return true;
  const nonLatin = (bio.match(NONLATIN_RE) ?? []).length;
  return nonLatin / bio.length < 0.3;
}
function bioCryptoish(bio?: string): boolean {
  if (!bio) return true; // empty → don't exclude on bio alone
  return CRYPTO_RE.test(bio);
}
function signalCount(text: string): number {
  let n = 0;
  for (const re of Object.values(SIG)) if (re.test(text)) n++;
  return n;
}
const snippet = (s?: string) => (s ? s.replace(/\s+/g, " ").trim().slice(0, 90) : "");

async function main() {
  if (!hasToken()) throw new Error("X_BEARER_TOKEN not configured — aborting");

  // Exclusion set: every KolProfile handle, ANY status.
  const kols = await prisma.kolProfile.findMany({ select: { handle: true } });
  const known = new Set(kols.map((k) => k.handle.toLowerCase()));
  console.log(`[expand] ${known.size} KolProfile handles in exclusion set (all statuses)\n`);

  // ─── STEP 1 — vet cleaned top-30 unlisted ────────────────────────────────
  const cleaned = readFileSync("/tmp/unlisted-handles-cleaned-2026-06-12.md", "utf8");
  const top30: { handle: string; kols: number; mentions: number }[] = [];
  for (const line of cleaned.split("\n")) {
    const m = line.match(/^\|\s*\d+\s*\|\s*@([A-Za-z0-9_]{1,15})\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/);
    if (m) top30.push({ handle: m[1], kols: parseInt(m[2], 10), mentions: parseInt(m[3], 10) });
  }
  console.log(`[STEP1] vetting ${top30.length} unlisted handles via X API...`);

  type Vetted = { handle: string; followers: number; verified: boolean; bio: string; kols: number; mentions: number; verdict: string };
  const vettedAll: Vetted[] = [];
  for (const t of top30) {
    let u: XUser | null = null;
    try { u = await getUserByUsername(t.handle); } catch { /* counted below */ }
    xCalls++;
    if (!u) { vettedAll.push({ handle: t.handle, followers: 0, verified: false, bio: "", kols: t.kols, mentions: t.mentions, verdict: "OUT:suspended/not_found" }); await sleep(1000); continue; }
    const followers = u.public_metrics?.followers_count ?? 0;
    // Context-aware crypto check: bio keywords OR a crypto-shaped handle/name OR
    // a large following (a 50k+ account surfaced by crypto KOLs is crypto by context).
    const handleCrypto = /^0x/i.test(u.username) || CRYPTO_RE.test(u.username) || CRYPTO_RE.test(u.name ?? "");
    const cryptoOk = bioCryptoish(u.description) || handleCrypto || followers >= 50_000;
    let verdict = "PASS";
    if (followers < MIN_FOLLOWERS) verdict = `OUT:followers<25k(${followers})`;
    else if (!ageOk(u)) verdict = "OUT:account<30d";
    else if (u.description && !cryptoOk) verdict = "OUT:bio_not_crypto";
    vettedAll.push({ handle: u.username, followers, verified: !!u.verified, bio: snippet(u.description), kols: t.kols, mentions: t.mentions, verdict });
    console.log(`  @${u.username.padEnd(20)} ${followers.toLocaleString().padStart(9)}  ${verdict}`);
    await sleep(1000);
  }
  const vetted = vettedAll
    .filter((v) => v.verdict === "PASS")
    .sort((a, b) => (b.kols - a.kols) || (b.followers - a.followers));

  const vLines = [
    "# Vetted unlisted handles (cleaned top-30, X-API validated)",
    "",
    `Generated 2026-06-12 · ${vetted.length}/${top30.length} passed (followers>=25k, age>=30d, crypto bio, not suspended).`,
    "Ranked by distinct_referring_kols DESC, then followerCount DESC.",
    "",
    "| # | handle | followers | verified | referring_kols | mentions | bio |",
    "|---|--------|-----------|----------|----------------|----------|-----|",
    ...vetted.map((v, i) => `| ${i + 1} | @${v.handle} | ${v.followers.toLocaleString()} | ${v.verified ? "yes" : "no"} | ${v.kols} | ${v.mentions} | ${v.bio.replace(/\|/g, "/")} |`),
    "",
    "## Rejected",
    ...vettedAll.filter((v) => v.verdict !== "PASS").map((v) => `- @${v.handle} (${v.followers.toLocaleString()}) — ${v.verdict}${v.bio ? ` — bio: "${v.bio.replace(/\|/g, "/")}"` : ""}`),
    "",
  ];
  writeFileSync(VETTED_OUT, vLines.join("\n"), "utf8");
  console.log(`[STEP1] ${vetted.length} passed → ${VETTED_OUT}\n`);

  // ─── STEP 2 — programmatic discovery via recent search ───────────────────
  type Cand = { handle: string; followers: number; bio: string; tweetCount: number; signals: number; tweets: number; lastSeen: Date | null; verified: boolean };

  // --step1-only: reuse the already-written discovered file (no new search calls).
  if (process.argv.slice(2).includes("--step1-only")) {
    const prev = readFileSync(DISCOVER_OUT, "utf8");
    const discovered: Cand[] = [];
    for (const line of prev.split("\n")) {
      const m = line.match(/^\|\s*\d+\s*\|\s*@([A-Za-z0-9_]{1,15})\s*\|\s*([\d,]+)\s*\|(.*)\|\s*(\d+)\s*\|\s*([\d-]+|—)\s*\|/);
      if (m) discovered.push({ handle: m[1], followers: parseInt(m[2].replace(/,/g, ""), 10), bio: m[3].trim(), tweetCount: 0, signals: parseInt(m[4], 10), tweets: 0, lastSeen: null, verified: false });
    }
    console.log(`[STEP2] --step1-only: reused ${discovered.length} discovered from ${DISCOVER_OUT} (0 new search calls)`);
    return finish(vetted, discovered);
  }

  const QUERIES = [
    `(pump.fun OR pumpdotfun) (gem OR ape OR "send it" OR 100x OR 1000x) -is:retweet lang:en`,
    `("100x" OR "1000x") (solana OR sol OR pumpfun OR memecoin OR gem) -is:retweet lang:en`,
    `("called it at" OR "from my call" OR "i called" OR "aped at") (pump OR sol OR gem OR memecoin) -is:retweet lang:en`,
    `(ape OR gem OR aping) (pump.fun OR dexscreener OR memecoin) -is:retweet lang:en`,
    `(memecoin OR trenches) (100x OR gem OR ape OR pumpfun OR runner) -is:retweet lang:en`,
  ];

  const cands = new Map<string, Cand>();
  const userById = new Map<string, XUser>();

  console.log(`[STEP2] searching X (cap ${MAX_SEARCH_CALLS} calls, ${QUERIES.length} queries x<=${PAGES_PER_QUERY} pages)...`);
  outer: for (let q = 0; q < QUERIES.length; q++) {
    let nextToken: string | undefined;
    for (let page = 0; page < PAGES_PER_QUERY; page++) {
      if (xCalls >= 30 + MAX_SEARCH_CALLS) break outer; // STEP1 lookups + search cap
      let resp: { tweets: XTweet[]; users: XUser[]; nextToken?: string };
      try { resp = await searchRecentWithAuthors(QUERIES[q], 100, nextToken); }
      catch { break; }
      xCalls++;
      for (const u of resp.users) userById.set(u.id, u);
      for (const tw of resp.tweets) {
        const author = tw.author_id ? userById.get(tw.author_id) : undefined;
        if (!author) continue;
        const sigs = signalCount(tw.text);
        if (sigs === 0) continue;
        const key = author.username.toLowerCase();
        let c = cands.get(key);
        if (!c) {
          c = { handle: author.username, followers: author.public_metrics?.followers_count ?? 0, bio: snippet(author.description), tweetCount: author.public_metrics?.tweet_count ?? 0, signals: 0, tweets: 0, lastSeen: null, verified: !!author.verified };
          cands.set(key, c);
        }
        c.signals += sigs;
        c.tweets += 1;
        const ts = tw.created_at ? new Date(tw.created_at) : null;
        if (ts && (!c.lastSeen || ts > c.lastSeen)) c.lastSeen = ts;
      }
      console.log(`  q${q + 1} p${page + 1}: +${resp.tweets.length} tweets, ${resp.users.length} authors (uniq cands so far: ${cands.size}, calls: ${xCalls})`);
      nextToken = resp.nextToken;
      if (!nextToken) break;
      await sleep(1100);
    }
  }

  // Filter discovered candidates.
  const discovered = [...cands.values()]
    .filter((c) => !known.has(c.handle.toLowerCase()))
    .filter((c) => c.followers >= MIN_FOLLOWERS)
    .filter((c) => {
      const u = [...userById.values()].find((x) => x.username.toLowerCase() === c.handle.toLowerCase());
      return u ? ageOk(u) : true;
    })
    .filter((c) => bioEnglishish(c.bio))
    .sort((a, b) => (b.signals - a.signals) || (b.followers - a.followers))
    .slice(0, DISCOVER_CAP);

  const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
  const dLines = [
    "# Discovered new KOL candidates (X recent-search, 2026-06-12)",
    "",
    `${cands.size} unique authors with >=1 shill signal scanned · ${discovered.length} qualified (not in KolProfile, followers>=25k, age>=30d, EN bio).`,
    "Ranked by shill_signal_count DESC, then followerCount DESC. Capped at " + DISCOVER_CAP + ".",
    "",
    "| # | handle | followerCount | bio_snippet | shill_signal_count | last_seen |",
    "|---|--------|---------------|-------------|--------------------|-----------|",
    ...discovered.map((c, i) => `| ${i + 1} | @${c.handle} | ${c.followers.toLocaleString()} | ${c.bio.replace(/\|/g, "/")} | ${c.signals} | ${fmtDate(c.lastSeen)} |`),
    "",
  ];
  writeFileSync(DISCOVER_OUT, dLines.join("\n"), "utf8");
  console.log(`\n[STEP2] ${discovered.length} discovered → ${DISCOVER_OUT}`);

  return finish(vetted, discovered);
}

// ─── STEP 3 — summary ──────────────────────────────────────────────────────
function finish(
  vetted: { handle: string; followers: number }[],
  discovered: { handle: string; followers: number }[],
) {
  const bucketOf = (n: number) => (n < 50_000 ? "25k_50k" : n < 100_000 ? "50k_100k" : n < 250_000 ? "100k_250k" : "250k_plus");
  const combined = [
    ...vetted.map((v) => ({ handle: v.handle, followers: v.followers, src: "unlisted" })),
    ...discovered.map((c) => ({ handle: c.handle, followers: c.followers, src: "discovered" })),
  ];
  const seen = new Set<string>();
  const combinedUniq = combined.filter((c) => { const k = c.handle.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const top30combined = [...combinedUniq].sort((a, b) => b.followers - a.followers).slice(0, 30);
  const B = ["25k_50k", "50k_100k", "100k_250k", "250k_plus"];
  const dist: Record<string, number> = Object.fromEntries(B.map((b) => [b, 0]));
  for (const c of top30combined) dist[bucketOf(c.followers)]++;

  console.log("\n========================================");
  console.log("STEP 3 — WATCHLIST EXPANSION SUMMARY");
  console.log("========================================");
  console.log(`Total vetted from unlisted:        ${vetted.length}`);
  console.log(`Total discovered programmatically: ${discovered.length}`);
  console.log(`Combined unique candidates:        ${combinedUniq.length}`);
  console.log(`\nTop ${top30combined.length} combined candidates by follower bucket:`);
  for (const b of B) console.log(`  ${b.padEnd(11)} ${dist[b]}`);
  console.log(`\nTop combined (by followers):`);
  top30combined.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. @${c.handle.padEnd(20)} ${c.followers.toLocaleString().padStart(10)}  [${c.src}]`));
  console.log(`\nX API calls this step: ${xCalls}  (~$${(xCalls * 0.01).toFixed(2)}) | Helius calls: 0`);
  console.log("========================================");
}

main()
  .catch((e) => { console.error("[expand] failed", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); process.exit(process.exitCode ?? 0); });
