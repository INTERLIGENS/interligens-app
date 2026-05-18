// ─── Scan ↔ MM integration ────────────────────────────────────────────────
// Glue between the scan result page and the MM Pattern Engine. The scan
// handler calls getMmRiskForToken() in parallel with the existing TigerScore
// work; if the engine times out or the feature flag is off, the MM block
// simply doesn't render. Never throws.

import type { MmChain } from "@/lib/mm/types";
import type { MmRiskAssessment } from "@/lib/mm/adapter/types";
import { computeMmRiskAssessment } from "@/lib/mm/adapter/riskAssessment";

export type { MmRiskAssessment };

/** Hard wall-clock cap on the entire MM path (data fetch + engine + cache). */
export const MM_SCAN_TIMEOUT_MS = 10_000;

/** Cache TTL for the MmScore row — recomputes happen after this window. */
export const MM_SCAN_CACHE_MAX_AGE_HOURS = 6;

const CHAIN_ALIASES: Record<string, MmChain> = {
  sol: "SOLANA",
  solana: "SOLANA",
  eth: "ETHEREUM",
  ethereum: "ETHEREUM",
  base: "BASE",
  arbitrum: "ARBITRUM",
  arb: "ARBITRUM",
  optimism: "OPTIMISM",
  op: "OPTIMISM",
  bnb: "BNB",
  bsc: "BNB",
  polygon: "POLYGON",
  matic: "POLYGON",
};

export function isMmScanBlockEnabled(): boolean {
  // Server-side flag. Client never reads this directly.
  return process.env.MM_SCAN_BLOCK_LIVE === "true";
}

function normaliseChain(raw: string): MmChain | null {
  const k = raw.trim().toLowerCase();
  return CHAIN_ALIASES[k] ?? null;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label}_timeout`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}

/**
 * Resolve an MM risk assessment for a token scan.
 *
 * Contract:
 *   - Returns null when MM_SCAN_BLOCK_LIVE is off (short-circuits before any work).
 *   - Returns null when the chain string is unknown.
 *   - Returns null on any thrown error (API down, DB error, timeout, bad input).
 *   - Cache-first: a fresh MmScore row (age ≤ MM_SCAN_CACHE_MAX_AGE_HOURS) is
 *     reused without recomputing. On cache miss, the engine runs.
 *   - Hard-capped at MM_SCAN_TIMEOUT_MS ms — the scan page is never blocked
 *     for longer than this on the MM path.
 */
export async function getMmRiskForToken(
  tokenAddress: string,
  chain: string,
): Promise<MmRiskAssessment | null> {
  if (!isMmScanBlockEnabled()) return null;

  const cleanAddress = typeof tokenAddress === "string" ? tokenAddress.trim() : "";
  if (!cleanAddress) return null;

  const normalisedChain = normaliseChain(chain);
  if (!normalisedChain) return null;

  try {
    const assessment = await withTimeout(
      computeMmRiskAssessment({
        subjectType: "TOKEN",
        subjectId: cleanAddress,
        chain: normalisedChain,
        triggeredBy: "API_PUBLIC",
        useCache: true,
        maxAgeHours: MM_SCAN_CACHE_MAX_AGE_HOURS,
        persist: true,
      }),
      MM_SCAN_TIMEOUT_MS,
      "mm_scan",
    );
    return assessment;
  } catch (err) {
    // Fail-silent. The scan UI simply doesn't render the MM block.
    console.warn("[mmScanIntegration] failed", {
      address: cleanAddress,
      chain: normalisedChain,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
