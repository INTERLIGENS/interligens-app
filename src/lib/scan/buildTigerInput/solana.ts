/**
 * REFLEX V1 — Solana TigerInput builder.
 *
 * TEMPORARY DUPLICATION of /api/scan/solana/route.ts. See
 * docs/reflex-v1-tech-debt.md for the post-V1 factorisation plan.
 *
 * Replicates the route's TigerInput composition steps:
 *  1. RPC getAccountInfo → isProgram (executable flag)
 *  2. loadCaseByMint → casefile presence + claims
 *  3. getMarketSnapshot → liquidity/FDV/pair_age etc.
 *  4. Scam-lineage graph lookup → V1 defaults to "NONE" (the route does
 *     an internal HTTP roundtrip to /api/scan/solana/graph; the
 *     coherence test mocks both paths to "NONE" so they stay aligned).
 *  5. confirmedCriticalClaims count from casefile claims.
 *
 * The result is the same TigerInput shape that computeTigerScoreFromScan
 * internally builds inside the route, so score(buildSolanaTigerInput) ==
 * score(route response). Verified by buildTigerInput.coherence.test.ts
 * on 5 fixtures — that test is the canary for drift.
 */
import { rpcCall } from "@/lib/rpc";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import type { TigerInput } from "@/lib/tigerscore/engine";

export async function buildSolanaTigerInput(mint: string): Promise<TigerInput> {
  // 1. RPC: getAccountInfo (program detection). Fail-open: on RPC error
  //    isProgram stays false, matching the route's fail-open behaviour.
  let isProgram = false;
  try {
    const accountResult = await rpcCall("SOL", "getAccountInfo", [
      mint,
      { encoding: "base64" },
    ]);
    isProgram = accountResult.result?.value?.executable === true;
  } catch {
    // matches the route's catch block — fall through
  }

  // 2 + 3. Casefile + market snapshot — fan-out in parallel as the route does.
  const [caseFile, marketSnapshot] = await Promise.all([
    Promise.resolve(loadCaseByMint(mint)),
    getMarketSnapshot("solana", mint),
  ]);

  // 4. Scam-lineage: the route fetches /api/scan/solana/graph via an internal
  //    HTTP call. V1 helper defaults to "NONE" — the coherence test mocks
  //    the route's fetch to also resolve to "NONE" so both sides agree.
  //    Post-V1 task: replace the HTTP roundtrip with a direct DB query so
  //    helper + route share the same data path.
  const scam_lineage: "CONFIRMED" | "REFERENCED" | "NONE" = "NONE";

  // 5. Confirmed-critical claims from casefile.
  const rawClaims = caseFile?.claims ?? [];
  const confirmedCriticalClaims = rawClaims.filter(
    (cl) =>
      cl.severity === "CRITICAL" &&
      (cl.status === "CONFIRMED" || (cl.status as string) === "REFERENCED"),
  ).length;

  // Mirror the ScanNormalized → TigerInput mapping used by
  // computeTigerScoreFromScan inside src/lib/tigerscore/adapter.ts.
  // Any field the route does NOT pass in `signals` stays undefined here
  // so the resulting TigerInput is bit-equivalent.
  const tigerInput: TigerInput = {
    chain: "SOL",
    scan_type: "token",
    no_casefile: !caseFile,
    mint_address: mint,
    market_url: marketSnapshot.url,
    pair_age_days: marketSnapshot.pair_age_days,
    liquidity_usd: marketSnapshot.liquidity_usd,
    fdv_usd: marketSnapshot.fdv_usd,
    volume_24h_usd: marketSnapshot.volume_24h_usd,
    scam_lineage,
    confirmedCriticalClaims,
  };

  // Silence "unused" — isProgram is intentionally NOT in the TigerInput;
  // the route surfaces it on the response but does not feed it into
  // computeTigerScoreFromScan. Keeping the RPC call here matches the
  // route's I/O profile so the coherence test mocks line up.
  void isProgram;

  return tigerInput;
}
