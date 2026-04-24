import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { vaultLookup } from "@/lib/vault/vaultLookup";
import { NextRequest, NextResponse } from "next/server";
import { rpcCall } from "@/lib/rpc";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { computeScore } from "@/lib/scoring";
import { emitScanCompleted } from "@/lib/events/producer";

// ── Helius DAS: getAsset ─────────────────────────────────────────────────────
// Returns rich token metadata (name, symbol, website, image) from the
// Digital Asset Standard API. Fail-open: returns null if key absent or error.

interface HeliusAsset {
  content?: {
    metadata?: { name?: string; symbol?: string; description?: string };
    links?: { external_url?: string; image?: string };
    json_uri?: string;
  };
  token_info?: { symbol?: string; decimals?: number; supply?: number };
}

async function fetchTokenMetadata(mint: string): Promise<HeliusAsset | null> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "scan", method: "getAsset", params: { id: mint } }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return null;
    const j = await res.json();
    if (j.error || !j.result) return null;
    return j.result as HeliusAsset;
  } catch {
    return null;
  }
}

export type ScanResult = {
  mint: string;
  chain: "solana";
  scanned_at: string;
  off_chain: {
    status: string;
    source: "case_db" | "none";
    case_id: string | null;
    summary: string | null;
    claims: Array<{
      id: string;
      title: string;
      severity: string;
      status: string;
      description: string;
      evidence_files: string[];
      thread_url: string | null;
      category: string;
    }>;
    sources: Array<{
      source_id: string;
      filename: string | null;
      caption: string;
      type: string;
    }>;
  };
  on_chain: {
    markets: {
      source: string | null;
      primary_pool: string | null;
      dex: string | null;
      url: string | null;
      price: number | null;
      liquidity_usd: number | null;
      volume_24h_usd: number | null;
      fdv_usd: number | null;
      fetched_at: string;
      cache_hit: boolean;
    };
  };
  risk: {
    score: number;
    tier: string;
    breakdown: {
      base_score: number;
      claim_penalty: number;
      severity_multiplier: number;
    };
    flags: string[];
  };
  rpc_fallback_used?: boolean;
  rpc_down?: boolean;
  rpc_error?: string | null;
  data_source?: string;
  source_detail?: string;
  is_contract?: boolean;
};

export async function GET(request: NextRequest) {
  const _rl = await checkRateLimit(getClientIp(request), RATE_LIMIT_PRESETS.scan);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(request));

  const { searchParams } = new URL(request.url);
  const mint = searchParams.get("mint");

  if (!mint) {
    return NextResponse.json({ error: "Missing ?mint= parameter" }, { status: 400 } as any);
  }

  const mint_clean = mint.trim();
  console.log(`[scan/solana] Scanning mint=${mint_clean}`);

  // RPC: getAccountInfo to detect contract/program + populate rpc flags
  let rpcFallbackUsed = false;
  let rpcDown = false;
  let rpcError: string | null = null;
  let rpcSourceDetail: string | null = null;
  let rpcDataSource: "rpc_primary" | "rpc_fallback" | "unknown" = "unknown";
  let isProgram = false;
  try {
    const accountResult = await rpcCall("SOL", "getAccountInfo", [
      mint_clean,
      { encoding: "base64" },
    ]);
    rpcFallbackUsed = accountResult.didFallback;
    rpcSourceDetail = accountResult.provider_used;
    rpcDataSource = accountResult.didFallback ? "rpc_fallback" : "rpc_primary";
    // executable=true means it's a program
    isProgram = accountResult.result?.value?.executable === true;
  } catch (e: any) {
    rpcDown = true;
    rpcError = String(e?.message || "SOL RPC unavailable").slice(0, 120);
    rpcDataSource = "unknown";
  }

  // Fire Helius getAsset in parallel — fail-open, non-blocking
  const [caseFile, heliusAsset] = await Promise.all([
    Promise.resolve(loadCaseByMint(mint_clean)),
    fetchTokenMetadata(mint_clean),
  ]);

  const off_chain: ScanResult["off_chain"] = {
    status: "Unknown",
    source: "none",
    case_id: null,
    summary: null,
    claims: [],
    sources: [],
  };

  if (caseFile) {
    off_chain.status = caseFile.case_meta.status;
    off_chain.source = "case_db";
    off_chain.case_id = caseFile.case_meta.case_id.replace(/CASE-\d{4}-/, `CASE-${new Date().getFullYear()}-`);
    off_chain.summary = caseFile.case_meta.summary;
    off_chain.claims = caseFile.claims.map((c) => ({
      id: c.claim_id,
      title: c.title,
      severity: c.severity,
      status: c.status,
      description: c.description,
      evidence_files: caseFile.sources
        .filter((s) => c.evidence_refs.includes(s.source_id))
        .map((s) => s.filename ?? ""),
      thread_url: c.thread_url,
      category: c.category,
    }));
    off_chain.sources = caseFile.sources.map((s) => ({
      source_id: s.source_id,
      filename: s.filename,
      caption: s.caption,
      type: s.type,
    }));

    console.log(
      `[scan/solana] offchain_source=case_db case_id=${caseFile.case_meta.case_id} claims_count=${caseFile.claims.length}`
    );
  }

  const marketSnapshot = await getMarketSnapshot("solana", mint_clean);

  const on_chain: ScanResult["on_chain"] = {
    markets: {
      source: marketSnapshot.source,
      primary_pool: marketSnapshot.primary_pool,
      dex: marketSnapshot.dex,
      url: marketSnapshot.url,
      price: marketSnapshot.price,
      liquidity_usd: marketSnapshot.liquidity_usd,
      volume_24h_usd: marketSnapshot.volume_24h_usd,
      fdv_usd: marketSnapshot.fdv_usd,
      fetched_at: marketSnapshot.fetched_at,
      cache_hit: marketSnapshot.cache_hit,
    },
  };

  const rawClaims = caseFile?.claims ?? [];
  const scoring = computeScore(rawClaims);

  // ── Fetch lineage graph ──────────────────────────────────────────────────
  let scamLineage: "CONFIRMED" | "REFERENCED" | "NONE" = "NONE";
  try {
    const graphUrl = new URL(`/api/scan/solana/graph?mint=${mint_clean}`, request.url);
    const graphRes = await fetch(graphUrl.toString(), { signal: AbortSignal.timeout(8000) });
    if (graphRes.ok) {
      const graphData = await graphRes.json();
      const status = graphData?.overall_status as string | undefined;
      if (status === "CONFIRMED") scamLineage = "CONFIRMED";
      else if (status === "REFERENCED") scamLineage = "REFERENCED";
    }
  } catch { /* fail-open */ }

  const tigerScan = computeTigerScoreFromScan({
    chain: "SOL",
    is_contract: isProgram,
    rpc_fallback_used: rpcFallbackUsed,
    rpc_down: rpcDown,
    rpc_error: rpcError,
    data_source: rpcDataSource,
    source_detail: rpcSourceDetail,
    scan_type: "token",
    no_casefile: !caseFile,
    mint_address: mint_clean,
    market_url: marketSnapshot.url,
    pair_age_days: marketSnapshot.pair_age_days,
    liquidity_usd: marketSnapshot.liquidity_usd,
    fdv_usd: marketSnapshot.fdv_usd,
    volume_24h_usd: marketSnapshot.volume_24h_usd,
    scam_lineage: scamLineage,
    signals: {
      confirmedCriticalClaims: rawClaims.filter(
        (cl) => cl.severity === "CRITICAL" && (cl.status === "CONFIRMED" || (cl.status as string) === "REFERENCED")
      ).length,
      knownBadAddresses: 0,
    },
  });

  emitScanCompleted(mint_clean, "solana", tigerScan.score);

  const result: ScanResult = {
    mint: mint_clean,
    chain: "solana",
    scanned_at: new Date().toISOString(),
    off_chain,
    on_chain,
    risk: {
      score: scoring.score,
      tier: scoring.tier,
      breakdown: scoring.breakdown,
      flags: scoring.flags,
    },
    // @ts-ignore
    tiger_score: tigerScan.score,
    // @ts-ignore
    tiger_tier: tigerScan.tier,
    // @ts-ignore
    tiger_drivers: tigerScan.drivers,
    // @ts-ignore
    tiger_evidence: tigerScan.evidence,
    tiger_meta: tigerScan.meta,
    rpc_fallback_used: rpcFallbackUsed,
    rpc_down: rpcDown,
    rpc_error: rpcError,
    data_source: rpcDataSource,
    source_detail: rpcSourceDetail ?? (rpcDown ? "unavailable" : undefined),
    is_contract: isProgram,
  };

  console.log(
    `[scan/solana] DONE mint=${mint_clean} score=${scoring.score} tier=${scoring.tier} ` +
      `claims=${rawClaims.length} provider_used=${marketSnapshot.source ?? "none"} ` +
      `cache_hit=${marketSnapshot.cache_hit}`
  );

  // ── Intel Vault ──────────────────────────────────────────────────────────
  let intelVault = { match: false, categories: [] as string[], explainAvailable: false };
  try {
    const _vr = await vaultLookup("solana", mint_clean);
    intelVault = { ..._vr, explainAvailable: _vr.match };
  } catch {}

  // ── Merge Helius metadata into rawSummary-compatible shape ───────────────
  // The demo page reads websiteUrl from several paths on rawSummary.
  // We expose the most common ones so OffChainCredibilityBlock fires correctly.
  const tokenMeta = heliusAsset ? {
    name:    heliusAsset.content?.metadata?.name    ?? heliusAsset.token_info?.symbol ?? null,
    symbol:  heliusAsset.token_info?.symbol         ?? heliusAsset.content?.metadata?.symbol ?? null,
    description: heliusAsset.content?.metadata?.description ?? null,
    image:   heliusAsset.content?.links?.image      ?? null,
    // Primary website paths — demo page checks all of these
    website: heliusAsset.content?.links?.external_url ?? null,
    extensions: {
      website: heliusAsset.content?.links?.external_url ?? null,
    },
    content: {
      links: {
        external_url: heliusAsset.content?.links?.external_url ?? null,
      },
    },
  } : null;

  return NextResponse.json({ ...result, intelVault, rawSummary: tokenMeta });
}
