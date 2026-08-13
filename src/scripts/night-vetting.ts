/**
 * src/scripts/night-vetting.ts
 * Auto-vetting of the 29 newly-added draft KolProfiles (2026-06-13 night session).
 * SHADOW MODE / REPORT ONLY: no KolProfile.status change, no DB writes.
 *
 * STEP 1 activity profiling via X API (lookup + 100-tweet timeline per handle)
 * STEP 2 cross-reference with SocialPostCandidate / KolWallet / casefiles / ShillBuyerObservation
 * STEP 3 wallet discovery from tweets + bio (on-chain web checks done separately by the agent)
 * STEP 4 classification
 *
 * Writes:
 *   /tmp/night-vetting-data.json              (machine-readable, for the agent's web step)
 *   /tmp/night-vetting-report-2026-06-13.md   (human report, STEP 5)
 *   MIGRATION_kol_activity_profile_v1.sql     (additive table, NOT applied)
 *
 * Usage: pnpm tsx -r dotenv/config src/scripts/night-vetting.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { getUserByUsername, getUserTimeline, hasToken, isSpendCapped, spendCapResetDate, type XUser } from "@/lib/xapi/client";

const NOW = new Date("2026-06-13T00:00:00Z");
const AGE_2Y = new Date("2024-06-13T00:00:00Z");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const WAVES: Record<string, { tier: string; handles: string[] }> = {
  signal_caller: { tier: "T1", handles: ["scottmelker", "TheCryptoDog", "CryptoCred", "MartiniGuyYT", "Trader_XO", "DaanCrypto", "KoroushAK", "CryptoBusy", "52kskew", "CryptoJelleNL", "CastilloTrading", "cryptoWZRD_"] },
  organic_mention: { tier: "T2", handles: ["amitisinvesting", "0xMerp", "0xRiver8", "0xCryptoshi", "0xEthan", "Jackkk", "0xMakesy", "0xuberM", "0xkyle__", "0xBiZzy", "0xSammy", "0xIT4I", "0xAbhiP"] },
  promo_watch: { tier: "T3", handles: ["cryptogems555", "Alanlegits", "CryptoThro", "alterfind_"] },
};

const TICKER_RE = /\$[A-Za-z][A-Za-z0-9]{1,9}\b/g;
const CA_RE = /\b(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g;
const ENS_RE = /\b([a-zA-Z0-9_]{2,30}\.(?:sol|eth))\b/gi;
const WALLET_CTX_RE = /(my wallet|my address|my sol|my eth|deposit|send to|tip jar|donate|ca:)/i;

const SHILL_TERMS: [string, RegExp][] = [
  ["100x", /\b100x\b/gi], ["1000x", /\b1000x\b/gi], ["gem", /\bgems?\b/gi],
  ["ape", /\bap(e|ing)\b/gi], ["moon", /\bmoon(ing|shot)?\b/gi],
  ["called it", /called it/gi], ["alpha drop", /alpha drop/gi],
];
const TA_TERMS: [string, RegExp][] = [
  ["support", /\bsupport\b/gi], ["resistance", /\bresistance\b/gi], ["TP", /\btp[123]\b/gi],
  ["long entry", /long entry/gi], ["short setup", /short setup/gi],
  ["fib", /\bfib(onacci)?\b/gi], ["RSI", /\brsi\b/gi],
];
const countTerms = (text: string, terms: [string, RegExp][]) =>
  terms.reduce((sum, [, re]) => sum + (text.match(re)?.length ?? 0), 0);

type Profile = {
  handle: string; wave: string; tier: string;
  found: boolean; followers: number; ageY: number | null; verified: boolean; bio: string;
  tweetsAnalyzed: number; periodDays: number; tweetsPerDay: number;
  uniqueTickers: number; uniqueCAs: number; mediaTweetRatio: number; photoRatio: number;
  avgEngagement: number; engagementRatio: number; mentionToFollowersRatio: number;
  shillScore: number; taScore: number;
  walletCandidates: { value: string; chain: string; confidence: string; proof: string }[];
  xref: { dbReferrers: number; dbMentions: number; existingWallets: string[]; casefileHits: string[]; buyerWalletHits: string[] };
  classification: string;
};

async function main() {
  if (!hasToken()) throw new Error("X_BEARER_TOKEN not configured — aborting");
  let xCalls = 0;

  // ── cross-ref data (read-only) ──────────────────────────────────────────
  const allHandles = Object.values(WAVES).flatMap((w) => w.handles);
  const handleLc = new Set(allHandles.map((h) => h.toLowerCase()));

  const candidates = await prisma.socialPostCandidate.findMany({ where: { rawText: { not: null } }, select: { rawText: true, influencerId: true } });
  const mentionMap = new Map<string, { referrers: Set<string>; mentions: number }>();
  const MENTION_RE = /@([A-Za-z0-9_]{1,15})/g;
  for (const c of candidates) {
    const seen = new Set<string>();
    let m: RegExpExecArray | null; MENTION_RE.lastIndex = 0;
    while ((m = MENTION_RE.exec(c.rawText ?? "")) !== null) {
      const k = m[1].toLowerCase();
      if (!handleLc.has(k) || seen.has(k)) continue; seen.add(k);
      let e = mentionMap.get(k); if (!e) { e = { referrers: new Set(), mentions: 0 }; mentionMap.set(k, e); }
      e.referrers.add(c.influencerId); e.mentions++;
    }
  }

  const existingWallets = await prisma.$queryRawUnsafe<{ kolHandle: string; address: string; chain: string }[]>(
    `SELECT "kolHandle","address","chain" FROM "KolWallet" WHERE lower("kolHandle") = ANY($1::text[])`, allHandles.map((h) => h.toLowerCase()),
  );
  const caseRows = await prisma.$queryRawUnsafe<{ kolHandle: string; src: string }[]>(
    `SELECT "kolHandle", 'KolCase' src FROM "KolCase" WHERE lower("kolHandle") = ANY($1::text[])
     UNION ALL SELECT "kolHandle",'KolEvidence' FROM "KolEvidence" WHERE lower("kolHandle") = ANY($1::text[])
     UNION ALL SELECT "kolHandle",'KolTokenLink' FROM "KolTokenLink" WHERE lower("kolHandle") = ANY($1::text[])`,
    allHandles.map((h) => h.toLowerCase()),
  );
  const buyerWallets = new Set(
    (await prisma.$queryRawUnsafe<{ wallet: string }[]>(`SELECT DISTINCT "wallet" FROM "ShillBuyerObservation"`)).map((r) => r.wallet),
  );
  console.log(`[xref] candidates=${candidates.length} mentionedHandles=${mentionMap.size} existingWallets=${existingWallets.length} casefileHits=${caseRows.length} buyerWallets=${buyerWallets.size}`);

  // ── per-handle profiling ────────────────────────────────────────────────
  // --only=h1,h2 re-profiles a subset and MERGES into existing JSON (for retrying
  // handles throttled by transient X 403s without re-spending calls on the rest).
  const onlyArg = process.argv.slice(2).find((a) => a.startsWith("--only="));
  const onlySet = onlyArg ? new Set(onlyArg.slice(7).split(",").map((s) => s.toLowerCase())) : null;
  const workList: { wave: string; tier: string; handle: string }[] = [];
  for (const [wave, { tier, handles }] of Object.entries(WAVES))
    for (const handle of handles)
      if (!onlySet || onlySet.has(handle.toLowerCase())) workList.push({ wave, tier, handle });

  const profiles: Profile[] = [];
  {
    for (const { wave, tier, handle } of workList) {
      const key = handle.toLowerCase();
      const p: Profile = {
        handle, wave, tier, found: false, followers: 0, ageY: null, verified: false, bio: "",
        tweetsAnalyzed: 0, periodDays: 0, tweetsPerDay: 0, uniqueTickers: 0, uniqueCAs: 0, mediaTweetRatio: 0, photoRatio: 0,
        avgEngagement: 0, engagementRatio: 0, mentionToFollowersRatio: 0, shillScore: 0, taScore: 0,
        walletCandidates: [], classification: "requires_manual_review",
        xref: {
          dbReferrers: mentionMap.get(key)?.referrers.size ?? 0,
          dbMentions: mentionMap.get(key)?.mentions ?? 0,
          existingWallets: existingWallets.filter((w) => w.kolHandle.toLowerCase() === key).map((w) => `${w.chain}:${w.address}`),
          casefileHits: [...new Set(caseRows.filter((c) => c.kolHandle.toLowerCase() === key).map((c) => c.src))],
          buyerWalletHits: [],
        },
      };

      // Graceful-halt guard: once the X billing spend cap is hit, every read
      // returns 403. Do NOT mislabel those handles as not_found/excluded —
      // skip them with a distinct classification so the run stays truthful.
      if (isSpendCapped()) {
        p.classification = "skipped_x_quota";
        profiles.push(p);
        console.log(`  @${handle.padEnd(18)} SKIPPED — X spend cap active (reset ${spendCapResetDate() ?? "?"})`);
        continue;
      }

      let u: XUser | null = null;
      try { u = await getUserByUsername(handle); } catch { /* counted */ }
      xCalls++;
      await sleep(900);

      if (!u) {
        // The lookup that just tripped the cap lands here — distinguish it from
        // a genuine suspended/not_found before classifying.
        if (isSpendCapped()) {
          p.classification = "skipped_x_quota";
          profiles.push(p);
          console.log(`  @${handle.padEnd(18)} SKIPPED — X spend cap (reset ${spendCapResetDate() ?? "?"})`);
          continue;
        }
        p.classification = "excluded"; // genuine suspended / not_found
        profiles.push(p);
        console.log(`  @${handle.padEnd(18)} NOT FOUND -> excluded`);
        continue;
      }
      p.found = true;
      p.followers = u.public_metrics?.followers_count ?? 0;
      p.verified = !!u.verified;
      p.bio = (u.description ?? "").replace(/\s+/g, " ").trim();
      p.ageY = u.created_at ? +((NOW.getTime() - new Date(u.created_at).getTime()) / (365.25 * 864e5)).toFixed(1) : null;

      const tweets = await getUserTimeline(u.id, 100);
      xCalls++;
      await sleep(900);

      p.tweetsAnalyzed = tweets.length;
      if (tweets.length) {
        const dates = tweets.map((t) => (t.created_at ? new Date(t.created_at).getTime() : 0)).filter(Boolean).sort();
        const spanDays = dates.length > 1 ? (dates[dates.length - 1] - dates[0]) / 864e5 : 1;
        p.periodDays = +spanDays.toFixed(1);
        p.tweetsPerDay = +(tweets.length / Math.max(spanDays, 1)).toFixed(2);
        const allText = tweets.map((t) => t.text).join("\n");
        p.uniqueTickers = new Set((allText.match(TICKER_RE) ?? []).map((s) => s.toLowerCase())).size;
        p.uniqueCAs = new Set(allText.match(CA_RE) ?? []).size;
        p.mediaTweetRatio = +(tweets.filter((t) => t.hasMedia).length / tweets.length).toFixed(2);
        p.photoRatio = +(tweets.filter((t) => t.photoCount > 0).length / tweets.length).toFixed(2);
        const eng = tweets.map((t) => (t.public_metrics ? t.public_metrics.like_count + t.public_metrics.retweet_count + t.public_metrics.reply_count : 0));
        p.avgEngagement = Math.round(eng.reduce((a, b) => a + b, 0) / tweets.length);
        p.engagementRatio = p.followers ? +(p.avgEngagement / p.followers).toFixed(5) : 0;
        p.shillScore = countTerms(allText, SHILL_TERMS);
        p.taScore = countTerms(allText, TA_TERMS);

        // wallet discovery from tweets + bio
        const walletText = p.bio + "\n" + tweets.filter((t) => WALLET_CTX_RE.test(t.text)).map((t) => t.text).join("\n");
        const ens = [...new Set((p.bio + " " + allText).match(ENS_RE) ?? [])];
        for (const e of ens) p.walletCandidates.push({ value: e, chain: e.toLowerCase().endsWith(".sol") ? "SOL" : "ETH", confidence: ENS_RE.test(p.bio) ? "high" : "medium", proof: `name-service handle in bio/tweets` });
        const cas = [...new Set(walletText.match(CA_RE) ?? [])].filter((a) => !ens.includes(a));
        for (const a of cas) {
          const chain = a.startsWith("0x") ? "ETH" : "SOL";
          const inBio = p.bio.includes(a);
          p.walletCandidates.push({ value: a, chain, confidence: inBio || WALLET_CTX_RE.test(walletText) ? "high" : "low", proof: inBio ? "address in bio" : "address near wallet-context phrase" });
        }
      }
      p.mentionToFollowersRatio = p.followers ? +((p.xref.dbMentions / p.followers) * 1000).toFixed(4) : 0;

      // cross-ref discovered wallets vs ShillBuyerObservation
      p.xref.buyerWalletHits = p.walletCandidates.filter((w) => buyerWallets.has(w.value)).map((w) => w.value);

      // ── STEP 4 classification ──
      const promoBio = /\b(dm for (collab|promo|business|inquir)|marketing|advertis|listing|paid promo|promote your)\b/i.test(p.bio);
      const hashtagSpam = (p.bio.match(/#/g) ?? []).length >= 4;
      const lowEng = p.engagementRatio > 0 && p.engagementRatio < 0.0005;
      if (p.tweetsPerDay > 30 && lowEng) p.classification = "bot_suspected";
      else if (promoBio || (hashtagSpam && p.taScore < 2) || (p.shillScore > p.taScore && p.taScore < 2 && p.shillScore >= 3)) p.classification = "paid_promo";
      else if (p.taScore > p.shillScore && (p.ageY ?? 0) >= 2 && !promoBio) p.classification = "confirmed_signal_caller";
      else p.classification = "requires_manual_review";

      profiles.push(p);
      console.log(`  @${handle.padEnd(18)} ${String(p.followers).padStart(8)} age=${p.ageY}y tw=${p.tweetsAnalyzed} t/d=${p.tweetsPerDay} TA=${p.taScore} shill=${p.shillScore} tick=${p.uniqueTickers} -> ${p.classification}`);
    }
  }

  // ── outputs ─────────────────────────────────────────────────────────────
  let finalProfiles = profiles;
  if (onlySet) {
    // merge: keep existing profiles, replace the re-profiled handles
    let prev: Profile[] = [];
    try { prev = JSON.parse(readFileSync("/tmp/night-vetting-data.json", "utf8")).profiles ?? []; } catch { /* none */ }
    const replaced = new Set(profiles.map((p) => p.handle.toLowerCase()));
    finalProfiles = [...prev.filter((p) => !replaced.has(p.handle.toLowerCase())), ...profiles];
    // preserve canonical wave order
    const order = Object.values(WAVES).flatMap((w) => w.handles.map((h) => h.toLowerCase()));
    finalProfiles.sort((a, b) => order.indexOf(a.handle.toLowerCase()) - order.indexOf(b.handle.toLowerCase()));
    console.log(`[merge] re-profiled ${profiles.length}, merged into ${finalProfiles.length} total`);
  }
  writeFileSync("/tmp/night-vetting-data.json", JSON.stringify({ generatedAt: "2026-06-13", xCalls, profiles: finalProfiles }, null, 2));
  writeFileSync("MIGRATION_kol_activity_profile_v1.sql", MIGRATION_SQL);

  const quotaSkipped = profiles.filter((p) => p.classification === "skipped_x_quota").length;
  console.log(`\n[done] xCalls=${xCalls} profiles=${finalProfiles.length} -> /tmp/night-vetting-data.json`);
  console.log(`[budget] X API calls: ${xCalls} (~$${(xCalls * 0.01).toFixed(2)})`);
  if (isSpendCapped()) {
    console.log(`[spend-cap] ⚠️  X billing spend cap hit mid-run (reset ${spendCapResetDate() ?? "?"}). ` +
      `${quotaSkipped} handle(s) marked 'skipped_x_quota' (NOT excluded) — re-run after the cap lifts to complete them.`);
  }
}

const MIGRATION_SQL = `-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION_kol_activity_profile_v1.sql
-- INTERLIGENS — KolActivityProfile (auto-vetting metrics, additive, shadow mode)
-- Run manually in the Neon SQL Editor (ep-square-band). Never prisma db push.
-- Author: David Pandora / INTERLIGENS  ·  Date: 2026-06-13
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;
CREATE TABLE IF NOT EXISTS "KolActivityProfile" (
  "id"                       TEXT PRIMARY KEY,
  "kolHandle"                TEXT NOT NULL UNIQUE,
  "computedAt"               TIMESTAMP(3) NOT NULL DEFAULT now(),
  "tweetsAnalyzed"           INTEGER NOT NULL DEFAULT 0,
  "periodDays"               DOUBLE PRECISION,
  "tweetsPerDay"             DOUBLE PRECISION,
  "uniqueTickers"            INTEGER,
  "uniqueCAs"                INTEGER,
  "mediaTweetRatio"          DOUBLE PRECISION,
  "mentionToFollowersRatio"  DOUBLE PRECISION,
  "shillLanguageScore"       INTEGER,
  "taLanguageScore"          INTEGER,
  "classification"           TEXT,
  "raw"                      JSONB
);
CREATE INDEX IF NOT EXISTS "KolActivityProfile_classification_idx" ON "KolActivityProfile" ("classification");
COMMIT;
-- Verify: SELECT "classification", COUNT(*) FROM "KolActivityProfile" GROUP BY 1;
`;

main()
  .catch((e) => { console.error("[night-vetting] failed", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); process.exit(process.exitCode ?? 0); });
