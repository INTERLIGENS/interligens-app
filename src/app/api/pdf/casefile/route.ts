import { puppeteerSsrfGuard } from "@/lib/security/ssrfGuard";
import { checkAuth } from "@/lib/security/auth";
import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { computeScore } from "@/lib/scoring";
import { renderCaseFilePDF } from "@/components/pdf/pdfRenderer";
import type { ScanResult } from "@/app/api/scan/solana/route";
import { uploadPdf, isStorageEnabled } from "@/lib/storage/pdfStorage";

export async function GET(request: NextRequest) {
  const _auth = await checkAuth(request);
  if (!_auth.authorized) return _auth.response!;
  const _rl = await checkRateLimit(getClientIp(request), RATE_LIMIT_PRESETS.pdf);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(request));

  const { searchParams } = new URL(request.url);
  const mint = searchParams.get("mint");
  if (!mint) return NextResponse.json({ error: "Missing ?mint=" }, { status: 400 });

  const mint_clean = mint.trim();
  const lang = searchParams.get("lang") ?? "en";
  const caseFile = loadCaseByMint(mint_clean);
  const marketSnapshot = await getMarketSnapshot("solana", mint_clean);
  const scoring = computeScore(caseFile?.claims ?? []);

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
        id: c.claim_id, title: c.title, severity: c.severity, status: c.status,
        description: c.description,
        evidence_files: (caseFile?.sources ?? []).filter((s) => c.evidence_refs.includes(s.source_id)).map((s) => s.filename ?? ""),
        thread_url: c.thread_url, category: c.category,
      })),
      sources: (caseFile?.sources ?? []).map((s) => ({ source_id: s.source_id, filename: s.filename, caption: s.caption, type: s.type })),
    },
    on_chain: { markets: { source: marketSnapshot.source, primary_pool: marketSnapshot.primary_pool, dex: marketSnapshot.dex, url: marketSnapshot.url, price: marketSnapshot.price, liquidity_usd: marketSnapshot.liquidity_usd, volume_24h_usd: marketSnapshot.volume_24h_usd, fdv_usd: marketSnapshot.fdv_usd, fetched_at: marketSnapshot.fetched_at, cache_hit: marketSnapshot.cache_hit } },
    risk: { score: scoring.score, tier: scoring.tier, breakdown: scoring.breakdown, flags: scoring.flags },
  };

  const html = renderCaseFilePDF(scanResult, lang);

  try {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", puppeteerSsrfGuard);

    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "32px", right: "32px", bottom: "32px", left: "32px" } });
    await browser.close();

    const pdfBuf = Buffer.from(pdfBuffer);
    const filename = `casefile-${mint_clean.slice(0, 8)}-${Date.now()}.pdf`;

    // ── Storage R2 (non-bloquant) ────────────────────────────────
    if (isStorageEnabled()) {
      const upload = await uploadPdf({ buffer: pdfBuf, subject: mint_clean, batchId: "casefile" });
      if (upload) {
        return NextResponse.json({
          status: "stored",
          signedUrl: upload.signedUrl,
          key: upload.key,
          sha256: upload.sha256,
          sizeBytes: upload.sizeBytes,
          expiresInSeconds: parseInt(process.env.PDF_SIGNED_URL_TTL_SECONDS ?? "900", 10),
        });
      }
      // upload === null : R2 down → fallback stream direct
      console.warn("[pdf/casefile] R2 upload failed, falling back to stream", { mint: mint_clean });
    }

    // Fallback / storage OFF : stream direct (comportement original)
    return new NextResponse(pdfBuf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/casefile] Puppeteer error:", err);
    return NextResponse.json({ error: "PDF generation failed", detail: String(err) }, { status: 500 });
  }
}
