// One-off export: Watcher V2 watchlist enriched with prod DB context.
// Read-only. Source of truth for the handle universe is
// src/lib/watcher/handles.ts; DB (ep-square-band) provides enrichment.

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

const KNOWN_CASE_CODES = ['BOTIFY', 'VINE', 'GHOST', 'RAVE', 'SOLAXY'] as const;

interface ProfileRow {
  handle: string;
  displayName: string | null;
  followerCount: number | null;
  status: string;
  notes: string | null;
  pdfScore: number | null;
}

interface CaseRow {
  caseId: string;
}

interface CsvRow {
  handle: string;
  displayName: string;
  followers: number;
  isActive: boolean;
  tigerScore: number | '';
  relatedCaseId: string;
  notes: string;
  _priority: string;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function pickCaseCode(cases: CaseRow[]): string {
  for (const code of KNOWN_CASE_CODES) {
    const hit = cases.find((c) => c.caseId.toUpperCase().includes(code));
    if (hit) return code;
  }
  return cases[0]?.caseId ?? '';
}

async function main() {
  // Step 1 — verify structure (user-requested introspection).
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ILIKE '%kol%'
    ORDER BY table_name`;
  console.error(
    `[verify] %kol% tables in prod: ${tables.map((t) => t.table_name).join(', ')}`,
  );

  // Dedupe handles (handles.ts has Regrets10x listed twice).
  const seen = new Set<string>();
  const unique = handlesV2.filter((h) => {
    const key = h.handle.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.error(
    `[input] handles.ts: ${handlesV2.length} entries, ${unique.length} unique`,
  );

  const enriched: CsvRow[] = await Promise.all(
    unique.map(async (wh) => {
      const handle = wh.handle;

      const [profile, cases] = await Promise.all([
        prisma.$queryRaw<ProfileRow[]>`
          SELECT handle, "displayName", "followerCount", status, notes, "pdfScore"
          FROM "KolProfile"
          WHERE LOWER(handle) = LOWER(${handle})
          LIMIT 1`,
        prisma.$queryRaw<CaseRow[]>`
          SELECT "caseId"
          FROM "KolCase"
          WHERE LOWER("kolHandle") = LOWER(${handle})
          ORDER BY "createdAt" DESC`,
      ]);

      const p = profile[0];
      // TigerScore source: KolProfile.pdfScore (persisted 0-100 score baked
      // into the PDF). ScoreSnapshot is currently empty in prod — pdfScore is
      // the latest authoritative snapshot per KOL.
      const tigerScore: number | '' =
        typeof p?.pdfScore === 'number' ? p.pdfScore : '';
      const followers = p?.followerCount ?? wh.followerCount ?? 0;
      const isActive = p ? p.status === 'active' : true;
      const notes = (p?.notes ?? wh.notes ?? '').trim();
      const relatedCaseId = pickCaseCode(cases);

      return {
        handle,
        displayName: p?.displayName ?? '',
        followers,
        isActive,
        tigerScore,
        relatedCaseId,
        notes,
        _priority: wh.priority,
      };
    }),
  );

  // Sort: tigerScore DESC (numeric scores before empty), then followers DESC.
  enriched.sort((a, b) => {
    const sa = typeof a.tigerScore === 'number' ? a.tigerScore : -1;
    const sb = typeof b.tigerScore === 'number' ? b.tigerScore : -1;
    if (sb !== sa) return sb - sa;
    return (b.followers ?? 0) - (a.followers ?? 0);
  });

  const header = [
    'handle',
    'displayName',
    'followers',
    'isActive',
    'tigerScore',
    'relatedCaseId',
    'notes',
  ].join(',');

  const lines = [header];
  for (const r of enriched) {
    lines.push(
      [
        r.handle,
        r.displayName,
        r.followers,
        r.isActive,
        r.tigerScore,
        r.relatedCaseId,
        r.notes,
      ]
        .map(csvEscape)
        .join(','),
    );
  }

  const outDir = path.join(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'kol_watchlist_2026-05-13.csv');
  fs.writeFileSync(outPath, lines.join('\n') + '\n');

  const withProfile = enriched.filter((r) => r.displayName !== '').length;
  const withScore = enriched.filter((r) => r.tigerScore !== '').length;
  const withCase = enriched.filter((r) => r.relatedCaseId !== '').length;

  console.error(`[done] wrote ${enriched.length} rows to ${outPath}`);
  console.error(
    `[enrichment] KolProfile match: ${withProfile}/${enriched.length} · ` +
      `TigerScore: ${withScore}/${enriched.length} · ` +
      `KolCase: ${withCase}/${enriched.length}`,
  );
}

main()
  .catch((e) => {
    console.error('[fatal]', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
