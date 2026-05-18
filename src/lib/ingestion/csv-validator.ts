// src/lib/ingestion/csv-validator.ts
// Validates raw Arkham CSV content before any DB insert.

import { prisma } from "@/lib/prisma";

export type ArkhamRow = {
  line: number;
  txHash: string;
  amountUsd: number;
  eventDate: Date;
  kolHandle: string | null;
  walletAddress: string | null;
  tokenSymbol: string | null;
};

export type CsvValidationResult = {
  valid: ArkhamRow[];
  errors: { line: number; reason: string }[];
  duplicates: number;
  preview: string;
};

// Expected header columns (case-insensitive, order-flexible via map)
const FIELD_ALIASES: Record<string, string> = {
  txhash: "txHash",
  tx_hash: "txHash",
  transaction: "txHash",
  amountusd: "amountUsd",
  amount_usd: "amountUsd",
  amount: "amountUsd",
  usd: "amountUsd",
  eventdate: "eventDate",
  event_date: "eventDate",
  date: "eventDate",
  timestamp: "eventDate",
  kolhandle: "kolHandle",
  kol_handle: "kolHandle",
  handle: "kolHandle",
  walletaddress: "walletAddress",
  wallet_address: "walletAddress",
  wallet: "walletAddress",
  address: "walletAddress",
  tokensymbol: "tokenSymbol",
  token_symbol: "tokenSymbol",
  token: "tokenSymbol",
  symbol: "tokenSymbol",
};

function normalizeHeader(h: string): string {
  return FIELD_ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase();
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDate(raw: string): Date | null {
  if (!raw.trim()) return null;
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? null : d;
}

function splitCsvLine(line: string): string[] {
  // Handles quoted fields with commas inside
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function validateArkhamCsv(content: string): Promise<CsvValidationResult> {
  const lines = content.split(/\r?\n/);
  const errors: { line: number; reason: string }[] = [];
  const candidates: ArkhamRow[] = [];
  let headerMap: Record<string, number> = {};
  let hasHeader = false;
  let dataStartLine = 1;

  // Detect header row
  const firstNonEmpty = lines.findIndex(l => l.trim().length > 0);
  if (firstNonEmpty === -1) {
    return { valid: [], errors: [{ line: 0, reason: "File is empty" }], duplicates: 0, preview: "" };
  }

  const firstLineParts = splitCsvLine(lines[firstNonEmpty]);
  const firstNorm = normalizeHeader(firstLineParts[0] ?? "");
  if (firstNorm === "txHash" || firstNorm === "txhash" || firstLineParts[0]?.toLowerCase().includes("hash")) {
    hasHeader = true;
    dataStartLine = firstNonEmpty + 1;
    firstLineParts.forEach((h, i) => {
      headerMap[normalizeHeader(h)] = i;
    });
  } else {
    // No header — assume fixed column order: txHash, walletAddress, chain, date, amountUsd, kolHandle, tokenSymbol
    headerMap = { txHash: 0, walletAddress: 1, chain: 2, eventDate: 3, amountUsd: 4, kolHandle: 5, tokenSymbol: 6 };
    dataStartLine = firstNonEmpty;
  }

  // Parse rows
  for (let i = dataStartLine; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;
    if (!raw.trim()) continue; // silent skip

    const parts = splitCsvLine(raw);

    const txHashIdx = headerMap["txHash"] ?? 0;
    const amountIdx = headerMap["amountUsd"] ?? 4;
    const dateIdx = headerMap["eventDate"] ?? 3;
    const handleIdx = headerMap["kolHandle"];
    const walletIdx = headerMap["walletAddress"] ?? 1;
    const tokenIdx = headerMap["tokenSymbol"];

    const txHash = (parts[txHashIdx] ?? "").trim();
    if (!txHash) {
      errors.push({ line: lineNum, reason: "Missing txHash" });
      continue;
    }

    const rawAmount = (parts[amountIdx] ?? "").trim();
    const amountUsd = parseAmount(rawAmount);
    if (amountUsd === null) {
      errors.push({ line: lineNum, reason: `Invalid amountUsd: "${rawAmount}"` });
      continue;
    }

    const rawDate = (parts[dateIdx] ?? "").trim();
    const eventDate = parseDate(rawDate);
    if (!eventDate) {
      errors.push({ line: lineNum, reason: `Invalid date: "${rawDate}"` });
      continue;
    }

    candidates.push({
      line: lineNum,
      txHash,
      amountUsd,
      eventDate,
      kolHandle: handleIdx !== undefined ? (parts[handleIdx] ?? "").trim() || null : null,
      walletAddress: walletIdx !== undefined ? (parts[walletIdx] ?? "").trim() || null : null,
      tokenSymbol: tokenIdx !== undefined ? (parts[tokenIdx] ?? "").trim() || null : null,
    });
  }

  // Dedup check against DB
  let duplicates = 0;
  const valid: ArkhamRow[] = [];
  if (candidates.length > 0) {
    const txHashes = candidates.map(c => c.txHash);
    // Check which txHashes already exist in KolProceedsEvent
    const existing = await prisma.$queryRaw<{ txHash: string }[]>`
      SELECT "txHash" FROM "KolProceedsEvent"
      WHERE "txHash" = ANY(${txHashes}::text[])
    `.catch(() => [] as { txHash: string }[]);

    const existingSet = new Set(existing.map(r => r.txHash));

    // Also dedup within-file
    const seenInFile = new Set<string>();
    for (const row of candidates) {
      if (existingSet.has(row.txHash)) {
        duplicates++;
        continue;
      }
      if (seenInFile.has(row.txHash)) {
        duplicates++;
        continue;
      }
      seenInFile.add(row.txHash);
      valid.push(row);
    }
  }

  if (candidates.length === 0 && errors.length === 0) {
    errors.push({ line: 0, reason: "No data rows found" });
  }

  const preview = buildPreview(valid, errors, duplicates, hasHeader);

  return { valid, errors, duplicates, preview };
}

function buildPreview(
  valid: ArkhamRow[],
  errors: { line: number; reason: string }[],
  duplicates: number,
  hasHeader: boolean
): string {
  const lines: string[] = [
    `CSV parse summary (header detected: ${hasHeader})`,
    `  Valid rows    : ${valid.length}`,
    `  Error rows    : ${errors.length}`,
    `  Duplicates    : ${duplicates}`,
  ];
  if (errors.length > 0) {
    lines.push("  First errors  :");
    errors.slice(0, 5).forEach(e => lines.push(`    L${e.line}: ${e.reason}`));
  }
  if (valid.length > 0) {
    lines.push("  Sample valid  :");
    valid.slice(0, 3).forEach(r =>
      lines.push(`    L${r.line}: ${r.txHash.slice(0, 12)}… $${r.amountUsd} ${r.eventDate.toISOString().slice(0, 10)}`)
    );
  }
  return lines.join("\n");
}
