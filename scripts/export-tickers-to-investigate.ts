// One-off export: prioritized list of tickers to investigate (≥2026-01-01).
// Read-only. Universe = tokens touched by watchlist KOLs (handles.ts).
//
// Sources:
//   1. social_post_candidates.detectedTokens (since 2026-01-01)
//   2. KolTokenLink (no date column — included in full)
//   3. KolProceedsEvent (eventDate >= 2026-01-01)
//   4. KolTokenInvolvement (firstPromotionAt >= 2026-01-01 OR null)
//
// Price source (per-token current/peak/dump):
//   TokenPriceTracker keyed by (chain, contractAddress).
//   Fallback if table empty/missing: exports/backfill_report_2026-05-13.json.
//
// Scoring (max 105):
//   dumpPct tiered:
//     >= 90%   → +35
//     70-89%   → +25
//     50-69%   → +15
//     < 50%    → +0
//   +25  token promoted by a KOL with an active LaundryTrail entry
//   +20  proceeds events exist for the token (Watcher tracked sketchy flows)
//   +15  caseId ∈ {BOTIFY, VINE, GHOST, RAVE, SOLAXY} (case-insensitive prefix)
//   +10  3+ distinct watchlist KOLs promoted the token

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
import { handlesV2 } from '../src/lib/watcher/handles';

const prisma = new PrismaClient();

const SINCE = '2026-01-01';
const CASE_CODES = ['BOTIFY', 'VINE', 'GHOST', 'RAVE', 'SOLAXY'] as const;

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function normSym(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toUpperCase();
  return t.length > 0 && t.length <= 20 ? t : null;
}

interface TokenAgg {
  ticker: string;
  chains: Map<string, number>;
  contracts: Map<string, number>; // contract → count
  contractChain: Map<string, string>; // contract → chain
  firstSeenDate: string | null; // ISO date
  kols: Set<string>;
  caseIds: Set<string>;
  proceedsEventCount: number;
  // price tracking
  pricePoints: Array<{ date: string; price: number; source: string }>;
}

function upsertToken(
  map: Map<string, TokenAgg>,
  ticker: string,
): TokenAgg {
  let t = map.get(ticker);
  if (!t) {
    t = {
      ticker,
      chains: new Map(),
      contracts: new Map(),
      contractChain: new Map(),
      firstSeenDate: null,
      kols: new Set(),
      caseIds: new Set(),
      proceedsEventCount: 0,
      pricePoints: [],
    };
    map.set(ticker, t);
  }
  return t;
}

function bumpDate(t: TokenAgg, d: Date | string | null) {
  if (!d) return;
  const iso = (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
  if (!t.firstSeenDate || iso < t.firstSeenDate) t.firstSeenDate = iso;
}

function bumpChain(t: TokenAgg, c: string | null) {
  if (!c) return;
  t.chains.set(c, (t.chains.get(c) ?? 0) + 1);
}

function bumpContract(t: TokenAgg, contract: string | null, chain: string | null) {
  if (!contract) return;
  t.contracts.set(contract, (t.contracts.get(contract) ?? 0) + 1);
  if (chain) t.contractChain.set(contract, chain);
}

function topOf(m: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = -1;
  for (const [k, n] of m) if (n > bestN) { best = k; bestN = n; }
  return best;
}

async function main() {
  // 1. Watchlist universe.
  const seen = new Set<string>();
  const watchlist = handlesV2
    .map((h) => h.handle)
    .filter((h) => {
      const k = h.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const watchlistLower = new Set(watchlist.map((h) => h.toLowerCase()));
  console.error(`[input] watchlist: ${watchlist.length} unique handles`);

  // 2. Quick existence/availability sanity checks.
  for (const table of [
    'social_post_candidates',
    'KolTokenLink',
    'KolProceedsEvent',
    'KolTokenInvolvement',
    'LaundryTrail',
    'PriceCache',
    'casefiles',
  ]) {
    try {
      const r = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT COUNT(*)::int AS n FROM "${table}"`,
      );
      console.error(`[source] ${table}: ${r[0].n} rows`);
    } catch (e: any) {
      console.error(
        `[source] ${table}: MISSING (${e?.message?.split('\n')[0] ?? e})`,
      );
    }
  }

  // 3. Collect per source. All raw SQL; we filter to watchlist KOLs in TS
  //    so we can also catch handles whose Influencer.handle casing differs.
  const tokens = new Map<string, TokenAgg>();

  // 3a) social_post_candidates → detectedTokens (+ detectedAddresses)
  let spcRows: Array<{
    token: string;
    chain: string | null;
    detectedAddresses: string | null;
    discoveredAtUtc: Date;
    handle: string | null;
  }> = [];
  try {
    spcRows = await prisma.$queryRaw<typeof spcRows>`
      SELECT
        tok::text AS token,
        spc.chain,
        spc."detectedAddresses",
        spc."discoveredAtUtc",
        i.handle
      FROM social_post_candidates spc
      LEFT JOIN influencers i ON i.id = spc."influencerId"
      , LATERAL jsonb_array_elements_text(spc."detectedTokens") AS tok
      WHERE spc."discoveredAtUtc" >= ${new Date(SINCE)}
        AND spc."detectedTokens" IS NOT NULL
        AND jsonb_typeof(spc."detectedTokens") = 'array'`;
  } catch (e: any) {
    console.error(
      `[source] social_post_candidates query failed: ${e?.message?.split('\n')[0]}`,
    );
  }
  const inferChain = (addr: string, hinted: string | null): string => {
    if (hinted) return hinted;
    if (/^0x[a-fA-F0-9]{40}$/.test(addr)) return 'ETH';
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) return 'SOL';
    return 'UNKNOWN';
  };
  let spcKept = 0;
  let spcAddrPairs = 0;
  for (const r of spcRows) {
    const sym = normSym(r.token);
    if (!sym) continue;
    if (!r.handle || !watchlistLower.has(r.handle.toLowerCase())) continue;
    spcKept++;
    const t = upsertToken(tokens, sym);
    bumpChain(t, r.chain);
    bumpDate(t, r.discoveredAtUtc);
    t.kols.add(r.handle);
    // Pair the symbol with any address in this post. Imperfect when a post
    // has multiple tokens and multiple addresses, but the worst case is over-
    // attribution — we still score by symbol, and the price lookup picks the
    // worst dump across the attached contracts.
    if (r.detectedAddresses) {
      try {
        const addrs = JSON.parse(r.detectedAddresses);
        if (Array.isArray(addrs)) {
          for (const a of addrs) {
            if (typeof a !== 'string' || a.length < 30) continue;
            const chain = inferChain(a, r.chain);
            bumpContract(t, a, chain);
            bumpChain(t, chain);
            spcAddrPairs++;
          }
        }
      } catch {
        /* malformed JSON, ignore */
      }
    }
  }
  console.error(
    `[step1a] social_post_candidates: ${spcRows.length} rows → ${spcKept} watchlist-tagged, ${spcAddrPairs} address↔symbol pairs added`,
  );

  // 3b) KolTokenLink
  let ktlRows: Array<{
    kolHandle: string;
    contractAddress: string;
    chain: string;
    tokenSymbol: string | null;
    caseId: string | null;
    createdAt: Date;
  }> = [];
  try {
    ktlRows = await prisma.$queryRaw<typeof ktlRows>`
      SELECT "kolHandle", "contractAddress", chain, "tokenSymbol", "caseId", "createdAt"
      FROM "KolTokenLink"`;
  } catch (e: any) {
    console.error(`[source] KolTokenLink query failed: ${e?.message?.split('\n')[0]}`);
  }
  let ktlKept = 0;
  for (const r of ktlRows) {
    if (!watchlistLower.has(r.kolHandle.toLowerCase())) continue;
    const sym = normSym(r.tokenSymbol) ?? `UNK:${r.contractAddress.slice(0, 8)}`;
    ktlKept++;
    const t = upsertToken(tokens, sym);
    bumpChain(t, r.chain);
    bumpContract(t, r.contractAddress, r.chain);
    bumpDate(t, r.createdAt);
    t.kols.add(r.kolHandle);
    if (r.caseId) t.caseIds.add(r.caseId);
  }
  console.error(`[step1b] KolTokenLink: ${ktlRows.length} rows → ${ktlKept} watchlist-tagged`);

  // 3c) KolProceedsEvent (since 2026-01-01)
  let kpeRows: Array<{
    kolHandle: string;
    tokenSymbol: string | null;
    tokenAddress: string | null;
    chain: string;
    eventDate: Date;
    priceUsdAtTime: number | null;
    caseId: string | null;
  }> = [];
  try {
    kpeRows = await prisma.$queryRaw<typeof kpeRows>`
      SELECT "kolHandle", "tokenSymbol", "tokenAddress", chain,
             "eventDate", "priceUsdAtTime", "caseId"
      FROM "KolProceedsEvent"
      WHERE "eventDate" >= ${new Date(SINCE)}`;
  } catch (e: any) {
    console.error(`[source] KolProceedsEvent query failed: ${e?.message?.split('\n')[0]}`);
  }
  let kpeKept = 0;
  for (const r of kpeRows) {
    if (!watchlistLower.has(r.kolHandle.toLowerCase())) continue;
    const sym = normSym(r.tokenSymbol) ?? (r.tokenAddress ? `UNK:${r.tokenAddress.slice(0, 8)}` : null);
    if (!sym) continue;
    kpeKept++;
    const t = upsertToken(tokens, sym);
    bumpChain(t, r.chain);
    bumpContract(t, r.tokenAddress, r.chain);
    bumpDate(t, r.eventDate);
    t.kols.add(r.kolHandle);
    if (r.caseId) t.caseIds.add(r.caseId);
    t.proceedsEventCount++;
    if (typeof r.priceUsdAtTime === 'number' && r.priceUsdAtTime > 0) {
      t.pricePoints.push({
        date: r.eventDate.toISOString().slice(0, 10),
        price: r.priceUsdAtTime,
        source: 'KolProceedsEvent',
      });
    }
  }
  console.error(
    `[step1c] KolProceedsEvent: ${kpeRows.length} rows → ${kpeKept} watchlist-tagged`,
  );

  // 3d) KolTokenInvolvement (no symbol → key by tokenMint)
  let ktiRows: Array<{
    kolHandle: string;
    tokenMint: string;
    chain: string;
    firstPromotionAt: Date | null;
  }> = [];
  try {
    ktiRows = await prisma.$queryRaw<typeof ktiRows>`
      SELECT "kolHandle", "tokenMint", chain, "firstPromotionAt"
      FROM "KolTokenInvolvement"
      WHERE "firstPromotionAt" IS NULL OR "firstPromotionAt" >= ${new Date(SINCE)}`;
  } catch (e: any) {
    console.error(`[source] KolTokenInvolvement query failed: ${e?.message?.split('\n')[0]}`);
  }
  // We try to attach to existing token if same mint already known; otherwise
  // create a UNK:<mint> placeholder.
  const mintToSymbol = new Map<string, string>();
  for (const [sym, agg] of tokens) {
    for (const c of agg.contracts.keys()) mintToSymbol.set(c, sym);
  }
  let ktiKept = 0;
  for (const r of ktiRows) {
    if (!watchlistLower.has(r.kolHandle.toLowerCase())) continue;
    const sym = mintToSymbol.get(r.tokenMint) ?? `UNK:${r.tokenMint.slice(0, 8)}`;
    ktiKept++;
    const t = upsertToken(tokens, sym);
    bumpChain(t, r.chain);
    bumpContract(t, r.tokenMint, r.chain);
    bumpDate(t, r.firstPromotionAt);
    t.kols.add(r.kolHandle);
  }
  console.error(
    `[step1d] KolTokenInvolvement: ${ktiRows.length} rows → ${ktiKept} watchlist-tagged`,
  );

  // 4. LaundryTrail kolHandles set
  const laundryKols = new Set<string>();
  try {
    const rows = await prisma.$queryRaw<{ kolHandle: string | null }[]>`
      SELECT DISTINCT "kolHandle" FROM "LaundryTrail" WHERE "kolHandle" IS NOT NULL`;
    for (const r of rows) if (r.kolHandle) laundryKols.add(r.kolHandle.toLowerCase());
    console.error(`[step2-laundry] kols with LaundryTrail: ${laundryKols.size}`);
  } catch (e: any) {
    console.error(`[step2-laundry] failed: ${e?.message?.split('\n')[0]}`);
  }

  // 5. Token prices — TokenPriceTracker (chain, contractAddress) first,
  //    fallback to exports/backfill_report_2026-05-13.json.
  //    Key: `${chain.toUpperCase()}|${contractAddress.toLowerCase()}`.
  interface PriceEntry {
    currentPrice: number | null;
    peakPrice: number | null;
    dumpPct: number | null;
    source: string | null;
  }
  const tokenPriceMap = new Map<string, PriceEntry>();
  const priceKey = (chain: string, contract: string) =>
    `${chain.toUpperCase()}|${contract.toLowerCase()}`;

  let priceSourceUsed = 'none';
  try {
    const rows = await prisma.$queryRaw<{
      chain: string;
      contractAddress: string;
      currentPrice: string | null;
      peakPrice: string | null;
      dumpPct: string | null;
      source: string | null;
    }[]>`
      SELECT chain, "contractAddress", "currentPrice", "peakPrice", "dumpPct", source
      FROM "TokenPriceTracker"`;
    for (const r of rows) {
      tokenPriceMap.set(priceKey(r.chain, r.contractAddress), {
        currentPrice: r.currentPrice !== null ? parseFloat(r.currentPrice) : null,
        peakPrice: r.peakPrice !== null ? parseFloat(r.peakPrice) : null,
        dumpPct: r.dumpPct !== null ? parseFloat(r.dumpPct) : null,
        source: r.source,
      });
    }
    if (tokenPriceMap.size > 0) {
      priceSourceUsed = 'TokenPriceTracker';
      console.error(`[step2-price] TokenPriceTracker: ${tokenPriceMap.size} rows`);
    } else {
      console.error(`[step2-price] TokenPriceTracker: 0 rows — falling back to backfill JSON`);
    }
  } catch (e: any) {
    console.error(`[step2-price] TokenPriceTracker query failed: ${e?.message?.split('\n')[0]} — falling back to backfill JSON`);
  }

  if (tokenPriceMap.size === 0) {
    const backfillPath = path.join(process.cwd(), 'exports', 'backfill_report_2026-05-13.json');
    if (fs.existsSync(backfillPath)) {
      const data = JSON.parse(fs.readFileSync(backfillPath, 'utf8'));
      for (const r of data.rows as Array<{
        chain: string;
        contractAddress: string;
        currentPrice: number | null;
        peakPrice: number | null;
        dumpPct: number | null;
        source: string | null;
        status: string;
      }>) {
        if (r.status === 'failed') continue;
        tokenPriceMap.set(priceKey(r.chain, r.contractAddress), {
          currentPrice: r.currentPrice,
          peakPrice: r.peakPrice,
          dumpPct: r.dumpPct,
          source: r.source,
        });
      }
      priceSourceUsed = `backfill_report (${data.generatedAt})`;
      console.error(`[step2-price] loaded ${tokenPriceMap.size} entries from backfill JSON`);
    } else {
      console.error(`[step2-price] no backfill JSON at ${backfillPath} — dump signals will be empty`);
    }
  }

  // 6. Build output rows + score.
  interface OutRow {
    ticker: string;
    chain: string;
    contractAddress: string;
    firstSeenDate: string;
    peakPrice: number | '';
    currentPrice: number | '';
    dumpPct: number | '';
    kolsPromoters: string;
    existingCasefile: string;
    suspicionScore: number;
    _priceSource: string;
  }

  const out: OutRow[] = [];
  let priceMatched = 0;

  for (const [ticker, agg] of tokens) {
    // Price: look up by every known (chain, contract) for this ticker, pick
    // the entry with the worst dumpPct (most pessimistic view).
    let peak: number | '' = '';
    let current: number | '' = '';
    let dumpPct: number | '' = '';
    let priceSource: string = 'none';
    for (const [contract, _count] of agg.contracts) {
      const chain = agg.contractChain.get(contract);
      if (!chain) continue;
      const entry = tokenPriceMap.get(priceKey(chain, contract));
      if (!entry) continue;
      const dp = entry.dumpPct;
      if (typeof dp === 'number' && (typeof dumpPct !== 'number' || dp > dumpPct)) {
        peak = entry.peakPrice ?? '';
        current = entry.currentPrice ?? '';
        dumpPct = dp;
        priceSource = entry.source ?? 'unknown';
      } else if (typeof dumpPct !== 'number' && entry.currentPrice !== null) {
        // First match with a price but no dump info — keep as baseline.
        peak = entry.peakPrice ?? '';
        current = entry.currentPrice;
        priceSource = entry.source ?? 'unknown';
      }
    }
    if (priceSource !== 'none') priceMatched++;

    // Scoring — tiered dump
    let score = 0;
    if (typeof dumpPct === 'number') {
      if (dumpPct >= 90) score += 35;
      else if (dumpPct >= 70) score += 25;
      else if (dumpPct >= 50) score += 15;
      // else +0
    }

    const tokenKolsLower = new Set([...agg.kols].map((k) => k.toLowerCase()));
    const laundryHit = [...tokenKolsLower].some((k) => laundryKols.has(k));
    if (laundryHit) score += 25;

    if (agg.proceedsEventCount > 0) score += 20;

    const matchedCanonical = CASE_CODES.some((c) =>
      [...agg.caseIds].some((cid) => cid.toUpperCase().startsWith(c)),
    );
    if (matchedCanonical) score += 15;

    if (agg.kols.size >= 3) score += 10;

    const existingCasefile = matchedCanonical
      ? `oui (${CASE_CODES.find((c) => [...agg.caseIds].some((cid) => cid.toUpperCase().startsWith(c)))})`
      : agg.caseIds.size > 0
        ? `oui (${[...agg.caseIds][0]})`
        : 'non';

    out.push({
      ticker,
      chain: topOf(agg.chains) ?? '',
      contractAddress: topOf(agg.contracts) ?? '',
      firstSeenDate: agg.firstSeenDate ?? '',
      peakPrice: peak,
      currentPrice: current,
      dumpPct,
      kolsPromoters: [...agg.kols].sort().join('|'),
      existingCasefile,
      suspicionScore: score,
      _priceSource: priceSource,
    });
  }

  out.sort((a, b) => b.suspicionScore - a.suspicionScore || a.ticker.localeCompare(b.ticker));

  const header = [
    'ticker',
    'chain',
    'contractAddress',
    'firstSeenDate',
    'peakPrice',
    'currentPrice',
    'dumpPct',
    'kolsPromoters',
    'existingCasefile',
    'suspicionScore',
  ].join(',');
  const lines = [header];
  for (const r of out) {
    lines.push(
      [
        r.ticker,
        r.chain,
        r.contractAddress,
        r.firstSeenDate,
        r.peakPrice,
        r.currentPrice,
        r.dumpPct,
        r.kolsPromoters,
        r.existingCasefile,
        r.suspicionScore,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  const outDir = path.join(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'tickers_to_investigate_2026.csv');
  fs.writeFileSync(outPath, lines.join('\n') + '\n');

  console.error(`\n[done] wrote ${out.length} tokens to ${outPath}`);
  console.error(
    `[price coverage] source=${priceSourceUsed}, tokens with price=${priceMatched}/${out.length}`,
  );
  const buckets = [
    ['>=90', out.filter((r) => r.suspicionScore >= 90).length],
    ['70-89', out.filter((r) => r.suspicionScore >= 70 && r.suspicionScore < 90).length],
    ['50-69', out.filter((r) => r.suspicionScore >= 50 && r.suspicionScore < 70).length],
    ['30-49', out.filter((r) => r.suspicionScore >= 30 && r.suspicionScore < 50).length],
    ['10-29', out.filter((r) => r.suspicionScore >= 10 && r.suspicionScore < 30).length],
    ['0-9',   out.filter((r) => r.suspicionScore < 10).length],
  ];
  console.error(`[score bands] ${buckets.map(([b, n]) => `${b}:${n}`).join(' · ')}`);

  // Top 30 markdown table — also written to exports/tickers_top30.md.
  const top30 = out.slice(0, 30);
  const mdHeader = '| # | ticker | chain | dumpPct | suspicionScore | kolsPromoters | existingCasefile |';
  const mdSep    = '|---|---|---|---|---|---|---|';
  const mdRows = top30.map((r, i) => {
    const dump = typeof r.dumpPct === 'number' ? `${r.dumpPct}%` : '—';
    const kols = r.kolsPromoters.length > 80 ? r.kolsPromoters.slice(0, 77) + '…' : r.kolsPromoters;
    return `| ${i + 1} | \`${r.ticker}\` | ${r.chain || '—'} | ${dump} | ${r.suspicionScore} | ${kols} | ${r.existingCasefile} |`;
  });
  const md = ['# Top 30 tickers à investiguer — 2026-05-13', '', `Source prix: ${priceSourceUsed}`, `Total tokens scorés: ${out.length}`, '', mdHeader, mdSep, ...mdRows, ''].join('\n');
  const mdPath = path.join(outDir, 'tickers_top30_2026-05-13.md');
  fs.writeFileSync(mdPath, md);
  console.error(`[done] markdown top 30 → ${mdPath}`);
  // Also echo the table to stdout for the user.
  console.log(md);
}

main()
  .catch((e) => {
    console.error('[fatal]', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
