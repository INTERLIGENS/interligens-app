// src/lib/intel-vault/parsers/sheet.ts
// Converts a Google Sheets URL to CSV export URL and fetches it.
import type { ParseOptions, ParseResult } from "../types";
import { parseCsv } from "./csv";

/**
 * Converts a Google Sheets share/edit URL to a CSV export URL.
 * Supports: /edit, /pub, bare spreadsheet URLs.
 */
export function toExportUrl(url: string): string {
  // Already a CSV export URL
  if (url.includes("/export")) return url;

  // Extract spreadsheet ID
  const idMatch = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) throw new Error("URL Google Sheets invalide");

  const id = idMatch[1];

  // Extract gid if present
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export async function parseSheet(url: string, opts: ParseOptions): Promise<ParseResult> {
  let exportUrl: string;
  try {
    exportUrl = toExportUrl(url);
  } catch (e) {
    return { rows: [], totalScanned: 0, warnings: [`URL invalide: ${(e as Error).message}`] };
  }

  let csv: string;
  try {
    const res = await fetch(exportUrl, { headers: { "User-Agent": "Interligens/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csv = await res.text();
  } catch (e) {
    return { rows: [], totalScanned: 0, warnings: [`Fetch sheet échoué: ${(e as Error).message}`] };
  }

  return parseCsv(csv, { ...opts, sourceUrl: url });
}
