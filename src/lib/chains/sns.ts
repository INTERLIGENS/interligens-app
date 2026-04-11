/**
 * Retail Vision Phase 6F-2 — Solana Name Service (.sol) resolver.
 *
 * Fail-soft forward resolver for `{handle}.sol` → public Solana address.
 *
 * Strategy: no new npm dependency. Bonfida operates a free public proxy
 * that wraps the on-chain resolution:
 *
 *   GET https://sns-sdk-proxy.bonfida.workers.dev/resolve/{domain}
 *   → { "s": "ok",  "result": "<base58 pubkey>" }
 *   → { "s": "error", "result": "Domain not found" }
 *
 * We try that first. If it fails (network/5xx), we fall back to a
 * second public resolver pattern. Any failure returns null.
 *
 * The caller must accept null and move on — SNS resolution is
 * best-effort and the miss rate is expected to be high (most X handles
 * never registered a .sol).
 */

const PROXIES = [
  "https://sns-sdk-proxy.bonfida.workers.dev/resolve",
  "https://sns-api.bonfida.com/v2/resolver/domain",
];

interface BonfidaProxyResponse {
  s?: string;
  result?: string | null;
}

async function tryProxy(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as BonfidaProxyResponse;
    if (json.s !== "ok") return null;
    const r = json.result;
    if (typeof r !== "string" || r.length < 32 || r.length > 64) return null;
    return r;
  } catch {
    return null;
  }
}

/**
 * Resolve `{handle}.sol` to a Solana public key (base58 string).
 * Returns null on any failure.
 */
export async function resolveSns(domain: string): Promise<string | null> {
  if (!domain) return null;
  const clean = domain.replace(/\.sol$/i, "").toLowerCase().trim();
  if (!clean || !/^[a-z0-9_-]+$/.test(clean)) return null;

  for (const base of PROXIES) {
    const url = `${base}/${encodeURIComponent(clean)}`;
    const r = await tryProxy(url);
    if (r) return r;
  }
  return null;
}

/**
 * Attempt common handle variants. Kept minimal — unlike ENS where
 * `_crypto`/`_nft` suffixes are idiomatic, SNS registrations are
 * almost always the bare handle.
 */
export async function resolveSnsForHandle(handle: string): Promise<{
  domain: string;
  address: string;
} | null> {
  if (!handle) return null;
  const variants = Array.from(
    new Set(
      [handle, handle.replace(/_+$/, ""), handle.replace(/-/g, "_")]
        .map((h) => h.toLowerCase())
        .filter((h) => h && /^[a-z0-9_-]+$/.test(h))
    )
  );
  for (const v of variants) {
    const addr = await resolveSns(v);
    if (addr) return { domain: `${v}.sol`, address: addr };
  }
  return null;
}
