// ─────────────────────────────────────────────────────────────────────────
// SEED — $BULLISH casefile (cross-case BOTIFY/GHOST)
//
// Source of truth   : src/scripts/seed/casefiles/bullish_seed.json
// DB                : ep-square-band (prod)
// Default mode      : DRY-RUN (read-only, plans logged, no INSERT/UPDATE)
// Write mode        : SEED_BULLISH=1 pnpm tsx src/scripts/seed/seedBullish.ts
//
// Tables touched (in transaction):
//   - TokenPriceTracker   upsert by (chain, contractAddress)
//   - KolProfile          create only for {trade, moonbag, SolBullishDegen}
//                         GordonGekko + DonWedge are LEFT UNTOUCHED
//                         (preserve BOTIFY fields per Dood's instruction)
//   - KolTokenLink        upsert by (kolHandle, contractAddress, chain)
//   - KolPromotionMention upsert by (sourcePlatform, sourcePostId)
//
// Schema gaps recorded in MIGRATION_RETAILVISION.md, not modified here.
// ─────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import crypto from "crypto";

const envLocal = fs.readFileSync(
  path.join(process.cwd(), ".env.local"),
  "utf8",
);
const dbUrl = envLocal.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!dbUrl) {
  console.error("[fatal] DATABASE_URL missing from .env.local");
  process.exit(1);
}
// Fail-fast: only seed against ep-square-band.
if (!dbUrl.includes("ep-square-band")) {
  console.error("[fatal] DATABASE_URL is not ep-square-band — refusing to seed");
  process.exit(1);
}
process.env.DATABASE_URL = dbUrl;

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COMMIT = process.env.SEED_BULLISH === "1";
const SEED_RUN_TAG = `bullish_seed_2026-05-14`;
const CASE_ID = "BULLISH";
const TOKEN_MINT = "C2omVhcvt3DDY77S2KZzawFJQeETZofgZ4eNWWkXpump";
const TOKEN_SYMBOL = "BULLISH";
const CHAIN = "solana";

interface PromotionMention {
  handle: string;
  url?: string;
  url_partial?: string;
  post_id?: string;
  post_id_or_url_partial?: string;
  posted_at: string;
  claim: string;
  engagement?: Record<string, number>;
  criticality?: string;
}

interface CasefileJson {
  _meta: Record<string, unknown>;
  token: Record<string, unknown>;
  manipulation_evidence: Record<string, unknown>;
  actors: {
    primary_dev: { handle: string; display_name: string; bio?: string; verified?: boolean; role?: string; tigerscore_recommended?: number; first_bullish_tweet_date?: string };
    official_account: { handle: string; display_name: string; verified?: boolean; role?: string; telegram?: string };
    core_amplifiers: Array<{
      handle: string;
      display_name?: string;
      verified?: boolean;
      followers_approx?: number | null;
      bio?: string;
      affiliations?: string[];
      role?: string;
      tigerscore_recommended?: number;
      already_in_botify_dossier?: boolean;
      telegram?: string;
      telegrams?: string[];
      noteworthy?: string;
    }>;
    peripheral_amplifiers_to_investigate: Array<{ handle: string; reason: string }>;
  };
  promotion_mentions: PromotionMention[];
  cross_case_links: Record<string, unknown>;
  external_evidence_to_ingest: Record<string, unknown>;
}

// Actors we are allowed to CREATE if not present in DB.
const CREATE_ALLOWLIST = new Set(["trade", "moonbag", "SolBullishDegen"]);

function extractPostId(m: PromotionMention): string | null {
  if (m.post_id) return m.post_id;
  const urlish = m.url ?? m.url_partial ?? m.post_id_or_url_partial;
  if (!urlish) return null;
  const match = urlish.match(/status\/(\d{18,20})/);
  return match?.[1] ?? null;
}

function synthPostId(m: PromotionMention): string {
  // Deterministic synthetic id when X did not give us a real status id.
  // Format `seed_<sha1(handle|posted_at|claim).slice(0,12)>` — unique enough at
  // this seed size, clearly identifiable as synthetic vs real X numeric ids.
  const h = crypto
    .createHash("sha1")
    .update(`${m.handle}|${m.posted_at}|${m.claim ?? ""}`)
    .digest("hex");
  return `seed_${h.slice(0, 12)}`;
}

function parsePostedAt(s: string): Date | null {
  if (!s || /XX/.test(s)) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function sourceUrl(m: PromotionMention, postId: string | null, synthetic: boolean): string {
  if (m.url) return m.url;
  if (m.url_partial) return m.url_partial.startsWith("http") ? m.url_partial : `https://${m.url_partial}`;
  if (postId && !synthetic) return `https://x.com/${m.handle}/status/${postId}`;
  return `https://x.com/${m.handle}`;
}

async function main() {
  console.log(`\n=== seedBullish — mode=${COMMIT ? "COMMIT" : "DRY-RUN"} ===\n`);

  const jsonPath = path.join(
    process.cwd(),
    "src/scripts/seed/casefiles/bullish_seed.json",
  );
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as CasefileJson;

  // ── Pre-flight consistency check ────────────────────────────────────────
  console.log("[pre-flight] checking for existing $BULLISH traces in DB…");
  const trace = await prisma.$queryRaw<Array<{ src: string; n: number }>>`
    SELECT 'TokenPriceTracker' AS src, COUNT(*)::int AS n FROM "TokenPriceTracker"
      WHERE LOWER("contractAddress") = LOWER(${TOKEN_MINT})
    UNION ALL
    SELECT 'KolTokenLink', COUNT(*)::int FROM "KolTokenLink"
      WHERE LOWER("contractAddress") = LOWER(${TOKEN_MINT})
    UNION ALL
    SELECT 'KolPromotionMention', COUNT(*)::int FROM "KolPromotionMention"
      WHERE "tokenMint" = ${TOKEN_MINT}
    UNION ALL
    SELECT 'KolProceedsEvent', COUNT(*)::int FROM "KolProceedsEvent"
      WHERE LOWER("tokenAddress") = LOWER(${TOKEN_MINT})`;
  for (const r of trace) console.log(`  ${r.src.padEnd(22)} existing rows: ${r.n}`);
  // Non-zero on any table while seed has not yet run = potential conflict.
  const conflicts = trace.filter((r) => r.n > 0);

  // ── Actor presence map ──────────────────────────────────────────────────
  const handleSet = new Set<string>();
  handleSet.add(data.actors.primary_dev.handle);
  handleSet.add(data.actors.official_account.handle);
  for (const a of data.actors.core_amplifiers) handleSet.add(a.handle);
  const handles = [...handleSet];
  const presence = new Map<string, { id: string; existing: boolean } | null>();
  for (const h of handles) {
    const rows = await prisma.$queryRaw<Array<{ id: string; handle: string }>>`
      SELECT id, handle FROM "KolProfile" WHERE LOWER(handle) = LOWER(${h}) LIMIT 1`;
    presence.set(h, rows[0] ? { id: rows[0].id, existing: true } : null);
  }
  console.log("\n[pre-flight] actor presence in KolProfile:");
  for (const h of handles) {
    const v = presence.get(h);
    const tag = v ? `FOUND id=${v.id.slice(0, 12)}…` : "NOT FOUND";
    const action = v
      ? CREATE_ALLOWLIST.has(h) ? "(in create list but exists → upsert merge)" : "(existing → links only, profile untouched)"
      : CREATE_ALLOWLIST.has(h) ? "(will CREATE)" : "(NOT in create allowlist → warning, skip)";
    console.log(`  ${h.padEnd(22)} ${tag.padEnd(35)} ${action}`);
  }

  // Cross-case warning: JSON references Geppetto_88 but DB stores it as Geppetto
  const geppetto = await prisma.$queryRaw<Array<{ handle: string }>>`
    SELECT handle FROM "KolProfile" WHERE handle ILIKE '%gepp%'`;
  if (geppetto.length > 0 && !geppetto.some((g) => g.handle === "Geppetto_88")) {
    console.log(
      `\n[warning] JSON cross-case link references "Geppetto_88" but DB stores "${geppetto[0].handle}". Cross-case link will be logged as MANUAL FOLLOW-UP, not created.`,
    );
  }

  if (conflicts.length > 0) {
    console.log(
      `\n[STOP] non-zero existing $BULLISH rows: ${conflicts.map((c) => `${c.src}=${c.n}`).join(", ")}. Refuse to seed. Aborting.`,
    );
    await prisma.$disconnect();
    process.exit(2);
  }

  // ── Plan ────────────────────────────────────────────────────────────────
  console.log("\n[plan] operations to perform:");

  // 1. TokenPriceTracker
  console.log(`  TokenPriceTracker      upsert by (chain='${CHAIN}', contractAddress=${TOKEN_MINT.slice(0, 12)}…)`);

  // 2. KolProfile creates
  const profileCreatePlan: Array<{ handle: string; payload: Record<string, unknown> }> = [];
  const skippedProfileReasons: string[] = [];

  const trade = data.actors.primary_dev;
  if (!presence.get(trade.handle)) {
    profileCreatePlan.push({
      handle: trade.handle,
      payload: {
        handle: trade.handle,
        displayName: trade.display_name,
        platform: "x",
        label: "suspect",
        riskFlag: "high_risk_dev",
        verified: trade.verified === true,
        bio: trade.bio ?? null,
        tier: "CRITICAL",
        pdfScore: trade.tigerscore_recommended ?? null,
        notes: `Role: ${trade.role ?? ""}. First $BULLISH tweet: ${trade.first_bullish_tweet_date ?? "?"}. Seeded ${SEED_RUN_TAG}.`,
        behaviorFlags: JSON.stringify(["dev_concealment", "post_exposure_persistence"]),
        publishStatus: "draft",
        editorialStatus: "pending",
      },
    });
  } else if (CREATE_ALLOWLIST.has(trade.handle)) {
    skippedProfileReasons.push(`${trade.handle}: in create allowlist BUT already exists → no overwrite`);
  }

  const official = data.actors.official_account;
  if (!presence.get(official.handle)) {
    profileCreatePlan.push({
      handle: official.handle,
      payload: {
        handle: official.handle,
        displayName: official.display_name,
        platform: "x",
        label: "suspect",
        riskFlag: "official_project_account",
        verified: official.verified === true,
        notes: `Role: ${official.role ?? "Official project account"}. Telegram: ${official.telegram ?? ""}. Seeded ${SEED_RUN_TAG}.`,
        tier: "HIGH",
        publishStatus: "draft",
      },
    });
  }

  for (const amp of data.actors.core_amplifiers) {
    const v = presence.get(amp.handle);
    if (v) {
      skippedProfileReasons.push(
        `${amp.handle}: already exists in DB → KolProfile UNTOUCHED (preserve BOTIFY fields), only KolTokenLink + KolPromotionMention created`,
      );
      continue;
    }
    if (!CREATE_ALLOWLIST.has(amp.handle)) {
      skippedProfileReasons.push(`${amp.handle}: not in DB, not in create allowlist → SKIP, will not invent`);
      continue;
    }
    profileCreatePlan.push({
      handle: amp.handle,
      payload: {
        handle: amp.handle,
        displayName: amp.display_name ?? null,
        platform: "x",
        label: "suspect",
        riskFlag: amp.role?.toLowerCase().includes("amplifier") ? "amplifier_cluster" : "suspect",
        verified: amp.verified === true,
        followerCount: amp.followers_approx ?? null,
        bio: amp.bio ?? null,
        notes: `Role: ${amp.role ?? ""}. Affiliations: ${(amp.affiliations ?? []).join(", ")}. ${amp.noteworthy ?? ""} Seeded ${SEED_RUN_TAG}.`.trim(),
        tier: "CRITICAL",
        pdfScore: amp.tigerscore_recommended ?? null,
        behaviorFlags: JSON.stringify(["amplifier", amp.already_in_botify_dossier ? "cross_case_botify" : "isolated"]),
        publishStatus: "draft",
        editorialStatus: "pending",
      },
    });
  }
  for (const r of skippedProfileReasons) console.log(`    [skip] ${r}`);
  for (const p of profileCreatePlan) {
    console.log(`    [create] KolProfile handle=${p.handle} tier=${p.payload.tier} pdfScore=${p.payload.pdfScore}`);
  }

  // 3. KolPromotionMention plan
  const mentionPlan: Array<{
    handle: string;
    payload: {
      kolHandle: string;
      chain: string;
      tokenMint: string;
      tokenSymbol: string;
      sourcePlatform: string;
      sourcePostId: string;
      sourceUrl: string;
      postedAt: Date;
      contentSnippet: string;
      watcherRunId: string;
    };
    synthetic: boolean;
  }> = [];
  const mentionSkipped: string[] = [];

  for (const m of data.promotion_mentions) {
    // Skip mentions for handles we have no profile for (and won't create).
    const hasOrWillCreate =
      presence.get(m.handle) || profileCreatePlan.some((p) => p.handle === m.handle);
    if (!hasOrWillCreate) {
      mentionSkipped.push(`${m.handle} @ ${m.posted_at}: no profile (existing or planned) → skip`);
      continue;
    }
    const date = parsePostedAt(m.posted_at);
    if (!date) {
      mentionSkipped.push(`${m.handle} @ ${m.posted_at}: malformed posted_at → skip`);
      continue;
    }
    let postId = extractPostId(m);
    const synthetic = !postId;
    if (synthetic) postId = synthPostId(m);
    const claim = (m.claim ?? "").trim();
    const metaSuffix =
      m.engagement || m.criticality
        ? `\n[meta] ${JSON.stringify({ engagement: m.engagement ?? null, criticality: m.criticality ?? null })}`
        : "";
    const snippet = `${claim}${metaSuffix}`.slice(0, 2000);
    mentionPlan.push({
      handle: m.handle,
      synthetic,
      payload: {
        kolHandle: m.handle,
        chain: CHAIN,
        tokenMint: TOKEN_MINT,
        tokenSymbol: TOKEN_SYMBOL,
        sourcePlatform: "x",
        sourcePostId: postId!,
        sourceUrl: sourceUrl(m, postId, synthetic),
        postedAt: date,
        contentSnippet: snippet,
        watcherRunId: SEED_RUN_TAG,
      },
    });
  }
  const mentionByHandle = new Map<string, number>();
  for (const m of mentionPlan) mentionByHandle.set(m.handle, (mentionByHandle.get(m.handle) ?? 0) + 1);
  for (const r of mentionSkipped) console.log(`    [skip mention] ${r}`);
  console.log(`    [mentions] total=${mentionPlan.length}, synthetic=${mentionPlan.filter((p) => p.synthetic).length}`);
  for (const [h, n] of mentionByHandle) console.log(`      ${h.padEnd(20)} ${n} mentions`);

  // 4. KolTokenLink plan — one per (actor, BULLISH)
  function linkRole(handle: string): string {
    if (handle === "trade" || handle === "SolBullishDegen") return "dev";
    return "amplifier";
  }
  const linkActors = [
    data.actors.primary_dev.handle,
    data.actors.official_account.handle,
    ...data.actors.core_amplifiers.map((a) => a.handle),
  ];
  const linkPlan: Array<{
    handle: string;
    payload: { kolHandle: string; contractAddress: string; chain: string; tokenSymbol: string; role: string; caseId: string; note: string };
  }> = [];
  for (const handle of linkActors) {
    const hasOrWillCreate = presence.get(handle) || profileCreatePlan.some((p) => p.handle === handle);
    if (!hasOrWillCreate) {
      console.log(`    [skip link] ${handle}: no profile`);
      continue;
    }
    const myMentions = mentionPlan.filter((m) => m.handle === handle);
    const dates = myMentions.map((m) => m.payload.postedAt.toISOString()).sort();
    const noteJson = {
      firstPromotionAt: dates[0] ?? null,
      lastPromotionAt: dates[dates.length - 1] ?? null,
      mentionCount: myMentions.length,
      seededFrom: SEED_RUN_TAG,
    };
    linkPlan.push({
      handle,
      payload: {
        kolHandle: handle,
        contractAddress: TOKEN_MINT,
        chain: CHAIN,
        tokenSymbol: TOKEN_SYMBOL,
        role: linkRole(handle),
        caseId: CASE_ID,
        note: JSON.stringify(noteJson),
      },
    });
  }
  for (const l of linkPlan) {
    console.log(`    [link] ${l.handle.padEnd(20)} role=${l.payload.role} case=${l.payload.caseId} note=${l.payload.note}`);
  }

  // Cross-case + peripheral logging — never auto-create
  console.log("\n[cross-case links — MANUAL FOLLOW-UP needed]:");
  for (const link of (data.cross_case_links as { to_botify?: string[] }).to_botify ?? []) {
    console.log(`  - ${link}`);
  }
  console.log("\n[peripheral_amplifiers_to_investigate — NOT seeded, OSINT pending]:");
  for (const p of data.actors.peripheral_amplifiers_to_investigate) {
    console.log(`  - ${p.handle.padEnd(22)} reason: ${p.reason}`);
  }

  // ── DRY RUN exit ────────────────────────────────────────────────────────
  if (!COMMIT) {
    console.log(`\n[done] DRY-RUN complete. Pass SEED_BULLISH=1 to write to ${dbUrl.match(/ep-[a-z0-9-]+/)?.[0]}.`);
    await prisma.$disconnect();
    return;
  }

  // ── WRITE (single transaction) ──────────────────────────────────────────
  console.log("\n[write] starting transaction…");
  const result = await prisma.$transaction(async (tx) => {
    // 1. TokenPriceTracker
    await tx.tokenPriceTracker.upsert({
      where: { chain_contractAddress: { chain: CHAIN, contractAddress: TOKEN_MINT } },
      update: { ticker: TOKEN_SYMBOL, source: SEED_RUN_TAG, lastRefreshAt: new Date() },
      create: {
        ticker: TOKEN_SYMBOL,
        chain: CHAIN,
        contractAddress: TOKEN_MINT,
        source: SEED_RUN_TAG,
        lastRefreshAt: new Date(),
      },
    });

    // 2. KolProfile creates only — never overwrite existing
    let profilesCreated = 0;
    for (const p of profileCreatePlan) {
      await tx.kolProfile.create({ data: p.payload as any });
      profilesCreated++;
    }

    // 3. KolPromotionMention upsert by (sourcePlatform, sourcePostId)
    let mentionsUpserted = 0;
    for (const m of mentionPlan) {
      await tx.kolPromotionMention.upsert({
        where: { sourcePlatform_sourcePostId: { sourcePlatform: "x", sourcePostId: m.payload.sourcePostId } },
        update: {
          chain: m.payload.chain,
          tokenMint: m.payload.tokenMint,
          tokenSymbol: m.payload.tokenSymbol,
          sourceUrl: m.payload.sourceUrl,
          postedAt: m.payload.postedAt,
          contentSnippet: m.payload.contentSnippet,
          watcherRunId: m.payload.watcherRunId,
        },
        create: m.payload,
      });
      mentionsUpserted++;
    }

    // 4. KolTokenLink upsert by (kolHandle, contractAddress, chain)
    let linksUpserted = 0;
    for (const l of linkPlan) {
      await tx.kolTokenLink.upsert({
        where: {
          kolHandle_contractAddress_chain: {
            kolHandle: l.payload.kolHandle,
            contractAddress: l.payload.contractAddress,
            chain: l.payload.chain,
          },
        },
        update: {
          tokenSymbol: l.payload.tokenSymbol,
          role: l.payload.role,
          caseId: l.payload.caseId,
          note: l.payload.note,
        },
        create: l.payload,
      });
      linksUpserted++;
    }

    return { profilesCreated, mentionsUpserted, linksUpserted };
  });

  console.log(`\n[done] committed:`);
  console.log(`  TokenPriceTracker     : 1 row upserted`);
  console.log(`  KolProfile (new)      : ${result.profilesCreated} created (existing left untouched)`);
  console.log(`  KolPromotionMention   : ${result.mentionsUpserted} upserted`);
  console.log(`  KolTokenLink          : ${result.linksUpserted} upserted`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[fatal]", e);
  await prisma.$disconnect();
  process.exit(1);
});
