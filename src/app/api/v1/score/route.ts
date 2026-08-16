import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/publicScore/rateLimit";

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
import {
  isValidMint,
  isValidEvmAddress,
  mapSeverity,
  derivePhantomWarning,
  type PublicScoreResponse,
  type PublicSignal,
} from "@/lib/publicScore/schema";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";
import { computeTigerScoreWithIntel } from "@/lib/tigerscore/engine";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { isKnownBadEvm } from "@/lib/entities/knownBad";
import { prisma } from "@/lib/prisma";
import { fetchTop10HolderPct } from "@/lib/token/holderConcentration";

async function upsertScanAggregate(mint: string): Promise<number | null> {
  try {
    const row = await prisma.tokenScanAggregate.upsert({
      where: { mint },
      create: { mint, scanCount: 1 },
      update: { scanCount: { increment: 1 }, lastScannedAt: new Date() },
    });
    return row.scanCount;
  } catch {
    return null;
  }
}

// La lecture de la concentration vit desormais dans
// src/lib/token/holderConcentration.ts. L'implementation qui etait ici
// interrogeait public-api.solscan.io, mort (HTTP 404 verifie le 2026-08-16),
// et rendait `null` sans un log — ce qui faisait disparaitre les signaux de
// concentration au lieu de signaler qu'on ne savait pas.

async function fetchMintFreeze(mint: string): Promise<{ mintAuthority: boolean | null; freezeAuthority: boolean | null }> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return { mintAuthority: null, freezeAuthority: null };
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "mf", method: "getParsedAccountInfo", params: [mint, { encoding: "jsonParsed" }] }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return { mintAuthority: null, freezeAuthority: null };
    const j = await res.json();
    const info = j.result?.value?.data?.parsed?.info as { mintAuthority?: string | null; freezeAuthority?: string | null } | undefined;
    if (!info) return { mintAuthority: null, freezeAuthority: null };
    return {
      mintAuthority: info.mintAuthority != null ? true : false,
      freezeAuthority: info.freezeAuthority != null ? true : false,
    };
  } catch {
    return { mintAuthority: null, freezeAuthority: null };
  }
}

async function fetchTokenWebsite(mint: string): Promise<string | null> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "v1", method: "getAsset", params: { id: mint } }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return (j.result?.content?.links?.external_url as string) ?? null;
  } catch {
    return null;
  }
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function corsHeaders(rl: { remaining: number }) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-RateLimit-Limit": "60",
    "X-RateLimit-Remaining": String(rl.remaining),
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", retry_after: 60 },
      { status: 429, headers: corsHeaders(rl) }
    );
  }

  const { searchParams } = new URL(request.url);
  const mintRaw = searchParams.get("mint");
  const target = mintRaw?.trim() ?? "";

  if (!target || (!isValidMint(target) && !isValidEvmAddress(target))) {
    return NextResponse.json(
      {
        error: "invalid_mint",
        message:
          "Expected a valid Solana base58 address (32-44 chars) or an EVM 0x address (42 chars)",
      },
      { status: 400, headers: corsHeaders(rl) }
    );
  }

  const isEvm = isValidEvmAddress(target);

  // ── EVM path (ETH / Base / Arbitrum — single TigerScore, no market/graph) ──
  if (isEvm) {
    try {
      const normalized = target.toLowerCase();
      const knownBad = isKnownBadEvm(normalized);

      const intel = await computeTigerScoreWithIntel(
        {
          chain: "ETH",
          evm_known_bad: knownBad !== null,
          evm_is_contract: false,
        },
        normalized
      );

      const finalScore = intel.finalScore;
      const finalVerdict = finalScore >= 70 ? "RED" : finalScore >= 35 ? "ORANGE" : "GREEN";

      const signals: PublicSignal[] = intel.drivers.map((d) => ({
        id: d.id,
        label: d.label,
        severity: mapSeverity(d.severity),
        value: d.delta,
      }));

      const sources: string[] = [];
      if (knownBad) sources.push("INTERLIGENS KnownBad");
      if (intel.intelligence) {
        for (const s of intel.intelligence.contributingSources) {
          if (!sources.includes(s)) sources.push(s);
        }
      }

      const phantom = derivePhantomWarning(finalVerdict);

      const communityScans = await upsertScanAggregate(normalized);

      const response: PublicScoreResponse = {
        mint: normalized,
        symbol: knownBad?.label,
        score: finalScore,
        verdict: finalVerdict,
        phantom_warning_level: phantom.level,
        phantom_disclaimer: phantom.disclaimer,
        signals,
        sources,
        cached: false,
        timestamp: new Date().toISOString(),
        api_version: "v1",
        communityScans,
      };

      console.log(
        `[api/v1/score] evm=${normalized} score=${finalScore} verdict=${finalVerdict} ` +
          `signals=${signals.length} sources=${sources.join(",")}`
      );

      return NextResponse.json(response, { status: 200, headers: corsHeaders(rl) });
    } catch (err) {
      console.error("[api/v1/score] EVM path error:", err);
      return NextResponse.json(
        { error: "internal_error", message: "An unexpected error occurred" },
        { status: 500, headers: corsHeaders(rl) }
      );
    }
  }

  // ── SOL path (unchanged) ──────────────────────────────────────────────
  const mint = target;

  try {
    // 1. Check case DB for existing off-chain data
    const caseFile = loadCaseByMint(mint);

    // 2. Fetch market snapshot, token website, top holders, and mint/freeze in parallel
    const [market, website, holders, mintFreeze] = await Promise.all([
      getMarketSnapshot("solana", mint),
      fetchTokenWebsite(mint),
      fetchTop10HolderPct(mint),
      fetchMintFreeze(mint),
    ]);

    // 3. Determine scam lineage (fail-open)
    let scamLineage: "CONFIRMED" | "REFERENCED" | "NONE" = "NONE";
    try {
      const graphUrl = new URL(`/api/scan/solana/graph?mint=${mint}`, request.url);
      const graphRes = await fetch(graphUrl.toString(), { cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (graphRes.ok) {
        const graphData = await graphRes.json();
        const status = graphData?.overall_status as string | undefined;
        if (status === "CONFIRMED") scamLineage = "CONFIRMED";
        else if (status === "REFERENCED") scamLineage = "REFERENCED";
      }
    } catch { /* fail-open */ }

    // 4. Compute TigerScore via adapter
    //
    // `holders.available === false` n'est PAS `top10_holder_pct = 0`. On passe
    // `holders_unavailable` pour que le moteur sache que la concentration n'a
    // pas pu etre evaluee : la confiance tombe a « Low » et `dataQuality.missing`
    // nomme la source. Sans ce drapeau, un token dont le top 10 detient 95 % du
    // supply serait note comme un token distribue.
    const topHolderPct = holders.available ? holders.top10Pct : null;
    const rawClaims = caseFile?.claims ?? [];
    const tigerScan = computeTigerScoreFromScan({
      chain: "SOL",
      scan_type: "token",
      no_casefile: !caseFile,
      mint_address: mint,
      market_url: market.url,
      pair_age_days: market.pair_age_days,
      liquidity_usd: market.liquidity_usd,
      fdv_usd: market.fdv_usd,
      volume_24h_usd: market.volume_24h_usd,
      top10_holder_pct: topHolderPct,
      holders_unavailable: !holders.available,
      scam_lineage: scamLineage,
      signals: {
        confirmedCriticalClaims: rawClaims.filter(
          (cl) =>
            cl.severity === "CRITICAL" &&
            (cl.status === "CONFIRMED" || cl.status === "DISPUTED")
        ).length,
        knownBadAddresses: 0,
      },
    });

    // 5. Apply intelligence overlay
    const intel = await computeTigerScoreWithIntel(
      {
        chain: "SOL",
        scan_type: "token",
        no_casefile: !caseFile,
        mint_address: mint,
      },
      mint
    );

    const finalScore = Math.max(tigerScan.score, intel.finalScore);
    const finalVerdict = finalScore >= 70 ? "RED" : finalScore >= 35 ? "ORANGE" : "GREEN";

    // 6. Build signals array
    const allDrivers = [...tigerScan.drivers];
    if (intel.intelligence && intel.finalScore !== intel.score) {
      const intelDriver = intel.drivers.find((d) => d.id === "intelligence_overlay");
      if (intelDriver && !allDrivers.find((d) => d.id === "intelligence_overlay")) {
        allDrivers.push(intelDriver);
      }
    }

    const signals: PublicSignal[] = allDrivers.map((d) => ({
      id: d.id,
      label: d.label,
      severity: mapSeverity(d.severity),
      value: d.delta,
    }));

    // 7. Collect sources
    const sources: string[] = [];
    if (market.source === "dexscreener") sources.push("DexScreener");
    if (market.source === "geckoterminal") sources.push("GeckoTerminal");
    if (caseFile) sources.push("INTERLIGENS CaseDB");
    if (intel.intelligence) {
      for (const s of intel.intelligence.contributingSources) {
        if (!sources.includes(s)) sources.push(s);
      }
    }
    if (scamLineage !== "NONE") sources.push("Lineage Graph");

    const phantom = derivePhantomWarning(finalVerdict);

    const communityScans = await upsertScanAggregate(mint);

    const response: PublicScoreResponse = {
      mint,
      symbol: caseFile?.case_meta.ticker,
      name: caseFile?.case_meta.token_name,
      score: finalScore,
      verdict: finalVerdict,
      phantom_warning_level: phantom.level,
      phantom_disclaimer: phantom.disclaimer,
      signals,
      sources,
      cached: market.cache_hit,
      timestamp: new Date().toISOString(),
      api_version: "v1",
      website: website ?? null,
      pairAgeDays: market.pair_age_days ?? null,
      liquidityUsd: market.liquidity_usd ?? null,
      topHolderPct,
      // Le client doit pouvoir distinguer « concentration faible » de
      // « concentration inconnue ». `null` seul ne le permettait pas.
      topHolderSource: holders.available ? holders.source : null,
      topHolderUnavailableReason: holders.available ? null : holders.reason,
      mintAuthority: mintFreeze.mintAuthority,
      freezeAuthority: mintFreeze.freezeAuthority,
      communityScans,
    };

    console.log(
      `[api/v1/score] mint=${mint} score=${finalScore} verdict=${finalVerdict} ` +
        `signals=${signals.length} sources=${sources.join(",")}`
    );

    return NextResponse.json(response, { status: 200, headers: corsHeaders(rl) });
  } catch (err) {
    console.error("[api/v1/score] Internal error:", err);
    return NextResponse.json(
      { error: "internal_error", message: "An unexpected error occurred" },
      { status: 500, headers: corsHeaders(rl) }
    );
  }
}
