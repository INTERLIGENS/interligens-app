#!/usr/bin/env python3
"""
PATCH 02 — Intel Vault: Parsers + Normalizer + Dedup
Crée src/lib/intel-vault/{parsers/csv,json,sheet,text,index} + normalizer + dedup.
Idempotent.
"""
import os, sys

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))
LIB = os.path.join(ROOT, "src", "lib", "intel-vault")

FILES = {}

# ─── types ────────────────────────────────────────────────────────────────────
FILES["types.ts"] = '''\
// src/lib/intel-vault/types.ts
export type Chain = "ethereum"|"solana"|"bsc"|"polygon"|"arbitrum"|"base"|"other";
export type LabelType =
  | "scam"|"phishing"|"drainer"|"exploiter"|"insider"
  | "kol"|"whale"|"airdrop_target"|"cluster_member"|"incident_related"|"other";
export type Confidence = "low"|"medium"|"high";
export type Visibility = "internal_only"|"sources_on_request";
export type TosRisk = "low"|"medium"|"high";

export interface NormalizedRow {
  chain: Chain;
  address: string;
  labelType: LabelType;
  label: string;
  confidence: Confidence;
  entityName?: string;
  sourceName: string;
  sourceUrl?: string;
  evidence?: string;
  visibility: Visibility;
  license?: string;
  tosRisk: TosRisk;
}

export interface ParseOptions {
  defaultChain?: Chain;
  defaultLabelType?: LabelType;
  label?: string;
  sourceName?: string;
  sourceUrl?: string;
  visibility?: Visibility;
  confidence?: Confidence;
}

export interface ParseResult {
  rows: NormalizedRow[];
  totalScanned: number;
  warnings: string[];
}
'''

# ─── address regex ─────────────────────────────────────────────────────────────
FILES["address.ts"] = '''\
// src/lib/intel-vault/address.ts
export const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
export const BASE58_CHARSET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function detectChain(addr: string): "ethereum"|"solana"|"other" {
  if (EVM_RE.test(addr)) return "ethereum";
  if (BASE58_CHARSET.test(addr)) return "solana";
  return "other";
}

export function isValidAddress(addr: string): boolean {
  return EVM_RE.test(addr) || BASE58_CHARSET.test(addr);
}

/** Given a list of column names, return index of best candidate for address column */
export function pickAddressColumn(headers: string[], rows: string[][]): number {
  const counts = headers.map((_, ci) =>
    rows.filter(r => isValidAddress((r[ci] ?? "").trim())).length
  );
  const max = Math.max(...counts);
  if (max === 0) return -1;
  return counts.indexOf(max);
}
'''

# ─── normalizer ────────────────────────────────────────────────────────────────
FILES["normalizer.ts"] = '''\
// src/lib/intel-vault/normalizer.ts
import type { NormalizedRow, ParseOptions, Chain, LabelType, Confidence, Visibility } from "./types";
import { detectChain } from "./address";

export function buildRow(
  address: string,
  opts: ParseOptions & { evidence?: string }
): NormalizedRow {
  const chain: Chain = opts.defaultChain ?? detectChain(address) as Chain;
  return {
    chain,
    address: address.trim(),
    labelType: (opts.defaultLabelType ?? "other") as LabelType,
    label: opts.label ?? opts.sourceName ?? "unknown",
    confidence: opts.confidence ?? "low",
    sourceName: opts.sourceName ?? "unknown",
    sourceUrl: opts.sourceUrl,
    evidence: opts.evidence,
    visibility: opts.visibility ?? "internal_only",
    license: undefined,
    tosRisk: "low",
  };
}
'''

# ─── dedup ─────────────────────────────────────────────────────────────────────
FILES["dedup.ts"] = '''\
// src/lib/intel-vault/dedup.ts
import { prisma } from "@/lib/prisma";
import type { NormalizedRow } from "./types";

export async function upsertRows(rows: NormalizedRow[], batchId: string): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const key = {
      chain: row.chain as never,
      address: row.address,
      labelType: row.labelType as never,
      label: row.label,
      sourceUrl: row.sourceUrl ?? null,
    };

    const existing = await prisma.addressLabel.findUnique({
      where: { dedup_key: key },
    });

    if (existing) {
      // Merge evidence (append if new, no duplicate)
      let evidence = existing.evidence ?? "";
      if (row.evidence && !evidence.includes(row.evidence)) {
        evidence = [evidence, row.evidence].filter(Boolean).join(" | ");
      }
      await prisma.addressLabel.update({
        where: { dedup_key: key },
        data: { lastSeenAt: new Date(), evidence: evidence || null },
      });
      updated++;
    } else {
      await prisma.addressLabel.create({
        data: {
          ...row,
          chain: row.chain as never,
          labelType: row.labelType as never,
          confidence: row.confidence as never,
          visibility: row.visibility as never,
          tosRisk: row.tosRisk as never,
          batchId,
        },
      });
      created++;
    }
  }

  return { created, updated };
}
'''

# ─── parsers/csv ───────────────────────────────────────────────────────────────
FILES["parsers/csv.ts"] = '''\
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
'''

# ─── parsers/json ──────────────────────────────────────────────────────────────
FILES["parsers/json.ts"] = '''\
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
'''

# ─── parsers/sheet ─────────────────────────────────────────────────────────────
FILES["parsers/sheet.ts"] = '''\
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
'''

# ─── parsers/text ──────────────────────────────────────────────────────────────
FILES["parsers/text.ts"] = '''\
// src/lib/intel-vault/parsers/text.ts
// Extract addresses from freeform text / Twitter/X threads.
import type { ParseOptions, ParseResult } from "../types";
import { isValidAddress } from "../address";
import { buildRow } from "../normalizer";
import { EVM_RE, BASE58_CHARSET } from "../address";

export function parseText(content: string, opts: ParseOptions): ParseResult {
  const warnings: string[] = [];

  // Extract EVM addresses
  const evmMatches = content.match(new RegExp(EVM_RE.source, "gi")) ?? [];
  // Extract potential Solana addresses (word boundaries, 32-44 base58 chars)
  const solMatches = (content.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g) ?? [])
    .filter(m => BASE58_CHARSET.test(m) && !EVM_RE.test(m));

  const all = [...new Set([...evmMatches, ...solMatches])].filter(isValidAddress);

  if (all.length === 0) {
    warnings.push("Aucune adresse trouvée dans le texte");
    return { rows: [], totalScanned: 0, warnings };
  }

  // Take a short snippet (first 200 chars) as evidence context
  const snippet = content.slice(0, 200).replace(/\\s+/g, " ").trim();
  const rows = all.map(addr =>
    buildRow(addr, { ...opts, evidence: opts.sourceUrl ? `snippet: "${snippet}"` : undefined })
  );

  return { rows, totalScanned: all.length, warnings };
}
'''

# ─── parsers/index ─────────────────────────────────────────────────────────────
FILES["parsers/index.ts"] = '''\
// src/lib/intel-vault/parsers/index.ts
export { parseCsv } from "./csv";
export { parseJson } from "./json";
export { parseSheet, toExportUrl } from "./sheet";
export { parseText } from "./text";
'''

# ─── index ─────────────────────────────────────────────────────────────────────
FILES["index.ts"] = '''\
// src/lib/intel-vault/index.ts
export * from "./types";
export * from "./address";
export * from "./normalizer";
export * from "./dedup";
export * from "./parsers/index";
'''

def write_file(rel_path: str, content: str):
    abs_path = os.path.join(LIB, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    if os.path.exists(abs_path):
        with open(abs_path, "r") as f:
            if f.read().strip() == content.strip():
                print(f"✅ {rel_path} — déjà à jour, skip.")
                return
    with open(abs_path, "w") as f:
        f.write(content)
    print(f"✅ {rel_path} — écrit.")

def patch():
    for path, content in FILES.items():
        write_file(path, content)
    print("\n✅ Patch 02 terminé — Parsers + Normalizer + Dedup créés.")
    print("   Vérifie que csv-parse est installé: pnpm add csv-parse")

patch()
