/**
 * src/scripts/discover-cryptotony-type.ts
 * Targeted discovery of "CryptoTony type" KOLs: established TA/signal callers,
 * 100k-500k followers, account age >2y, bio about trading/TA/calls/signals/alpha.
 * REPORT ONLY — writes nothing to KolProfile / handles.ts.
 *
 * STEP A  characterise 5 reference handles (already in watchlist) for context
 * STEP B  vet 13 named well-known callers via getUserByUsername
 * STEP C  programmatic discovery via TA-language recent-search (has:media etc.)
 * STEP D  combined ranked shortlist -> /tmp/cryptotony-type-candidates-2026-06-12.md
 *
 * Budget: hard cap MAX_CALLS X API calls.
 *
 * Usage: pnpm tsx -r dotenv/config src/scripts/discover-cryptotony-type.ts
 */

import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { getUserByUsername, searchRecentWithAuthors, hasToken, type XUser, type XTweet } from "@/lib/xapi/client";

const NOW = new Date("2026-06-12T00:00:00Z");
const AGE_2Y = new Date("2024-06-12T00:00:00Z"); // created_at must be <= this (>=2y old)
const MIN_FOLLOWERS = 100_000;
const SWEET_MAX = 500_000;
const MAX_CALLS = 180; // <200 budget
const PAGES_PER_QUERY = 6;
const OUT = "/tmp/cryptotony-type-candidates-2026-06-12.md";

const REFERENCE = ["CryptoTony__", "jeremyybtc", "apemp5", "cryptostorm", "leochain0"];
const NAMED = [
  "Trader_XO", "scottmelker", "BTC_JackSparrow", "filbfilb", "ali_charts", "KoroushAK",
  "CryptoCred", "TheCryptoLark", "MartiniGuyYT", "SatoshiStacker", "CryptoBusy",
  "TheCryptoDog", "SmartContracter",
];

// Profile-match (signal/TA trader) and disqualifiers.
const PROFILE_RE = /\b(trading|trader|technical analysis|\bTA\b|charts?|setups?|entry|entries|swing|scalp|signals?|calls?|alpha|gems?|analyst|analysis|price action|support|resistance|breakout|long|short|targets?|trade|markets?|macro|educators?|education|investor|commentator|futures|perps?|leverage|positions?)\b/i;
const PROMO_RE = /\b(dm for|promo|promotion|marketing|advertis|listing|paid (post|promo)|collab|sponsor|shill ?tank|pre-?sale|buy \$|pump your)\b/i;
// Narrow: only self-identified exchange/protocol official accounts (a person who
// merely mentions L1/L2 as a sector must NOT match — that was a false positive).
const EXCHANGE_RE = /\b(official (account|page|x account)|the official|centralized exchange|we are an exchange)\b/i;

let xCalls = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ageYears = (u: XUser): number | null => (u.created_at ? +((NOW.getTime() - new Date(u.created_at).getTime()) / (365.25 * 864e5)).toFixed(1) : null);
const snippet = (s?: string) => (s ? s.replace(/\s+/g, " ").trim().slice(0, 110) : "");
function whyMatch(bio: string): string[] {
  const hits = new Set<string>();
  const m = bio.match(new RegExp(PROFILE_RE, "gi"));
  if (m) for (const h of m) hits.add(h.toLowerCase());
  return [...hits].slice(0, 6);
}

type Vet = { handle: string; followers: number; ageY: number | null; bio: string; verdict: string; why: string[]; verified: boolean };

// strict=true (discovery): apply the full profile/anti-noise gate.
// strict=false (named, reputation-vetted): only followers + age + suspended +
// hard promo/spam — do NOT bio-gate famous callers (their bios are often just a
// title, e.g. "Product Partner @PrimeXBT", yet they are exactly the target).
function vet(u: XUser | null, handle: string, strict = true): Vet {
  if (!u) return { handle, followers: 0, ageY: null, bio: "", verdict: "OUT:suspended/not_found", why: [], verified: false };
  const followers = u.public_metrics?.followers_count ?? 0;
  const ageY = ageYears(u);
  const bio = u.description ?? "";
  const why = whyMatch(bio);
  let verdict = "PASS";
  if (followers < MIN_FOLLOWERS) verdict = `OUT:followers<100k(${followers})`;
  else if (ageY !== null && new Date(u.created_at!) > AGE_2Y) verdict = `OUT:account<2y(${ageY}y)`;
  else if (PROMO_RE.test(bio)) verdict = "OUT:promo/spam";
  else if (strict && EXCHANGE_RE.test(bio)) verdict = "OUT:exchange/protocol/builder";
  else if (strict && !PROFILE_RE.test(bio)) verdict = "OUT:bio_no_signal_profile";
  return { handle: u.username, followers, ageY, bio: snippet(bio), verdict, why, verified: !!u.verified };
}

async function lookup(handle: string): Promise<XUser | null> {
  let u: XUser | null = null;
  try { u = await getUserByUsername(handle); } catch { /* counted */ }
  xCalls++;
  await sleep(1000);
  return u;
}

async function main() {
  if (!hasToken()) throw new Error("X_BEARER_TOKEN not configured — aborting");

  const kols = await prisma.kolProfile.findMany({ select: { handle: true } });
  const known = new Set(kols.map((k) => k.handle.toLowerCase()));
  console.log(`[tony] ${known.size} KolProfile handles in exclusion set\n`);

  // ─── STEP A — reference profiles (context only) ──────────────────────────
  console.log("[A] reference handles (already in watchlist):");
  const refs: Vet[] = [];
  for (const h of REFERENCE) {
    const v = vet(await lookup(h), h);
    refs.push(v);
    console.log(`  @${v.handle.padEnd(18)} ${v.followers.toLocaleString().padStart(9)}  age=${v.ageY ?? "?"}y  ${v.verdict === "PASS" ? "matches-profile" : v.verdict}`);
  }

  // ─── STEP B — named well-known callers ───────────────────────────────────
  console.log("\n[B] vetting 13 named callers:");
  const named: Vet[] = [];
  for (const h of NAMED) {
    const v = vet(await lookup(h), h, false); // reputation-vetted, no bio gate
    v.handle && named.push(v);
    const dup = known.has(v.handle.toLowerCase()) ? " (DUP in KolProfile)" : "";
    console.log(`  @${v.handle.padEnd(18)} ${v.followers.toLocaleString().padStart(9)}  age=${v.ageY ?? "?"}y  ${v.verdict}${dup}`);
  }

  // ─── STEP C — programmatic TA-language discovery ─────────────────────────
  const QUERIES = [
    `("long entry" OR "short setup" OR "TP1" OR "TP2" OR "TP3") ($BTC OR $ETH OR $SOL) -is:retweet lang:en`,
    `("trade plan" OR "my trade" OR "trade setup" OR "my call") has:media (chart OR $BTC OR $ETH OR $SOL) -is:retweet lang:en`,
    `($BTC OR $ETH OR $SOL) (support OR resistance OR breakout OR "price action" OR "TA") has:media -is:retweet lang:en`,
    `"entry" "target" (long OR short) ($BTC OR $SOL OR crypto) -is:retweet lang:en`,
  ];
  console.log(`\n[C] TA-language discovery (cap ${MAX_CALLS} total calls)...`);
  const userById = new Map<string, XUser>();
  const sig = new Map<string, number>(); // author_id -> matching tweet count
  const lastSeen = new Map<string, Date>();
  outer: for (let q = 0; q < QUERIES.length; q++) {
    let next: string | undefined;
    for (let p = 0; p < PAGES_PER_QUERY; p++) {
      if (xCalls >= MAX_CALLS) break outer;
      let resp: { tweets: XTweet[]; users: XUser[]; nextToken?: string };
      try { resp = await searchRecentWithAuthors(QUERIES[q], 100, next); } catch { break; }
      xCalls++;
      for (const u of resp.users) userById.set(u.id, u);
      for (const tw of resp.tweets) {
        if (!tw.author_id) continue;
        sig.set(tw.author_id, (sig.get(tw.author_id) ?? 0) + 1);
        const ts = tw.created_at ? new Date(tw.created_at) : null;
        if (ts && (!lastSeen.get(tw.author_id) || ts > lastSeen.get(tw.author_id)!)) lastSeen.set(tw.author_id, ts);
      }
      console.log(`  q${q + 1} p${p + 1}: +${resp.tweets.length} tweets, ${resp.users.length} authors (calls: ${xCalls})`);
      next = resp.nextToken;
      if (!next) break;
      await sleep(1100);
    }
  }

  type Disc = Vet & { signals: number; lastSeen: Date | null };
  const discovered: Disc[] = [];
  for (const [id, u] of userById) {
    if (known.has(u.username.toLowerCase())) continue;
    const v = vet(u, u.username);
    if (v.verdict !== "PASS") continue;
    discovered.push({ ...v, signals: sig.get(id) ?? 0, lastSeen: lastSeen.get(id) ?? null });
  }
  discovered.sort((a, b) => b.followers - a.followers);

  // ─── STEP D — combined shortlist (named PASS + discovered), dedup ────────
  const tierOf = (n: number) => (n > SWEET_MAX ? "T0(>500k)" : n >= 250_000 ? "T1" : n >= 100_000 ? "T2" : "T3");
  const shortlist: (Vet & { source: string; signals?: number; lastSeen?: Date | null })[] = [];
  const seen = new Set<string>();
  for (const v of named) {
    if (v.verdict !== "PASS") continue;
    if (known.has(v.handle.toLowerCase())) continue;
    const k = v.handle.toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    shortlist.push({ ...v, why: v.why.length ? v.why : ["reputation-vetted"], source: "named-caller" });
  }
  for (const d of discovered) {
    const k = d.handle.toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    shortlist.push({ ...d, source: "discovered-TA" });
  }
  shortlist.sort((a, b) => b.followers - a.followers);

  // Report
  const fmtDate = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
  const L: string[] = [];
  L.push("# CryptoTony-type candidates (TA/signal callers, 100k-500k, age>2y) — 2026-06-12");
  L.push("");
  L.push(`Target: established TA/signal caller, 100k-500k followers, >2y old, trading/TA/calls/signals/alpha bio.`);
  L.push(`Excludes paid-promo, gem-spam, builders, exchanges/protocols, and KolProfile duplicates.`);
  L.push(`X API calls: ${xCalls} (~$${(xCalls * 0.01).toFixed(2)}). Helius: 0.`);
  L.push("");
  L.push("## Reference profiles (already in watchlist — similarity anchors)");
  L.push("| handle | followers | age_y | bio |");
  L.push("|--------|-----------|-------|-----|");
  for (const r of refs) L.push(`| @${r.handle} | ${r.followers.toLocaleString()} | ${r.ageY ?? "?"} | ${r.bio.replace(/\|/g, "/")} |`);
  L.push("");
  L.push(`## Combined shortlist (${shortlist.length}) — ranked by followerCount`);
  L.push("| # | handle | followerCount | account_age_years | tier | source | bio_snippet | why_match |");
  L.push("|---|--------|---------------|-------------------|------|--------|-------------|-----------|");
  shortlist.forEach((s, i) =>
    L.push(`| ${i + 1} | @${s.handle} | ${s.followers.toLocaleString()} | ${s.ageY ?? "?"} | ${tierOf(s.followers)} | ${s.source} | ${s.bio.replace(/\|/g, "/")} | ${s.why.join(", ")} |`),
  );
  L.push("");
  L.push("## Named callers rejected");
  for (const v of named.filter((v) => v.verdict !== "PASS" || known.has(v.handle.toLowerCase()))) {
    const r = known.has(v.handle.toLowerCase()) ? "already in KolProfile" : v.verdict;
    L.push(`- @${v.handle} (${v.followers.toLocaleString()}, ${v.ageY ?? "?"}y) — ${r}`);
  }
  L.push("");
  writeFileSync(OUT, L.join("\n"), "utf8");

  // STEP D print
  const top30 = shortlist.slice(0, 30);
  console.log("\n========================================");
  console.log("CRYPTOTONY-TYPE SHORTLIST");
  console.log("========================================");
  console.log(`Named callers PASS (non-dup): ${shortlist.filter((s) => s.source === "named-caller").length} | Discovered-TA PASS: ${shortlist.filter((s) => s.source === "discovered-TA").length} | combined: ${shortlist.length}`);
  console.log(`\nTop ${top30.length} by followers:`);
  console.log("#   handle                 followers   age  tier      source         why_match");
  top30.forEach((s, i) =>
    console.log(
      `${String(i + 1).padStart(2)}. @${s.handle.padEnd(18)} ${s.followers.toLocaleString().padStart(9)}  ${String(s.ageY ?? "?").padStart(4)}y ${tierOf(s.followers).padEnd(9)} ${s.source.padEnd(14)} ${s.why.slice(0, 4).join(",")}`,
    ),
  );
  console.log(`\nReport → ${OUT}`);
  console.log(`X API calls: ${xCalls} (~$${(xCalls * 0.01).toFixed(2)}) | Helius: 0`);
  console.log("========================================");
}

main()
  .catch((e) => { console.error("[tony] failed", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); process.exit(process.exitCode ?? 0); });
