import { NextRequest, NextResponse } from "next/server";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { computeScore } from "@/lib/scoring";

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
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get("mint");

  if (!mint) {
    return NextResponse.json({ error: "Missing ?mint= parameter" }, { status: 400 });
  }

  const mint_clean = mint.trim();
  console.log(`[scan/solana] Scanning mint=${mint_clean}`);

  const caseFile = loadCaseByMint(mint_clean);

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
  };

  console.log(
    `[scan/solana] DONE mint=${mint_clean} score=${scoring.score} tier=${scoring.tier} ` +
      `claims=${rawClaims.length} provider_used=${marketSnapshot.source ?? "none"} ` +
      `cache_hit=${marketSnapshot.cache_hit}`
  );

  return NextResponse.json(result);
}
