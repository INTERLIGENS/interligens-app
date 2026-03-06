// src/lib/intel-vault/parsers/text.ts
import type { ParseOptions, ParseResult } from "../types";
import { isValidAddress } from "../address";
import { buildRow } from "../normalizer";

// Regex SANS ancres pour extraire des adresses dans du texte libre
const EVM_IN_TEXT = /0x[a-fA-F0-9]{40}/g;
const SOL_IN_TEXT = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

export function parseText(content: string, opts: ParseOptions): ParseResult {
  const warnings: string[] = [];

  const evmMatches = content.match(EVM_IN_TEXT) ?? [];
  const solMatches = (content.match(SOL_IN_TEXT) ?? [])
    .filter(m => !/^0x/.test(m));

  const all = [...new Set([...evmMatches, ...solMatches])].filter(isValidAddress);

  if (all.length === 0) {
    warnings.push("Aucune adresse trouvée dans le texte");
    return { rows: [], totalScanned: 0, warnings };
  }

  const snippet = content.slice(0, 200).replace(/\s+/g, " ").trim();
  const rows = all.map(addr =>
    buildRow(addr, { ...opts, evidence: opts.sourceUrl ? `snippet: "${snippet}"` : undefined })
  );

  return { rows, totalScanned: all.length, warnings };
}
