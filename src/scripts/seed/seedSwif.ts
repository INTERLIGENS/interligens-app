// ─────────────────────────────────────────────────────────────────────────
// SEED — $SWIF casefile (Sheep Wif Hat — cross-case BOTIFY + BULLISH)
//
// Source of truth   : src/scripts/seed/casefiles/swif_seed.json
// DB                : ep-square-band (prod)
// Default mode      : DRY-RUN (read-only, plans logged, no INSERT/UPDATE)
// Write mode        : SEED_SWIF=1 pnpm tsx src/scripts/seed/seedSwif.ts
//
// Tables touched (in a single transaction):
//   - TokenPriceTracker   upsert by (chain, contractAddress)
//   - KolProfile          create-only for {sheepwifhatcoin, jayxbt2012}
//                         GordonGekko + DonWedge are LEFT UNTOUCHED
//                         (preserve their existing BOTIFY fields)
//   - KolPromotionMention upsert by (sourcePlatform, sourcePostId)
//   - KolTokenLink        upsert by (kolHandle, contractAddress, chain)
//
// NOT touched: KolProceedsEvent / KolTokenInvolvement / KolEvidence — this is
// a 100% SOCIAL/X casefile, no on-chain attribution is written here. (The old
// "$SWIF +$445K Gordon" on-chain finding was retired 2026-05-15 as unverified —
// see MIGRATION_RETAILVISION.md.)
//
// Geppetto is NOT created: it is absent from swif_seed.json (zero-fabrication).
// Schema gaps recorded in MIGRATION_RETAILVISION.md, schema not modified here.
// ─────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import crypto from "crypto";

const envLocal = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const dbUrl = envLocal.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!dbUrl) {
  console.error("[fatal] DATABASE_URL missing from .env.local");
  process.exit(1);
}
// Fail-fast: only seed against ep-square-band (prod). Other env vars in
// .env.local point at ep-bold-sky — never seed there.
if (!dbUrl.includes("ep-square-band")) {
  console.error("[fatal] DATABASE_URL is not ep-square-band — refusing to seed");
  process.exit(1);
}
process.env.DATABASE_URL = dbUrl;
const dbHost = dbUrl.match(/ep-[a-z0-9-]+/)?.[0] ?? "unknown-host";

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COMMIT = process.env.SEED_SWIF === "1";
const SEED_RUN_TAG = "swif_seed_2026-05-14";
const CASE_ID = "SWIF";
const TOKEN_MINT = "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJQ";
const TOKEN_SYMBOL = "SWIF";
const CHAIN = "solana";

// Actors we are allowed to CREATE if absent from DB. GordonGekko / DonWedge
// already exist (BOTIFY P0) → never created, never overwritten. Geppetto is
// NOT in swif_seed.json → not created here.
const CREATE_ALLOWLIST = new Set(["sheepwifhatcoin", "jayxbt2012"]);

// pdfScore values not present in the JSON come from the mission brief.
// jayxbt2012 uses its JSON tigerscore_recommended (90); only the official
// account has no JSON tigerscore, so its score is sourced from the brief.
const MISSION_PDF_SCORE: Record<string, number> = { sheepwifhatcoin: 80 };

interface PromotionMention {
  handle: string;
  url?: string;
  post_id?: string;
  post_id_partial?: string;
  posted_at: string;
  claim: string;
  engagement?: Record<string, number>;
  criticality?: string;
}

interface OfficialAccount {
  handle: string;
  display_name?: string;
  x_url?: string;
  verified?: boolean;
  bio?: string;
  role?: string;
}

interface TelegramAdmin {
  handle: string;
  display_name?: string;
  x_url?: string;
  role?: string;
  evidence_admin?: string;
  evidence_defense?: string;
  tigerscore_recommended?: number;
  criticality?: string;
}

interface Amplifier {
  handle: string;
  display_name?: string;
  role?: string;
  tigerscore_recommended?: number;
  already_in_botify_dossier?: boolean;
  existing_db_finding?: string;
}

interface CasefileJson {
  _meta: Record<string, unknown>;
  token: { mint?: string; symbol?: string; name?: string; [k: string]: unknown };
  manipulation_evidence: Record<string, unknown>;
  actors: {
    primary_dev: Record<string, unknown>;
    official_account: OfficialAccount;
    telegram_admin_critical: TelegramAdmin;
    core_amplifiers: Amplifier[];
    peripheral_amplifiers_to_investigate: Array<{ handle: string; reason: string }>;
  };
  promotion_mentions: PromotionMention[];
  cross_case_links: {
    to_existing_db?: string[];
    to_bullish_casefile?: string[];
    additional_tokens_implicated?: Array<{ symbol: string; reason: string; priority: string }>;
  };
}

function validateJson(d: CasefileJson): string[] {
  const issues: string[] = [];
  if (!d.token?.mint) issues.push("token.mint missing");
  if (d.token?.mint && d.token.mint !== TOKEN_MINT)
    issues.push(`token.mint (${d.token.mint}) != expected ${TOKEN_MINT}`);
  if (!d.actors?.official_account?.handle) issues.push("actors.official_account.handle missing");
  if (!d.actors?.telegram_admin_critical?.handle) issues.push("actors.telegram_admin_critical.handle missing");
  if (!Array.isArray(d.actors?.core_amplifiers)) issues.push("actors.core_amplifiers not an array");
  if (!Array.isArray(d.promotion_mentions)) issues.push("promotion_mentions not an array");
  if (!d.manipulation_evidence) issues.push("manipulation_evidence missing");
  return issues;
}

function extractPostId(m: PromotionMention): string | null {
  if (m.post_id) return m.post_id;
  if (!m.url) return null;
  const match = m.url.match(/status\/(\d{18,20})/);
  return match?.[1] ?? null;
}

function synthPostId(m: PromotionMention): string {
  // Deterministic synthetic id when X gave us no real numeric status id.
  // `seed_<sha1(handle|posted_at|claim).slice(0,12)>` — stable across re-runs
  // so the (sourcePlatform, sourcePostId) upsert is idempotent.
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
  if (postId && !synthetic) return `https://x.com/${m.handle}/status/${postId}`;
  return `https://x.com/${m.handle}`;
}

// KolTokenLink.role — the mission's "linkType" maps onto the schema's `role`.
function linkRole(handle: string): string {
  if (handle === "sheepwifhatcoin") return "official-account";
  if (handle === "jayxbt2012") return "telegram-admin";
  return "amplifier";
}

async function main() {
  console.log(`\n=== seedSwif — mode=${COMMIT ? "COMMIT" : "DRY-RUN"} — db=${dbHost} ===\n`);

  const jsonPath = path.join(process.cwd(), "src/scripts/seed/casefiles/swif_seed.json");
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as CasefileJson;

  // ── Step 1: structure validation ────────────────────────────────────────
  const issues = validateJson(data);
  if (issues.length > 0) {
    console.error("[fatal] swif_seed.json failed validation:");
    for (const i of issues) console.error(`  - ${i}`);
    await prisma.$disconnect();
    process.exit(1);
  }
  const mByHandle = new Map<string, number>();
  for (const m of data.promotion_mentions) mByHandle.set(m.handle, (mByHandle.get(m.handle) ?? 0) + 1);
  console.log("[json] structure OK.");
  console.log(`  token                : ${data.token.symbol} (${data.token.name})`);
  console.log(`  manipulation_evidence: ${Object.keys(data.manipulation_evidence).length} evidence objects`);
  console.log(`  promotion_mentions   : ${data.promotion_mentions.length} total`);
  for (const [h, n] of mByHandle) console.log(`    ${h.padEnd(20)} ${n} mentions`);

  // ── Step 2: pre-flight — existing $SWIF traces (conflict-stop tables) ────
  console.log("\n[pre-flight] checking for existing $SWIF traces in seed-owned tables…");
  const trace = await prisma.$queryRaw<Array<{ src: string; n: number }>>`
    SELECT 'TokenPriceTracker' AS src, COUNT(*)::int AS n FROM "TokenPriceTracker"
      WHERE LOWER("contractAddress") = LOWER(${TOKEN_MINT})
    UNION ALL
    SELECT 'KolTokenLink', COUNT(*)::int FROM "KolTokenLink"
      WHERE LOWER("contractAddress") = LOWER(${TOKEN_MINT})
    UNION ALL
    SELECT 'KolPromotionMention', COUNT(*)::int FROM "KolPromotionMention"
      WHERE "tokenMint" = ${TOKEN_MINT}`;
  for (const r of trace) console.log(`  ${r.src.padEnd(22)} existing rows: ${r.n}`);
  const conflicts = trace.filter((r) => r.n > 0);

  // ── Step 2b: confirm no on-chain proceeds rows are affected by this seed ──
  // SWIF is a 100% social/X casefile — this seed writes no on-chain attribution.
  // (The old "$SWIF $445K Gordon" finding was retired 2026-05-15 as unverified.)
  console.log("\n[pre-flight] on-chain proceeds tables (read-only — this seed writes none):");
  const involvement = await prisma.kolTokenInvolvement.findMany({
    where: { tokenMint: TOKEN_MINT },
    select: { kolHandle: true, proceedsUsd: true, isPromoted: true },
  });
  if (involvement.length > 0) {
    for (const iv of involvement)
      console.log(`  [read-only] KolTokenInvolvement ${iv.kolHandle.padEnd(16)} proceedsUsd=${iv.proceedsUsd ?? "—"} promoted=${iv.isPromoted}`);
  } else {
    console.log("  KolTokenInvolvement : no row for SWIF mint");
  }
  try {
    const pe = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM "KolProceedsEvent" WHERE LOWER("tokenAddress") = LOWER(${TOKEN_MINT})`;
    console.log(`  [read-only] KolProceedsEvent rows for SWIF mint: ${pe[0]?.n ?? 0} (not modified by this seed)`);
  } catch (e) {
    console.log(`  [info] KolProceedsEvent not queryable (${(e as Error).message.slice(0, 60)})`);
  }
  try {
    const ev = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM "KolEvidence"
      WHERE "kolHandle" ILIKE 'GordonGekko' AND (COALESCE("token",'') ILIKE '%SWIF%' OR COALESCE("description",'') ILIKE '%SWIF%')`;
    console.log(`  [read-only] KolEvidence rows (Gordon×SWIF): ${ev[0]?.n ?? 0}`);
  } catch (e) {
    console.log(`  [info] KolEvidence probe skipped (${(e as Error).message.slice(0, 60)})`);
  }
  const gordonRows = await prisma.$queryRaw<Array<{ handle: string; botifyDeal: unknown; totalDocumented: number | null }>>`
    SELECT handle, "botifyDeal", "totalDocumented" FROM "KolProfile" WHERE LOWER(handle) = LOWER('GordonGekko') LIMIT 1`;
  if (gordonRows[0]) {
    console.log(`  [read-only] GordonGekko botifyDeal=${gordonRows[0].botifyDeal ? "present" : "null"} totalDocumented=${gordonRows[0].totalDocumented ?? 0}`);
  } else {
    console.log("  [warning] GordonGekko not found in KolProfile — expected to exist (BOTIFY P0)");
  }
  console.log(
    "  [note] the '$SWIF insiders $445K' finding was retired from the casefile 2026-05-15\n" +
      "         (unverified — no TX hash, $SWIF/$TRUMP token contradiction); see MIGRATION_RETAILVISION.md.",
  );

  // ── Step 3: actor presence map ──────────────────────────────────────────
  const handleSet = new Set<string>();
  handleSet.add(data.actors.official_account.handle);
  handleSet.add(data.actors.telegram_admin_critical.handle);
  for (const a of data.actors.core_amplifiers) handleSet.add(a.handle);
  const handles = [...handleSet];
  const presence = new Map<string, { id: string } | null>();
  for (const h of handles) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "KolProfile" WHERE LOWER(handle) = LOWER(${h}) LIMIT 1`;
    presence.set(h, rows[0] ? { id: rows[0].id } : null);
  }
  console.log("\n[pre-flight] actor presence in KolProfile:");
  for (const h of handles) {
    const v = presence.get(h);
    const tag = v ? `FOUND id=${v.id.slice(0, 12)}…` : "NOT FOUND";
    const action = v
      ? "(existing → links + mentions only, profile untouched)"
      : CREATE_ALLOWLIST.has(h)
        ? "(will CREATE)"
        : "(NOT in create allowlist → skip, will not invent)";
    console.log(`  ${h.padEnd(20)} ${tag.padEnd(28)} ${action}`);
  }

  if (conflicts.length > 0) {
    console.log(
      `\n[STOP] non-zero existing $SWIF rows in seed-owned tables: ${conflicts
        .map((c) => `${c.src}=${c.n}`)
        .join(", ")}. Refuse to seed (possible partial prior run). Aborting.`,
    );
    await prisma.$disconnect();
    process.exit(2);
  }

  // ── Plan ────────────────────────────────────────────────────────────────
  console.log("\n[plan] operations to perform:");
  console.log(`  TokenPriceTracker      upsert (chain='${CHAIN}', contractAddress=${TOKEN_MINT.slice(0, 12)}…)`);

  // KolProfile create plan
  const profileCreatePlan: Array<{ handle: string; payload: Prisma.KolProfileCreateInput }> = [];
  const skipped: string[] = [];

  const official = data.actors.official_account;
  if (!presence.get(official.handle)) {
    profileCreatePlan.push({
      handle: official.handle,
      payload: {
        handle: official.handle,
        displayName: official.display_name ?? null,
        platform: "x",
        label: "suspect",
        riskFlag: "official_project_account",
        verified: official.verified === true,
        bio: official.bio ?? null,
        tier: "HIGH",
        pdfScore: MISSION_PDF_SCORE[official.handle] ?? null,
        notes: `Role: ${official.role ?? "Official project account"}. Dev attribution: troll dev (per bio, same dev as $TROLL). pdfScore ${MISSION_PDF_SCORE[official.handle] ?? "n/a"} from mission brief (no JSON tigerscore). Seeded ${SEED_RUN_TAG}.`,
        behaviorFlags: JSON.stringify(["official_project_account"]),
        publishStatus: "draft",
        editorialStatus: "pending",
      },
    });
  } else {
    skipped.push(`${official.handle}: already exists → not created`);
  }

  const tg = data.actors.telegram_admin_critical;
  if (!presence.get(tg.handle)) {
    profileCreatePlan.push({
      handle: tg.handle,
      payload: {
        handle: tg.handle,
        displayName: tg.display_name ?? null,
        platform: "x",
        label: "suspect",
        riskFlag: "team_insider",
        verified: false,
        tier: "CRITICAL",
        pdfScore: tg.tigerscore_recommended ?? null,
        notes: `Role: ${tg.role ?? ""}. Admin evidence: ${tg.evidence_admin ?? ""} ${tg.criticality ?? ""} Seeded ${SEED_RUN_TAG}.`.trim(),
        behaviorFlags: JSON.stringify(["telegram-admin-confirmed", "post_incident_defense_coordinator"]),
        publishStatus: "draft",
        editorialStatus: "pending",
      },
    });
  } else {
    skipped.push(`${tg.handle}: already exists → not created`);
  }

  for (const amp of data.actors.core_amplifiers) {
    if (presence.get(amp.handle)) {
      skipped.push(`${amp.handle}: exists in DB → KolProfile UNTOUCHED (preserve BOTIFY fields), links + mentions only`);
    } else {
      skipped.push(`${amp.handle}: not in DB and not in create allowlist → SKIP, will not invent`);
    }
  }
  for (const r of skipped) console.log(`    [skip] ${r}`);
  for (const p of profileCreatePlan)
    console.log(`    [create] KolProfile ${p.handle} tier=${p.payload.tier} pdfScore=${p.payload.pdfScore} riskFlag=${p.payload.riskFlag}`);

  // KolPromotionMention plan
  const mentionPlan: Array<{
    handle: string;
    synthetic: boolean;
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
  }> = [];
  const mentionSkipped: string[] = [];

  for (const m of data.promotion_mentions) {
    const hasProfile = presence.get(m.handle) || profileCreatePlan.some((p) => p.handle === m.handle);
    if (!hasProfile) {
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
    mentionPlan.push({
      handle: m.handle,
      synthetic,
      payload: {
        kolHandle: m.handle,
        chain: CHAIN,
        tokenMint: TOKEN_MINT,
        tokenSymbol: TOKEN_SYMBOL,
        sourcePlatform: "x",
        sourcePostId: postId as string,
        sourceUrl: sourceUrl(m, postId, synthetic),
        postedAt: date,
        contentSnippet: `${claim}${metaSuffix}`.slice(0, 2000),
        watcherRunId: SEED_RUN_TAG,
      },
    });
  }
  for (const r of mentionSkipped) console.log(`    [skip mention] ${r}`);
  console.log(`    [mentions] total=${mentionPlan.length}, synthetic=${mentionPlan.filter((p) => p.synthetic).length}, real=${mentionPlan.filter((p) => !p.synthetic).length}`);

  // KolTokenLink plan — one per actor on SWIF
  const linkActors = [
    official.handle,
    tg.handle,
    ...data.actors.core_amplifiers.map((a) => a.handle),
  ];
  const linkPlan: Array<{
    handle: string;
    payload: { kolHandle: string; contractAddress: string; chain: string; tokenSymbol: string; role: string; caseId: string; note: string };
  }> = [];
  for (const handle of linkActors) {
    const hasProfile = presence.get(handle) || profileCreatePlan.some((p) => p.handle === handle);
    if (!hasProfile) {
      console.log(`    [skip link] ${handle}: no profile`);
      continue;
    }
    const mine = mentionPlan.filter((m) => m.handle === handle);
    const dates = mine.map((m) => m.payload.postedAt.toISOString()).sort();
    const note = JSON.stringify({
      firstPromotionAt: dates[0] ?? null,
      lastPromotionAt: dates[dates.length - 1] ?? null,
      mentionCount: mine.length,
      seededFrom: SEED_RUN_TAG,
    });
    linkPlan.push({
      handle,
      payload: {
        kolHandle: handle,
        contractAddress: TOKEN_MINT,
        chain: CHAIN,
        tokenSymbol: TOKEN_SYMBOL,
        role: linkRole(handle),
        caseId: CASE_ID,
        note,
      },
    });
  }
  for (const l of linkPlan)
    console.log(`    [link] ${l.handle.padEnd(20)} role=${l.payload.role.padEnd(18)} case=${l.payload.caseId}`);

  // Cross-case + peripheral logging — never auto-created (no CrossCaseLink table)
  const cc = data.cross_case_links;
  console.log("\n[cross-case links — MANUAL FOLLOW-UP, no CrossCaseLink table in schema]:");
  for (const l of cc.to_existing_db ?? []) console.log(`  [→ DB/BOTIFY] ${l}`);
  for (const l of cc.to_bullish_casefile ?? []) console.log(`  [→ BULLISH]   ${l}`);
  console.log("\n[additional tokens implicated — investigation candidates, NOT seeded]:");
  for (const t of cc.additional_tokens_implicated ?? [])
    console.log(`  ${t.symbol.padEnd(12)} ${t.priority.padEnd(8)} ${t.reason}`);
  console.log("\n[peripheral_amplifiers_to_investigate — NOT seeded, OSINT pending]:");
  for (const p of data.actors.peripheral_amplifiers_to_investigate)
    console.log(`  - ${p.handle.padEnd(20)} ${p.reason}`);

  // ── DRY RUN exit ────────────────────────────────────────────────────────
  if (!COMMIT) {
    console.log(`\n[done] DRY-RUN complete. Pass SEED_SWIF=1 to write to ${dbHost}.`);
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

    // 2. KolProfile create-only — never overwrite existing
    let profilesCreated = 0;
    for (const p of profileCreatePlan) {
      await tx.kolProfile.create({ data: p.payload });
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

  console.log(`\n[done] committed to ${dbHost}:`);
  console.log(`  TokenPriceTracker     : 1 row upserted`);
  console.log(`  KolProfile (new)      : ${result.profilesCreated} created (GordonGekko/DonWedge left untouched)`);
  console.log(`  KolPromotionMention   : ${result.mentionsUpserted} upserted`);
  console.log(`  KolTokenLink          : ${result.linksUpserted} upserted`);
  console.log(`  KolProceedsEvent      : 0 written (SWIF is a 100% social casefile)`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[fatal]", e);
  await prisma.$disconnect();
  process.exit(1);
});
