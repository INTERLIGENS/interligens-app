// One-off diagnostic. Read-only.
//   Task 1: 3 priority leads (BULLISH, NOBODY, ASTEROID) — deep DB cross-ref.
//   Task 2: 34 Phantom Tendance tickers — match by name with noise filter.
// Output: markdown sections + 4-bucket classification to stdout AND to file.

import fs from 'fs';
import path from 'path';

const envLocal = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const dbUrl = envLocal.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!dbUrl) { console.error('[fatal] DATABASE_URL not found'); process.exit(1); }
process.env.DATABASE_URL = dbUrl;

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CLUSTER = new Set(['bkokoski', 'sxyz500', 'gordongekko', 'planted', 'donwedge']);
const SINCE = '2026-01-01';

const LEADS = [
  { ticker: 'BULLISH', ca: 'C2omVhcvt3DDY77S2KZzawFJQeETZofgZ4eNWWkXpump', chain: 'SOL' },
  { ticker: 'NOBODY',  ca: 'C29ebrgYjYoJPMGPnPSGY1q3mMGk4iDSqnQeQQA7moon', chain: 'SOL' },
  { ticker: 'ASTEROID',ca: '4UeLCRqARmfb6e6KQijtiktqqXUxbfk6jZng7DhuBAGS', chain: 'SOL' },
];

const PHANTOM = [
  'TRUMP','ZEC','TROLL','Fartcoin','USELESS','HANTA','aura','GIGA','Goblin','CARDS',
  'neet','EITHER','WOJAK','jellyjelly','ZEREBRO','MET','SPX','SCAM','BOME','MEW',
  'pippin','USDUC','MAGA','Buttcoin','WIF','PYTHIA','Verse','SKR','ooo','CHILLGUY',
  'GRIFFAIN','ZBCN','GOAT','RENDER',
];

const TRIGGER = /\b(ape|100x|1000x|gem|send it|sending it|ape in|early)\b/i;
// Symbols where the term is a common English word and needs strong noise filter.
const HIGH_NOISE = new Set(['TRUMP','MAGA','SCAM','GOAT','HANTA','MET','aura','neet','ooo','Verse','CARDS','EITHER','RENDER']
  .map(s => s.toUpperCase()));

interface LeadReport {
  ticker: string;
  ca: string;
  tpt: any | null;
  spcCount: number;
  spcWatchlistOnly: number;
  spcTopHandles: Array<{ handle: string; n: number }>;
  spcDates: { min: string | null; max: string | null };
  ktl: Array<{ kolHandle: string; tokenSymbol: string | null; caseId: string | null; role: string; createdAt: string }>;
  kpe: { totalUsd: number; wallets: number; events: number; minDate: string | null; maxDate: string | null; cases: string[] };
  kolProfileMentions: Array<{ handle: string; field: string; snippet: string }>;
  caseIds: string[];
  clusterKols: string[];
  flagBOTIFY: boolean;
}

interface PhantomRow {
  ticker: string;
  symbolUpper: string;
  spcTotal: number;
  spcAfterNoiseFilter: number;
  kolCount: number;
  topPromoters: string[]; // top 3 handles
  inTpt: boolean;
  tptCount: number;
  tptWorstDump: number | null;
  newLead: boolean;
}

function fmtUsd(n: number | null | undefined): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'k';
  return '$' + n.toFixed(2);
}

function fmtPct(n: number | null | undefined): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return n.toFixed(2) + '%';
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const iso = (d instanceof Date ? d : new Date(d)).toISOString();
  return iso.slice(0, 10);
}

async function diagnoseLead(lead: { ticker: string; ca: string; chain: string }): Promise<LeadReport> {
  const tickerUpper = lead.ticker.toUpperCase();
  // 1. TokenPriceTracker
  const tptRows: any[] = await prisma.$queryRaw`
    SELECT chain, "contractAddress", ticker, "currentPrice", "peakPrice", "dumpPct", source, "lastRefreshAt"
    FROM "TokenPriceTracker"
    WHERE LOWER("contractAddress") = LOWER(${lead.ca})`;

  // 2. social_post_candidates — by CA in detectedAddresses OR ticker in detectedTokens
  const spcRows: Array<{ id: string; handle: string | null; discoveredAtUtc: Date; via: string }> = await prisma.$queryRaw`
    SELECT spc.id, i.handle, spc."discoveredAtUtc",
      CASE WHEN spc."detectedAddresses" ILIKE ${'%' + lead.ca + '%'} THEN 'address' ELSE 'symbol' END AS via
    FROM social_post_candidates spc
    LEFT JOIN influencers i ON i.id = spc."influencerId"
    WHERE spc."detectedAddresses" ILIKE ${'%' + lead.ca + '%'}
       OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(COALESCE(spc."detectedTokens",'[]'::jsonb)) t
            WHERE UPPER(t) = ${tickerUpper}
          )`;

  const handleCounts = new Map<string, number>();
  let minDate: string | null = null;
  let maxDate: string | null = null;
  let watchlistTouched = 0;
  for (const r of spcRows) {
    if (r.handle) {
      handleCounts.set(r.handle, (handleCounts.get(r.handle) ?? 0) + 1);
    }
    const iso = r.discoveredAtUtc.toISOString();
    if (!minDate || iso < minDate) minDate = iso;
    if (!maxDate || iso > maxDate) maxDate = iso;
  }
  const spcTopHandles = [...handleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([handle, n]) => ({ handle, n }));

  // 3. KolTokenLink
  const ktlRows: any[] = await prisma.$queryRaw`
    SELECT "kolHandle", "tokenSymbol", "caseId", role, "createdAt"
    FROM "KolTokenLink"
    WHERE LOWER("contractAddress") = LOWER(${lead.ca})
       OR UPPER("tokenSymbol") = ${tickerUpper}`;

  // 4. KolProceedsEvent
  const kpeAgg: any[] = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM("amountUsd"), 0)::float AS total_usd,
      COUNT(DISTINCT "walletAddress")::int AS wallets,
      COUNT(*)::int AS events,
      MIN("eventDate") AS min_date,
      MAX("eventDate") AS max_date
    FROM "KolProceedsEvent"
    WHERE LOWER("tokenAddress") = LOWER(${lead.ca})
       OR UPPER("tokenSymbol") = ${tickerUpper}`;
  const kpeCases: any[] = await prisma.$queryRaw`
    SELECT DISTINCT "caseId"
    FROM "KolProceedsEvent"
    WHERE ("caseId" IS NOT NULL)
      AND (LOWER("tokenAddress") = LOWER(${lead.ca}) OR UPPER("tokenSymbol") = ${tickerUpper})`;

  // 5. KolProfile text fields — manual annotations
  const profMentions: any[] = await prisma.$queryRaw`
    SELECT handle,
      CASE
        WHEN COALESCE(notes,'') ILIKE ${'%' + lead.ticker + '%'} THEN 'notes'
        WHEN COALESCE(summary,'') ILIKE ${'%' + lead.ticker + '%'} THEN 'summary'
        WHEN COALESCE("observedBehaviorSummary",'') ILIKE ${'%' + lead.ticker + '%'} THEN 'observedBehaviorSummary'
        WHEN COALESCE("documentedFacts",'') ILIKE ${'%' + lead.ticker + '%'} THEN 'documentedFacts'
        WHEN COALESCE("internalNote",'') ILIKE ${'%' + lead.ticker + '%'} THEN 'internalNote'
        ELSE NULL
      END AS field,
      COALESCE(
        notes, summary, "observedBehaviorSummary", "documentedFacts", "internalNote"
      ) AS snippet
    FROM "KolProfile"
    WHERE COALESCE(notes,'') ILIKE ${'%' + lead.ticker + '%'}
       OR COALESCE(summary,'') ILIKE ${'%' + lead.ticker + '%'}
       OR COALESCE("observedBehaviorSummary",'') ILIKE ${'%' + lead.ticker + '%'}
       OR COALESCE("documentedFacts",'') ILIKE ${'%' + lead.ticker + '%'}
       OR COALESCE("internalNote",'') ILIKE ${'%' + lead.ticker + '%'}`;

  // Cluster scan
  const allKolHandles = new Set<string>();
  for (const r of ktlRows) allKolHandles.add(r.kolHandle.toLowerCase());
  const proceedsKols: any[] = await prisma.$queryRaw`
    SELECT DISTINCT "kolHandle"
    FROM "KolProceedsEvent"
    WHERE LOWER("tokenAddress") = LOWER(${lead.ca})
       OR UPPER("tokenSymbol") = ${tickerUpper}`;
  for (const r of proceedsKols) allKolHandles.add(r.kolHandle.toLowerCase());
  for (const r of spcTopHandles) allKolHandles.add(r.handle.toLowerCase());
  watchlistTouched = allKolHandles.size;

  const clusterKols = [...allKolHandles].filter((h) => CLUSTER.has(h));

  const caseIds = new Set<string>();
  for (const r of ktlRows) if (r.caseId) caseIds.add(r.caseId);
  for (const r of kpeCases) if (r.caseId) caseIds.add(r.caseId);

  return {
    ticker: lead.ticker,
    ca: lead.ca,
    tpt: tptRows[0] ?? null,
    spcCount: spcRows.length,
    spcWatchlistOnly: watchlistTouched,
    spcTopHandles,
    spcDates: { min: minDate, max: maxDate },
    ktl: ktlRows.map((r) => ({
      kolHandle: r.kolHandle, tokenSymbol: r.tokenSymbol, caseId: r.caseId,
      role: r.role, createdAt: fmtDate(r.createdAt),
    })),
    kpe: {
      totalUsd: kpeAgg[0]?.total_usd ?? 0,
      wallets: kpeAgg[0]?.wallets ?? 0,
      events: kpeAgg[0]?.events ?? 0,
      minDate: kpeAgg[0]?.min_date ? fmtDate(kpeAgg[0].min_date) : null,
      maxDate: kpeAgg[0]?.max_date ? fmtDate(kpeAgg[0].max_date) : null,
      cases: kpeCases.map((r) => r.caseId).filter(Boolean),
    },
    kolProfileMentions: profMentions.map((r) => ({
      handle: r.handle,
      field: r.field ?? 'unknown',
      snippet: (r.snippet ?? '').slice(0, 200),
    })),
    caseIds: [...caseIds],
    clusterKols,
    flagBOTIFY: clusterKols.length >= 3,
  };
}

async function diagnosePhantom(ticker: string): Promise<PhantomRow> {
  const upper = ticker.toUpperCase();
  const isHighNoise = HIGH_NOISE.has(upper);

  // Pull all spc rows where detectedTokens contains the ticker (case-insens).
  const rows: Array<{
    handle: string | null;
    detectedAddresses: string | null;
    rawText: string | null;
    normalizedText: string | null;
  }> = await prisma.$queryRaw`
    SELECT i.handle, spc."detectedAddresses", spc."rawText", spc."normalizedText"
    FROM social_post_candidates spc
    LEFT JOIN influencers i ON i.id = spc."influencerId"
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(spc."detectedTokens",'[]'::jsonb)) t
      WHERE UPPER(t) = ${upper}
    )`;

  const spcTotal = rows.length;
  let kept = 0;
  const handleCounts = new Map<string, number>();
  for (const r of rows) {
    const hasAddr = r.detectedAddresses && !['', '[]', 'null'].includes(r.detectedAddresses);
    const hasTrigger =
      (r.rawText && TRIGGER.test(r.rawText)) ||
      (r.normalizedText && TRIGGER.test(r.normalizedText));
    if (isHighNoise) {
      if (!hasAddr && !hasTrigger) continue;
    }
    kept++;
    if (r.handle) handleCounts.set(r.handle, (handleCounts.get(r.handle) ?? 0) + 1);
  }
  const topPromoters = [...handleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => h);

  // KolTokenLink: count distinct KOLs linked to this symbol.
  const ktlAgg: any[] = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT "kolHandle")::int AS n
    FROM "KolTokenLink"
    WHERE UPPER("tokenSymbol") = ${upper}`;

  // TokenPriceTracker: lookup by ticker field. Multiple contracts possible.
  const tptRows: any[] = await prisma.$queryRaw`
    SELECT "dumpPct"::float AS dump
    FROM "TokenPriceTracker"
    WHERE UPPER(COALESCE(ticker,'')) = ${upper}
    ORDER BY "dumpPct" DESC NULLS LAST`;
  const inTpt = tptRows.length > 0;
  const tptWorstDump =
    tptRows.find((r) => r.dump !== null)?.dump ?? null;

  const ktlCount = ktlAgg[0]?.n ?? 0;
  const newLead = kept === 0 && ktlCount === 0 && !inTpt;

  return {
    ticker,
    symbolUpper: upper,
    spcTotal,
    spcAfterNoiseFilter: kept,
    kolCount: handleCounts.size + ktlCount,
    topPromoters,
    inTpt,
    tptCount: tptRows.length,
    tptWorstDump,
    newLead,
  };
}

function renderLead(r: LeadReport): string {
  const out: string[] = [];
  out.push(`### \`${r.ticker}\`  ·  \`${r.ca}\``);
  out.push('');
  if (r.flagBOTIFY) {
    out.push(`> 🚨 **CLUSTER BOTIFY/GHOST EXTENSION** — match cluster handles: ${r.clusterKols.join(', ')} — investiguer en priorité David, ne pas confier au sprint Lombok worker.`);
    out.push('');
  }
  out.push('| Signal | Valeur |');
  out.push('|---|---|');
  if (r.tpt) {
    out.push(`| TokenPriceTracker | **PRÉSENT** — ticker=${r.tpt.ticker ?? '—'}, current=${r.tpt.currentPrice}, peak=${r.tpt.peakPrice}, dumpPct=${fmtPct(r.tpt.dumpPct ? parseFloat(r.tpt.dumpPct) : null)}, source=${r.tpt.source ?? '—'}, refreshed=${fmtDate(r.tpt.lastRefreshAt)} |`);
  } else {
    out.push(`| TokenPriceTracker | **ABSENT** (pas dans le backfill) |`);
  }
  out.push(`| social_post_candidates | ${r.spcCount} posts (${r.spcWatchlistOnly} handles distincts), du ${fmtDate(r.spcDates.min)} au ${fmtDate(r.spcDates.max)} |`);
  out.push(`| Top promoters (max 10) | ${r.spcTopHandles.length ? r.spcTopHandles.map(h => `${h.handle}×${h.n}`).join(', ') : '—'} |`);
  out.push(`| KolTokenLink | ${r.ktl.length} link(s)${r.ktl.length ? ' → ' + r.ktl.map(l => `${l.kolHandle}${l.caseId?'/'+l.caseId:''}`).join(', ') : ''} |`);
  out.push(`| KolProceedsEvent | events=${r.kpe.events}, proceeds=${fmtUsd(r.kpe.totalUsd)}, wallets=${r.kpe.wallets}, ${r.kpe.minDate??'—'} → ${r.kpe.maxDate??'—'}, cases=[${r.kpe.cases.join(',')||'—'}] |`);
  out.push(`| KolProfile.notes/summary | ${r.kolProfileMentions.length ? r.kolProfileMentions.map(m=>`${m.handle} (${m.field})`).join(', ') : '—'} |`);
  out.push(`| Casefile lié | ${r.caseIds.length ? 'oui — ' + r.caseIds.join(', ') : 'non'} |`);
  out.push(`| Cluster BOTIFY hits | ${r.clusterKols.length ? r.clusterKols.join(', ') : 'aucun'} |`);
  return out.join('\n');
}

function classify(leads: LeadReport[], phantoms: PhantomRow[]) {
  const critical: string[] = [];
  const newLead: string[] = [];
  const partial: string[] = [];
  const already: string[] = [];

  for (const l of leads) {
    const label = `$${l.ticker} (lead)`;
    if (l.flagBOTIFY) critical.push(label);
    else if (l.ktl.length > 0 || l.kpe.events > 0) already.push(label);
    else if (l.tpt || l.spcCount > 0) partial.push(label);
    else newLead.push(label);
  }
  for (const p of phantoms) {
    const label = `${p.ticker} (${p.kolCount}k, ${p.tptWorstDump !== null ? p.tptWorstDump.toFixed(0) + '%' : '—'})`;
    if (p.newLead) newLead.push(label);
    else if (!p.inTpt && p.spcAfterNoiseFilter > 0) partial.push(label);
    else if (p.inTpt) already.push(label);
    else partial.push(label);
  }
  return { critical, newLead, partial, already };
}

async function main() {
  const t0 = Date.now();

  // Task 1
  const leads: LeadReport[] = [];
  for (const l of LEADS) leads.push(await diagnoseLead(l));

  // Task 2
  const phantoms: PhantomRow[] = [];
  for (const t of PHANTOM) phantoms.push(await diagnosePhantom(t));
  phantoms.sort((a, b) =>
    b.kolCount - a.kolCount ||
    ((b.tptWorstDump ?? -1) - (a.tptWorstDump ?? -1)),
  );

  const buckets = classify(leads, phantoms);
  const elapsedS = Math.round((Date.now() - t0) / 1000);

  // ── Render ────────────────────────────────────────────────────────────
  const md: string[] = [];
  md.push(`# Diagnostic tickers — pré-Lombok — 2026-05-13`);
  md.push('');
  md.push(`Mode: lecture seule. DB: ep-square-band.`);
  md.push('');
  md.push('## TASK 1 — 3 leads prioritaires (CA fournis)');
  md.push('');
  for (const r of leads) {
    md.push(renderLead(r));
    md.push('');
  }

  md.push('## TASK 2 — Phantom Tendance (34 tickers, recherche par nom + noise filter)');
  md.push('');
  md.push(`Filtre anti-bruit pour les tickers à forte ambiguïté (TRUMP, MAGA, SCAM, GOAT, HANTA, MET, aura, neet, ooo, Verse, CARDS, EITHER, RENDER) : ne compte que les posts avec CA détectée OU mots-trigger (\`ape|100x|gem|send it|early\`).`);
  md.push('');
  md.push('| ticker | inDB? | spc (total / kept) | KOLcount | topPromoters | dumpPct | newLead? |');
  md.push('|---|---|---|---|---|---|---|');
  for (const p of phantoms) {
    md.push(
      `| \`${p.ticker}\` | ${p.inTpt ? '✅' : '—'} | ${p.spcTotal} / ${p.spcAfterNoiseFilter} | ${p.kolCount} | ${p.topPromoters.join(', ') || '—'} | ${p.tptWorstDump !== null ? p.tptWorstDump.toFixed(1) + '%' : '—'} | ${p.newLead ? '🔴' : '—'} |`,
    );
  }
  md.push('');

  md.push('## BILAN — 4 buckets');
  md.push('');
  md.push(`🚨 **CRITICAL** (cluster BOTIFY match): ${buckets.critical.length}`);
  md.push(buckets.critical.length ? buckets.critical.map(x => `- ${x}`).join('\n') : '_(aucun)_');
  md.push('');
  md.push(`🔴 **NEW LEAD** (totalement absents): ${buckets.newLead.length}`);
  md.push(buckets.newLead.length ? buckets.newLead.map(x => `- ${x}`).join('\n') : '_(aucun)_');
  md.push('');
  md.push(`🟡 **PARTIAL** (détectés mais pas trackés): ${buckets.partial.length}`);
  md.push(buckets.partial.length ? buckets.partial.map(x => `- ${x}`).join('\n') : '_(aucun)_');
  md.push('');
  md.push(`✅ **ALREADY** (déjà connus): ${buckets.already.length}`);
  md.push(buckets.already.length ? buckets.already.map(x => `- ${x}`).join('\n') : '_(aucun)_');
  md.push('');
  md.push(`⏱ Script DB queries: ${elapsedS}s`);

  const out = md.join('\n');
  const outPath = path.join(process.cwd(), 'exports', 'diagnostic_tickers_lombok_2026-05-13.md');
  fs.writeFileSync(outPath, out);
  console.log(out);
  console.error(`\n[done] ${outPath}`);
}

main().catch((e) => { console.error('[fatal]', e); process.exit(1); }).finally(() => prisma.$disconnect());
