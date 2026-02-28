import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { computeScore } from "@/lib/scoring";
import { renderCaseFilePDF } from "@/components/pdf/pdfRenderer";
import type { ScanResult } from "@/app/api/scan/solana/route";

export async function GET(request: NextRequest) {
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
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "32px", right: "32px", bottom: "32px", left: "32px" } });
    await browser.close();
    const filename = `casefile-${mint_clean.slice(0, 8)}-${Date.now()}.pdf`;
    return new NextResponse(Buffer.from(pdfBuffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (err) {
    console.error("[pdf/casefile] Puppeteer error:", err);
    return NextResponse.json({ error: "PDF generation failed", detail: String(err) }, { status: 500 });
  }
}
