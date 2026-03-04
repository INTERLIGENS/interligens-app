import { puppeteerSsrfGuard } from "@/lib/security/ssrfGuard";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { computeScore } from "@/lib/scoring";
import { renderHtmlV2 } from "@/lib/pdf/v2/templateV2";
import type { ScanResult } from "@/app/api/scan/solana/route";
import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { checkAuth } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  const _auth = await checkAuth(request);
  if (!_auth.authorized) return _auth.response!;
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get("mint");
  if (!mint) return NextResponse.json({ error: "Missing ?mint=" }, { status: 400 });

  const mint_clean = mint.trim();
  const lang = searchParams.get("lang") ?? "en";
  const debug = searchParams.get("debug") === "1";

  // ── Build scan result (same logic as /api/pdf/casefile) ──
  const caseFile = loadCaseByMint(mint_clean);
  const marketSnapshot = await getMarketSnapshot("solana", mint_clean, debug);
  if (debug) console.log(`[route/v2] market snapshot: data_unavailable=${marketSnapshot.data_unavailable} source=${marketSnapshot.source} price=${marketSnapshot.price} liquidity=${marketSnapshot.liquidity_usd} reason=${marketSnapshot.reason ?? "none"}`);
  const scoring = computeScore(caseFile?.claims ?? []);

  // ── Tiger score booster pour token sans casefile ──
  const { computeTigerScoreFromScan } = await import("@/lib/tigerscore/adapter");
  const tigerBoost = computeTigerScoreFromScan({
    chain: "SOL",
    scan_type: "token",
    no_casefile: !caseFile,
    mint_address: mint_clean,
    market_url: marketSnapshot.url,
    // @ts-ignore
        pair_age_days: marketSnapshot.pair_age_days,
    liquidity_usd: marketSnapshot.liquidity_usd,
    fdv_usd: marketSnapshot.fdv_usd,
    volume_24h_usd: marketSnapshot.volume_24h_usd,
    signals: {
      confirmedCriticalClaims: (caseFile?.claims ?? []).filter(
        (cl) => cl.severity === "CRITICAL" && (cl.status === "CONFIRMED" || (cl.status as string) === "REFERENCED")
      ).length,
    },
  });
  // Utiliser le score le plus élevé entre scoring (claims) et tigerBoost (market)
  const finalScore = Math.max(scoring.score, tigerBoost.score);
  const finalTier  = finalScore >= 70 ? "RED" : finalScore >= 40 ? "AMBER" : "GREEN";

  const scanResult: ScanResult = {
    mint: mint_clean,
    chain: "solana",
    scanned_at: new Date().toISOString(),
    off_chain: {
      status: caseFile?.case_meta.status ?? "Unknown",
      source: caseFile ? "case_db" : "none",
      case_id: caseFile?.case_meta.case_id ?? null,
      summary: caseFile?.case_meta.summary ?? null,
      claims: (caseFile?.claims ?? []).map((c) => ({
        id: c.claim_id,
        title: c.title,
        severity: c.severity,
        status: c.status,
        description: c.description,
        evidence_files: (caseFile?.sources ?? [])
          .filter((s) => c.evidence_refs.includes(s.source_id))
          .map((s) => s.filename ?? ""),
        thread_url: c.thread_url,
        category: c.category,
      })),
      sources: (caseFile?.sources ?? []).map((s) => ({
        source_id: s.source_id,
        filename: s.filename,
        caption: s.caption,
        type: s.type,
      })),
    },
    on_chain: {
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
        // @ts-ignore
        pair_age_days: marketSnapshot.pair_age_days,
        // @ts-ignore
        data_unavailable: marketSnapshot.data_unavailable,
        // @ts-ignore
        reason: marketSnapshot.reason ?? null,
      },
    },
    risk: {
      score: finalScore,
      tier: finalTier,
      breakdown: scoring.breakdown,
      flags: [...scoring.flags, ...(tigerBoost.drivers.map(d => d.id))],
    },
    tiger_drivers: tigerBoost.drivers,
  };

  // ── Render HTML ──
  // Attach detective_trade from caseFile
  (scanResult as any).detective_trade = caseFile?.detective_trade ?? null;
  const html = renderHtmlV2(scanResult, lang);

  // ── Puppeteer → PDF ──
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", puppeteerSsrfGuard);

    await page.setContent(html, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="interligens-v2-${mint_clean.slice(0, 8)}-${lang}.pdf"`,
      },
    });
  } finally {
    await browser?.close();
  }
}
