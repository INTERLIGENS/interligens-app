/**
 * Retail Vision Phase 6F-3 — MetaSleuth / BlockSec AML adapter.
 *
 * Fail-soft batched address-label client for BlockSec MetaSleuth AML.
 *
 *   POST https://aml.blocksec.com/address-label/api/v3/batch-labels
 *   Headers: API-KEY: {METASLEUTH_API_KEY}, Content-Type: application/json
 *   Body: { chain_id: number, addresses: string[] }  // up to 50 per call
 *
 * Chain IDs per BlockSec docs:
 *   ETH → 1, BSC → 56, TRON → 195
 *   SOL: BlockSec support is partial; we map SOL → 501 (BlockSec's code
 *   for Solana) and gracefully fall back to skipping if the endpoint
 *   rejects it.
 *
 * ⚠️ EDITORIAL RULE — ABSOLUTE ⚠️
 *   MetaSleuth = backend enrichment only. Never displayed to retail
 *   without independent on-chain corroboration, and never used as a
 *   standalone verdict. All derived KolEvidence rows must carry
 *   displaySafety="INTERNAL_ONLY".
 */

export type MetasleuthChain = "ETH" | "BSC" | "TRON" | "SOL";

export const CHAIN_ID_MAP: Record<MetasleuthChain, number> = {
  ETH: 1,
  BSC: 56,
  TRON: 195,
  SOL: 501,
};

export interface MetasleuthLabel {
  address: string;
  chain: MetasleuthChain;
  mainEntity: string | null;
  nameTag: string | null;
  attributes: string[];
  riskAttributes: string[];
  raw: Record<string, unknown> | null;
}

export interface MetasleuthBatchResult {
  ok: boolean;
  labels: MetasleuthLabel[];
  error?: string;
}

const RISK_TAGS = new Set([
  "SCAMMER",
  "PHISHING",
  "MIXER",
  "SANCTIONED",
  "THEFT",
  "FRAUD",
  "BLACKMAIL",
  "HACK",
]);

const API_URL = "https://aml.blocksec.com/address-label/api/v3/batch-labels";
const MAX_BATCH = 50;

export function hasApiKey(): boolean {
  return Boolean(process.env.METASLEUTH_API_KEY);
}

function normalizeAttrs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => (typeof v === "string" ? v.toUpperCase().trim() : null))
    .filter((v): v is string => v != null && v.length > 0);
}

interface RawBatchResponse {
  code?: number;
  msg?: string;
  data?: Array<{
    address?: string;
    main_entity?: string | null;
    name_tag?: string | null;
    attributes?: string[];
    [k: string]: unknown;
  }>;
}

async function callBatch(
  chainId: number,
  addresses: string[],
  apiKey: string
): Promise<RawBatchResponse | null> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "API-KEY": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ chain_id: chainId, addresses }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as RawBatchResponse;
  } catch {
    return null;
  }
}

export async function fetchBatchLabels(
  chain: MetasleuthChain,
  addresses: string[]
): Promise<MetasleuthBatchResult> {
  const apiKey = process.env.METASLEUTH_API_KEY;
  if (!apiKey) return { ok: false, labels: [], error: "METASLEUTH_API_KEY not set" };
  if (addresses.length === 0) return { ok: true, labels: [] };
  const chainId = CHAIN_ID_MAP[chain];
  if (!chainId) return { ok: false, labels: [], error: `unsupported chain: ${chain}` };

  const out: MetasleuthLabel[] = [];
  for (let i = 0; i < addresses.length; i += MAX_BATCH) {
    const batch = addresses.slice(i, i + MAX_BATCH);
    const resp = await callBatch(chainId, batch, apiKey);
    if (!resp || !Array.isArray(resp.data)) {
      // Fail-soft: skip this batch but continue; partial results are OK.
      continue;
    }
    for (const row of resp.data) {
      const addr = typeof row.address === "string" ? row.address : null;
      if (!addr) continue;
      const attrs = normalizeAttrs(row.attributes);
      out.push({
        address: addr,
        chain,
        mainEntity: typeof row.main_entity === "string" ? row.main_entity : null,
        nameTag: typeof row.name_tag === "string" ? row.name_tag : null,
        attributes: attrs,
        riskAttributes: attrs.filter((a) => RISK_TAGS.has(a)),
        raw: row as Record<string, unknown>,
      });
    }
    // Polite spacing between batches.
    await new Promise((r) => setTimeout(r, 300));
  }

  return { ok: true, labels: out };
}

export function isRisky(label: MetasleuthLabel): boolean {
  return label.riskAttributes.length > 0;
}
