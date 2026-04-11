/**
 * Retail Vision V2.3 — Supply concentration computer.
 *
 * Fail-soft Solana supply/holders inspector for a given mint.
 * Produces the inputs needed for TokenLaunchMetric:
 *   - top3Pct, top10Pct  (using top-20 largest via getTokenLargestAccounts)
 *   - holderCount        (null for now; standard RPC has no efficient holder count)
 *   - concentrationScore (0-100, weighted combination of top3/top10)
 *
 * Notes:
 *   - Uses standard Solana RPC methods via Helius (getTokenLargestAccounts,
 *     getTokenSupply). Same endpoint pattern as src/lib/kol/proceeds.ts.
 *   - Does NOT filter out LP/CEX/burn accounts — top-N is raw. Can over-report
 *     concentration for tokens with large pool addresses. Documented as a known
 *     limit of V2.3; a future pass will apply a known-address mask.
 *   - All network paths are wrapped in try/catch; failures return null fields.
 */

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;

export interface ConcentrationResult {
  chain: "SOL";
  tokenMint: string;
  totalSupply: string | null;
  top3Pct: number | null;
  top10Pct: number | null;
  holderCount: number | null;
  concentrationScore: number | null;
  source: string;
  largest: Array<{ address: string; uiAmount: number; pct: number }>;
  error?: string;
}

interface RpcResponse<T> {
  result?: T;
  error?: { message?: string };
}

async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
  if (!process.env.HELIUS_API_KEY) return null;
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as RpcResponse<T>;
    if (j.error) return null;
    return j.result ?? null;
  } catch {
    return null;
  }
}

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeConcentrationScore(
  top3Pct: number | null,
  top10Pct: number | null
): number | null {
  if (top3Pct == null && top10Pct == null) return null;
  const t3 = top3Pct ?? 0;
  const t10 = top10Pct ?? t3;
  const raw = 0.6 * t3 + 0.4 * t10;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export async function computeSupplyConcentration(mint: string): Promise<ConcentrationResult> {
  const base: ConcentrationResult = {
    chain: "SOL",
    tokenMint: mint,
    totalSupply: null,
    top3Pct: null,
    top10Pct: null,
    holderCount: null,
    concentrationScore: null,
    source: "helius.rpc:getTokenLargestAccounts+getTokenSupply",
    largest: [],
  };

  const supplyResp = await rpc<{
    value: { amount: string; decimals: number; uiAmount: number; uiAmountString: string };
  }>("getTokenSupply", [mint]);

  if (!supplyResp?.value) {
    return { ...base, error: "getTokenSupply failed" };
  }

  const totalUi = Number(supplyResp.value.uiAmountString ?? supplyResp.value.uiAmount ?? 0);
  if (!totalUi || totalUi <= 0) {
    return { ...base, totalSupply: supplyResp.value.amount ?? null, error: "total supply is zero" };
  }

  const largestResp = await rpc<{
    value: Array<{
      address: string;
      amount: string;
      decimals: number;
      uiAmount: number;
      uiAmountString: string;
    }>;
  }>("getTokenLargestAccounts", [mint, { commitment: "finalized" }]);

  const holders = largestResp?.value ?? [];
  if (!holders.length) {
    return { ...base, totalSupply: supplyResp.value.amount ?? null, error: "no largest accounts" };
  }

  const amounts = holders
    .map((h) => Number(h.uiAmountString ?? h.uiAmount ?? 0))
    .filter((n) => n > 0);
  const sortedDesc = [...amounts].sort((a, b) => b - a);

  const sumN = (n: number) => sortedDesc.slice(0, n).reduce((s, v) => s + v, 0);
  const top3Pct = roundPct((sumN(3) / totalUi) * 100);
  const top10Pct = roundPct((sumN(10) / totalUi) * 100);
  const concentrationScore = computeConcentrationScore(top3Pct, top10Pct);

  const largest = [...holders]
    .sort((a, b) => Number(b.uiAmountString ?? 0) - Number(a.uiAmountString ?? 0))
    .slice(0, 10)
    .map((h) => {
      const ui = Number(h.uiAmountString ?? h.uiAmount ?? 0);
      return {
        address: h.address,
        uiAmount: ui,
        pct: roundPct((ui / totalUi) * 100),
      };
    });

  return {
    ...base,
    totalSupply: supplyResp.value.amount ?? null,
    top3Pct,
    top10Pct,
    holderCount: null,
    concentrationScore,
    largest,
  };
}
