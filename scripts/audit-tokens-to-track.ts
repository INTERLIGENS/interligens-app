// Step 1 — Audit. Read-only. Collects the universe of tokens worth
// price-tracking across 4 sources, deduplicated by (chain, contractAddress).
// Output: exports/tokens_to_track_2026-05-13.json
//
// Sources:
//   1. KolTokenLink (manually curated KOL → token links, 17 rows)
//   2. KolProceedsEvent (on-chain proceeds, distinct token addresses)
//   3. social_post_candidates (only posts with non-empty detectedAddresses —
//      this is the "noise filter" the user asked for)
//   4. casefiles (currently empty in prod, included for completeness)

import fs from 'fs';
import path from 'path';

const envLocal = fs.readFileSync(
  path.join(process.cwd(), '.env.local'),
  'utf8',
);
const dbUrl = envLocal.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!dbUrl) {
  console.error('[fatal] DATABASE_URL not found in .env.local');
  process.exit(1);
}
process.env.DATABASE_URL = dbUrl;

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TokenEntry {
  chain: string;
  contractAddress: string;
  symbols: string[];
  sources: {
    kolTokenLink: number;
    kolProceedsEvent: number;
    socialPostCandidate: number;
    casefile: number;
  };
  kolHandles: string[];
  caseIds: string[];
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

function normChain(c: string | null | undefined): string {
  if (!c) return 'UNKNOWN';
  const u = c.trim().toUpperCase();
  // canonicalize a few common aliases
  if (u === 'SOLANA') return 'SOL';
  if (u === 'ETHEREUM') return 'ETH';
  return u;
}

function isPlausibleAddress(a: string, chain: string): boolean {
  if (!a) return false;
  const trimmed = a.trim();
  if (chain === 'SOL') {
    // Base58, 32-44 chars typical
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
  }
  if (chain === 'ETH' || chain === 'BASE' || chain === 'ARB' || chain === 'POLYGON') {
    return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
  }
  // Allow unknown-chain addresses through if non-trivial length
  return trimmed.length >= 30 && trimmed.length <= 50;
}

function keyOf(chain: string, address: string): string {
  return `${chain}|${address.toLowerCase()}`;
}

function bumpDate(entry: TokenEntry, d: Date | string | null | undefined) {
  if (!d) return;
  const iso = (d instanceof Date ? d : new Date(d)).toISOString();
  if (!entry.firstSeenAt || iso < entry.firstSeenAt) entry.firstSeenAt = iso;
  if (!entry.lastSeenAt || iso > entry.lastSeenAt) entry.lastSeenAt = iso;
}

function upsert(
  map: Map<string, TokenEntry>,
  chain: string,
  address: string,
): TokenEntry {
  const k = keyOf(chain, address);
  let e = map.get(k);
  if (!e) {
    e = {
      chain,
      contractAddress: address,
      symbols: [],
      sources: {
        kolTokenLink: 0,
        kolProceedsEvent: 0,
        socialPostCandidate: 0,
        casefile: 0,
      },
      kolHandles: [],
      caseIds: [],
      firstSeenAt: null,
      lastSeenAt: null,
    };
    map.set(k, e);
  }
  return e;
}

function addOnce<T>(arr: T[], v: T | null | undefined) {
  if (v === null || v === undefined) return;
  if (!arr.includes(v)) arr.push(v);
}

async function main() {
  const tokens = new Map<string, TokenEntry>();

  // ── 1. KolTokenLink ───────────────────────────────────────────────────
  const ktl = await prisma.$queryRaw<{
    kolHandle: string;
    tokenSymbol: string | null;
    contractAddress: string;
    chain: string;
    caseId: string | null;
    createdAt: Date;
  }[]>`
    SELECT "kolHandle", "tokenSymbol", "contractAddress", chain, "caseId", "createdAt"
    FROM "KolTokenLink"`;
  let ktlInvalid = 0;
  for (const r of ktl) {
    const chain = normChain(r.chain);
    if (!isPlausibleAddress(r.contractAddress, chain)) {
      // Some KolTokenLink entries store placeholders like "PENDING_OSINT_BOTIFY".
      // These are not real addresses — skip but count.
      ktlInvalid++;
      continue;
    }
    const e = upsert(tokens, chain, r.contractAddress);
    e.sources.kolTokenLink++;
    addOnce(e.symbols, r.tokenSymbol?.toUpperCase());
    addOnce(e.kolHandles, r.kolHandle);
    addOnce(e.caseIds, r.caseId);
    bumpDate(e, r.createdAt);
  }
  console.error(
    `[step1] KolTokenLink: ${ktl.length} rows, ${ktlInvalid} placeholder addresses skipped, ${ktl.length - ktlInvalid} kept`,
  );

  // ── 2. KolProceedsEvent ───────────────────────────────────────────────
  const kpe = await prisma.$queryRaw<{
    kolHandle: string;
    tokenSymbol: string | null;
    tokenAddress: string | null;
    chain: string;
    caseId: string | null;
    eventDate: Date;
  }[]>`
    SELECT "kolHandle", "tokenSymbol", "tokenAddress", chain, "caseId", "eventDate"
    FROM "KolProceedsEvent"
    WHERE "tokenAddress" IS NOT NULL AND "tokenAddress" != ''`;
  let kpeInvalid = 0;
  for (const r of kpe) {
    if (!r.tokenAddress) continue;
    const chain = normChain(r.chain);
    if (!isPlausibleAddress(r.tokenAddress, chain)) {
      kpeInvalid++;
      continue;
    }
    const e = upsert(tokens, chain, r.tokenAddress);
    e.sources.kolProceedsEvent++;
    addOnce(e.symbols, r.tokenSymbol?.toUpperCase());
    addOnce(e.kolHandles, r.kolHandle);
    addOnce(e.caseIds, r.caseId);
    bumpDate(e, r.eventDate);
  }
  console.error(
    `[step2] KolProceedsEvent: ${kpe.length} rows, ${kpeInvalid} invalid addresses skipped`,
  );

  // ── 3. social_post_candidates (filter: detectedAddresses non-empty) ───
  // detectedAddresses is stored as a JSON-encoded text string (e.g. '["..."]').
  // detectedTokens is jsonb (array of strings).
  const spc = await prisma.$queryRaw<{
    detectedTokens: unknown;
    detectedAddresses: string | null;
    chain: string | null;
    discoveredAtUtc: Date;
    handle: string | null;
  }[]>`
    SELECT
      spc."detectedTokens",
      spc."detectedAddresses",
      spc.chain,
      spc."discoveredAtUtc",
      i.handle
    FROM social_post_candidates spc
    LEFT JOIN influencers i ON i.id = spc."influencerId"
    WHERE spc."detectedAddresses" IS NOT NULL
      AND spc."detectedAddresses" NOT IN ('', '[]', 'null')`;
  let spcInvalid = 0;
  let spcUnpaired = 0;
  for (const r of spc) {
    let addrs: string[] = [];
    try {
      const parsed = JSON.parse(r.detectedAddresses ?? '[]');
      if (Array.isArray(parsed)) addrs = parsed.filter((a) => typeof a === 'string');
    } catch {
      spcInvalid++;
      continue;
    }
    if (addrs.length === 0) continue;

    const symbols = Array.isArray(r.detectedTokens)
      ? (r.detectedTokens as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];

    // If chain is missing, infer from address format.
    const inferChain = (addr: string): string => {
      if (r.chain) return normChain(r.chain);
      if (/^0x[a-fA-F0-9]{40}$/.test(addr)) return 'ETH';
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) return 'SOL';
      return 'UNKNOWN';
    };

    for (const addr of addrs) {
      const chain = inferChain(addr);
      if (!isPlausibleAddress(addr, chain)) {
        spcInvalid++;
        continue;
      }
      const e = upsert(tokens, chain, addr);
      e.sources.socialPostCandidate++;
      // We can't perfectly pair symbol↔address when multiple of each, so we
      // just stuff all detected symbols from the post under this address.
      if (symbols.length === 0) spcUnpaired++;
      for (const sym of symbols) addOnce(e.symbols, sym.toUpperCase());
      if (r.handle) addOnce(e.kolHandles, r.handle);
      bumpDate(e, r.discoveredAtUtc);
    }
  }
  console.error(
    `[step3] social_post_candidates with addresses: ${spc.length} posts, ${spcInvalid} invalid, ${spcUnpaired} posts had address but no symbol`,
  );

  // ── 4. casefiles (empty in prod as of 2026-05-13) ─────────────────────
  let casefilesCount = 0;
  try {
    const cf = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM casefiles`;
    casefilesCount = cf[0]?.n ?? 0;
  } catch (e: any) {
    console.error(`[step4] casefiles query failed: ${e?.message?.split('\n')[0]}`);
  }
  console.error(
    `[step4] casefiles: ${casefilesCount} rows (no token CA fields in this table — nothing to extract; logged for completeness)`,
  );

  // ── Report ────────────────────────────────────────────────────────────
  const out = [...tokens.values()];

  // Sort: most evidence first
  out.sort((a, b) => {
    const sa =
      a.sources.kolTokenLink * 10 +
      a.sources.kolProceedsEvent +
      a.sources.socialPostCandidate +
      a.kolHandles.length;
    const sb =
      b.sources.kolTokenLink * 10 +
      b.sources.kolProceedsEvent +
      b.sources.socialPostCandidate +
      b.kolHandles.length;
    return sb - sa;
  });

  const byChain = new Map<string, number>();
  for (const t of out) byChain.set(t.chain, (byChain.get(t.chain) ?? 0) + 1);

  const fromKtl = out.filter((t) => t.sources.kolTokenLink > 0).length;
  const fromKpe = out.filter((t) => t.sources.kolProceedsEvent > 0).length;
  const fromSpc = out.filter((t) => t.sources.socialPostCandidate > 0).length;

  console.error(`\n=== AUDIT SUMMARY ===`);
  console.error(`Unique tokens (chain, contractAddress): ${out.length}`);
  console.error(`By chain: ${[...byChain.entries()].map(([c, n]) => `${c}:${n}`).join(', ')}`);
  console.error(`Coverage: KolTokenLink=${fromKtl} · KolProceedsEvent=${fromKpe} · social=${fromSpc}`);
  console.error(`Top 10:`);
  for (const t of out.slice(0, 10)) {
    console.error(
      `  ${t.chain.padEnd(5)} ${t.contractAddress.slice(0, 16).padEnd(17)} ${(t.symbols[0] ?? '?').padEnd(14)} kols=${t.kolHandles.length} ktl=${t.sources.kolTokenLink} kpe=${t.sources.kolProceedsEvent} spc=${t.sources.socialPostCandidate}`,
    );
  }

  const outDir = path.join(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'tokens_to_track_2026-05-13.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sources: {
          KolTokenLink: ktl.length,
          KolProceedsEvent: kpe.length,
          social_post_candidates_with_addresses: spc.length,
          casefiles: casefilesCount,
        },
        invalidAddressesSkipped: {
          KolTokenLink: ktlInvalid,
          KolProceedsEvent: kpeInvalid,
          social_post_candidates: spcInvalid,
        },
        chainBreakdown: Object.fromEntries(byChain),
        uniqueTokenCount: out.length,
        tokens: out,
      },
      null,
      2,
    ),
  );
  console.error(`\n[done] wrote ${outPath}`);
}

main()
  .catch((e) => {
    console.error('[fatal]', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
