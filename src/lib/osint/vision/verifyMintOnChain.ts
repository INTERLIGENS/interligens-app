/**
 * src/lib/osint/vision/verifyMintOnChain.ts
 *
 * LOCK 2 (mint existence) + LOCK 3 (symbol metadata) via Helius DAS getAsset.
 * Mirrors the existing repo pattern (src/app/api/scan/solana/route.ts
 * fetchTokenMetadata): POST https://mainnet.helius-rpc.com/?api-key=KEY,
 * method getAsset, 8s timeout.
 *
 * CRITICAL difference from the repo's fail-OPEN helpers: this one is fail-SOFT
 * in the security sense — it returns three DISTINCT statuses and the caller
 * resolves a CA ONLY on "exists". A check that could not run ("unavailable":
 * missing key, network error, timeout, RPC error) NEVER resolves a CA.
 *   - exists      : the mint is a real on-chain asset (symbol may be present)
 *   - not_found   : the RPC answered and the asset does not exist -> CA is fake
 *   - unavailable : the check could not be completed -> do NOT resolve (PENDING)
 */

export type MintStatus = "exists" | "not_found" | "unavailable";

export interface MintVerification {
  status: MintStatus;
  symbol: string | null;
  name: string | null;
}

export type VerifyMintFn = (mint: string) => Promise<MintVerification>;

interface HeliusAsset {
  id?: string;
  content?: { metadata?: { name?: string; symbol?: string } };
  token_info?: { symbol?: string };
}

/**
 * Pure classifier (unit-testable): map a parsed Helius getAsset response to a
 * MintVerification. `httpOk` is res.ok; `json` is the parsed body (or null).
 */
export function classifyAsset(httpOk: boolean, json: unknown): MintVerification {
  if (!httpOk || json === null || typeof json !== "object") {
    return { status: "unavailable", symbol: null, name: null };
  }
  const j = json as { result?: HeliusAsset | null; error?: { message?: string } };

  if (j.error) {
    // Helius returns an error for a non-existent asset ("Asset Not Found" /
    // database error). Treat clear not-found messages as not_found; anything
    // else is an RPC failure we must not resolve on.
    const msg = (j.error.message ?? "").toLowerCase();
    if (msg.includes("not found") || msg.includes("does not exist")) {
      return { status: "not_found", symbol: null, name: null };
    }
    return { status: "unavailable", symbol: null, name: null };
  }

  const r = j.result;
  if (!r || !r.id) {
    // RPC answered cleanly with no asset -> the mint does not exist.
    return { status: "not_found", symbol: null, name: null };
  }

  const symbol = r.token_info?.symbol ?? r.content?.metadata?.symbol ?? null;
  const name = r.content?.metadata?.name ?? null;
  return { status: "exists", symbol: symbol || null, name: name || null };
}

/**
 * Real Helius call. Fail-soft: any inability to complete the check -> "unavailable".
 */
export async function verifyMintOnChain(mint: string): Promise<MintVerification> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return { status: "unavailable", symbol: null, name: null };
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "osint-verify", method: "getAsset", params: { id: mint } }),
      signal: AbortSignal.timeout(8_000),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      return { status: "unavailable", symbol: null, name: null };
    }
    return classifyAsset(res.ok, json);
  } catch {
    // network error / timeout / abort -> cannot verify -> never resolve
    return { status: "unavailable", symbol: null, name: null };
  }
}
