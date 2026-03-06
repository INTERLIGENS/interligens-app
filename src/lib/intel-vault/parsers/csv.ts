// src/lib/intel-vault/parsers/csv.ts
import { parse } from "csv-parse/sync";
import type { ParseOptions, ParseResult } from "../types";
import { isValidAddress, pickAddressColumn } from "../address";
import { buildRow } from "../normalizer";

export function parseCsv(content: string, opts: ParseOptions): ParseResult {
  const warnings: string[] = [];
  let records: string[][];

  try {
    records = parse(content, { relax_quotes: true, skip_empty_lines: true }) as string[][];
  } catch {
    return { rows: [], totalScanned: 0, warnings: ["CSV parse error"] };
  }

  if (records.length < 2) {
    return { rows: [], totalScanned: 0, warnings: ["CSV: pas assez de lignes"] };
  }

  const headers = records[0].map(h => h.trim().toLowerCase());
  const dataRows = records.slice(1);
  const addrIdx = pickAddressColumn(headers, dataRows);

  if (addrIdx === -1) {
    return { rows: [], totalScanned: dataRows.length, warnings: ["Aucune colonne adresse détectée"] };
  }

  // Detect numeric evidence columns for wearekent-style sheets
  const ethIdx = headers.findIndex(h => h.includes("eth") && !h.includes("address"));
  const usdIdx = headers.findIndex(h => h.includes("usd") || h.includes("$") || h.includes("value"));
  const rankIdx = headers.findIndex(h => h.includes("rank") || h === "#");

  const rows = dataRows
    .map(r => {
      const addr = (r[addrIdx] ?? "").trim();
      if (!isValidAddress(addr)) return null;

      const parts: string[] = [];
      if (ethIdx >= 0 && r[ethIdx]) parts.push(`eth=${r[ethIdx].trim()}`);
      if (usdIdx >= 0 && r[usdIdx]) parts.push(`usd=${r[usdIdx].trim()}`);
      if (rankIdx >= 0 && r[rankIdx]) parts.push(`rank=${r[rankIdx].trim()}`);

      return buildRow(addr, { ...opts, evidence: parts.length ? parts.join(", ") : undefined });
    })
    .filter(Boolean) as ReturnType<typeof buildRow>[];

  if (rows.length === 0) warnings.push("Aucune adresse valide trouvée");

  // Warn on mixed chains
  const chains = new Set(rows.map(r => r.chain));
  if (chains.size > 1) warnings.push(`Chains mixtes détectées: ${[...chains].join(", ")}`);

  return { rows, totalScanned: dataRows.length, warnings };
}
