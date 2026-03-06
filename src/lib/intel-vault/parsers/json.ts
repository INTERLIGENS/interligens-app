// src/lib/intel-vault/parsers/json.ts
import type { ParseOptions, ParseResult } from "../types";
import { isValidAddress } from "../address";
import { buildRow } from "../normalizer";

function extractAddresses(obj: unknown, found: string[] = []): string[] {
  if (typeof obj === "string" && isValidAddress(obj)) {
    found.push(obj);
  } else if (Array.isArray(obj)) {
    obj.forEach(item => extractAddresses(item, found));
  } else if (obj && typeof obj === "object") {
    Object.values(obj).forEach(v => extractAddresses(v, found));
  }
  return found;
}

export function parseJson(content: string, opts: ParseOptions): ParseResult {
  const warnings: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return { rows: [], totalScanned: 0, warnings: ["JSON parse error"] };
  }

  const addresses = extractAddresses(parsed);
  if (addresses.length === 0) {
    return { rows: [], totalScanned: 0, warnings: ["Aucune adresse trouvée dans le JSON"] };
  }

  const unique = [...new Set(addresses)];
  const rows = unique.map(addr => buildRow(addr, opts));

  return { rows, totalScanned: unique.length, warnings };
}
