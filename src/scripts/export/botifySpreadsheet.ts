// ─────────────────────────────────────────────────────────────────────────────
// BOTIFY Evidence Spreadsheet Export
//
// Builds a data-room evidence table for CASE-2024-BOTIFY-001 from three
// sources:
//   1. data/cases/botify.json        — documented claims + detective trade
//   2. DB: KolCase / KolProfile      — KOLs linked to the BOTIFY case
//   3. DB: KolWallet                 — wallet addresses for those KOLs
//   4. DB: KolProceedsEvent          — proceeds amounts (schema-drift table,
//                                      queried defensively via raw SQL)
//
// Output: exports/BOTIFY_EVIDENCE_TABLE.csv  and  .json
//
// Run:  npx tsx src/scripts/export/botifySpreadsheet.ts
//
// The row-building and CSV functions are pure and exported so the admin
// download route (/api/admin/export/botify) can reuse them without
// touching the filesystem.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BotifyClaim {
  claim_id: string;
  title: string;
  severity: string;
  status: string;
  description?: string;
  evidence_refs?: string[];
  thread_url?: string | null;
  category?: string;
}

export interface BotifyCase {
  case_meta: {
    case_id: string;
    token_name: string;
    ticker: string;
    mint: string;
    chain: string;
    status: string;
    severity: string;
  };
  claims: BotifyClaim[];
  detective_trade?: {
    buy_tx?: string;
    sell_tx?: string;
    wallet?: string;
    pnl_usd?: number;
    notes_en?: string;
  };
}

export interface DbEnrichment {
  wallets: { handle: string; address: string; label: string }[];
  proceeds: { ref: string; amountUsd: string; txHashes: string }[];
}

export interface EvidenceRow {
  claimNo: string;
  title: string;
  severity: string;
  status: string;
  evidenceUrl: string;
  wallets: string;
  amountUsd: string;
  txHashes: string;
}

export const CSV_HEADERS = [
  "Claim #",
  "Title",
  "Severity",
  "Status",
  "Evidence URL",
  "Wallets",
  "Amount USD",
  "TX Hashes",
] as const;

// ── Pure builders ────────────────────────────────────────────────────────────

/**
 * Builds the evidence rows. Every row is sourced from real data — no per-claim
 * wallet/amount mapping is invented. Claim rows carry the documented claim;
 * on-chain detail lives on its own clearly-labelled rows (detective trade,
 * DB-attributed wallets, proceeds events).
 */
export function buildBotifyEvidenceRows(
  caseData: BotifyCase,
  db: DbEnrichment,
): EvidenceRow[] {
  const rows: EvidenceRow[] = [];

  // 1. Documented claims
  for (const c of caseData.claims ?? []) {
    rows.push({
      claimNo: c.claim_id,
      title: c.title,
      severity: c.severity,
      status: c.status,
      evidenceUrl: c.thread_url || (c.evidence_refs ?? []).join("; "),
      wallets: "",
      amountUsd: "",
      txHashes: "",
    });
  }

  // 2. Detective trade — case-level on-chain evidence
  const dt = caseData.detective_trade;
  if (dt && (dt.wallet || dt.buy_tx || dt.sell_tx)) {
    rows.push({
      claimNo: "DT-1",
      title: "Insider front-run trade (detective-documented)",
      severity: "HIGH",
      status: "DOCUMENTED",
      evidenceUrl: `https://solscan.io/account/${dt.wallet ?? ""}`,
      wallets: dt.wallet ?? "",
      amountUsd: dt.pnl_usd != null ? String(dt.pnl_usd) : "",
      txHashes: [dt.buy_tx, dt.sell_tx].filter(Boolean).join("; "),
    });
  }

  // 3. DB-attributed wallets for KOLs linked to the case
  db.wallets.forEach((w, i) => {
    rows.push({
      claimNo: `DB-WALLET-${i + 1}`,
      title: `Attributed wallet — @${w.handle}${w.label ? ` (${w.label})` : ""}`,
      severity: "INFO",
      status: "ATTRIBUTED",
      evidenceUrl: `https://solscan.io/account/${w.address}`,
      wallets: w.address,
      amountUsd: "",
      txHashes: "",
    });
  });

  // 4. DB proceeds events
  db.proceeds.forEach((p, i) => {
    rows.push({
      claimNo: `DB-PROCEEDS-${i + 1}`,
      title: `Proceeds event — ${p.ref}`,
      severity: "INFO",
      status: "RECORDED",
      evidenceUrl: "",
      wallets: "",
      amountUsd: p.amountUsd,
      txHashes: p.txHashes,
    });
  });

  return rows;
}

function csvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function rowsToCsv(rows: EvidenceRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.claimNo,
        r.title,
        r.severity,
        r.status,
        r.evidenceUrl,
        r.wallets,
        r.amountUsd,
        r.txHashes,
      ]
        .map((c) => csvCell(String(c ?? "")))
        .join(","),
    );
  }
  return lines.join("\r\n");
}

// ── DB enrichment (defensive — degrades to empty on any failure) ─────────────

export async function loadBotifyDbEnrichment(caseId: string): Promise<DbEnrichment> {
  const out: DbEnrichment = { wallets: [], proceeds: [] };

  // KOL handles linked to the case (via KolCase) + any profile carrying a
  // botifyDeal payload.
  const handles = new Set<string>();
  try {
    const cases = await prisma.kolCase.findMany({
      where: { caseId },
      select: { kolHandle: true },
    });
    cases.forEach((c) => handles.add(c.kolHandle));
  } catch (e: any) {
    console.warn(`[botify-export] KolCase query failed: ${e?.message ?? e}`);
  }
  try {
    const profs = await prisma.kolProfile.findMany({
      where: { botifyDeal: { not: Prisma.DbNull } },
      select: { handle: true },
    });
    profs.forEach((p) => handles.add(p.handle));
  } catch (e: any) {
    console.warn(`[botify-export] KolProfile(botifyDeal) query failed: ${e?.message ?? e}`);
  }

  if (handles.size > 0) {
    try {
      const wallets = await prisma.kolWallet.findMany({
        where: { kolHandle: { in: [...handles] } },
        select: { kolHandle: true, address: true, label: true },
      });
      out.wallets = wallets.map((w) => ({
        handle: w.kolHandle,
        address: w.address,
        label: w.label ?? "",
      }));
    } catch (e: any) {
      console.warn(`[botify-export] KolWallet query failed: ${e?.message ?? e}`);
    }
  }

  // KolProceedsEvent — not present in schema.prod.prisma (known schema drift).
  // Query defensively with raw SQL; skip silently if the table is absent.
  try {
    const raw: any[] = await prisma.$queryRawUnsafe(
      'SELECT * FROM "KolProceedsEvent" LIMIT 500',
    );
    const matches = raw.filter((r) =>
      JSON.stringify(r).toLowerCase().includes("botify"),
    );
    out.proceeds = matches.map((r, i) => {
      const amount =
        r.amountUsd ?? r.amount_usd ?? r.proceedsUsd ?? r.amount ?? "";
      const tx = r.txHash ?? r.tx_hash ?? r.signature ?? "";
      return {
        ref: String(r.id ?? r.kolHandle ?? `event-${i + 1}`),
        amountUsd: amount != null ? String(amount) : "",
        txHashes: tx ? String(tx) : "",
      };
    });
  } catch {
    console.warn(
      "[botify-export] KolProceedsEvent unavailable (schema drift) — proceeds rows skipped",
    );
  }

  return out;
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

async function main() {
  const repoRoot = process.cwd();
  const casePath = path.join(repoRoot, "data/cases/botify.json");
  if (!fs.existsSync(casePath)) {
    console.error(`[botify-export] case file not found: ${casePath}`);
    process.exit(1);
  }
  const caseData: BotifyCase = JSON.parse(fs.readFileSync(casePath, "utf-8"));

  console.log(`[botify-export] case: ${caseData.case_meta.case_id}`);
  const db = await loadBotifyDbEnrichment(caseData.case_meta.case_id);
  console.log(
    `[botify-export] DB enrichment: ${db.wallets.length} wallet(s), ${db.proceeds.length} proceeds event(s)`,
  );

  const rows = buildBotifyEvidenceRows(caseData, db);
  const csv = rowsToCsv(rows);
  const json = JSON.stringify(
    { caseId: caseData.case_meta.case_id, generatedAt: new Date().toISOString(), rows },
    null,
    2,
  );

  const outDir = path.join(repoRoot, "exports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "BOTIFY_EVIDENCE_TABLE.csv"), csv);
  fs.writeFileSync(path.join(outDir, "BOTIFY_EVIDENCE_TABLE.json"), json);

  console.log(`[botify-export] wrote ${rows.length} rows → exports/BOTIFY_EVIDENCE_TABLE.{csv,json}`);
  await prisma.$disconnect();
}

// Run main() only when invoked directly, never when imported by a route.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[botify-export] fatal:", e);
    process.exit(1);
  });
}
