import { puppeteerSsrfGuard } from "@/lib/security/ssrfGuard";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { renderCaseFilePDF } from "@/components/pdf/pdfRenderer";
import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { checkAuth } from "@/lib/security/auth";

export const runtime = "nodejs";

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const _auth = await checkAuth(req);
  if (!_auth.authorized) return _auth.response!;
  const { searchParams } = new URL(req.url);
  const mint = (searchParams.get("mint") || "").trim();
  const lang = searchParams.get("lang") ?? "en";
  if (!mint) return NextResponse.json({ error: "Missing ?mint=" }, { status: 400 });

  const baseUrl = getBaseUrl(req);
  const scanUrl = `${baseUrl}/api/scan/solana?mint=${encodeURIComponent(mint)}`;
  console.log("[REPORT]", { mint, scanUrl });

  const r = await fetch(scanUrl, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: "scan_failed", status: r.status }, { status: 500 });

  const casefile = await r.json();
  console.log("[REPORT_OFFCHAIN]", { source: casefile?.off_chain?.source, claims: casefile?.off_chain?.claims?.length ?? 0 });

  // Enrich with FR translations
  if (lang === "fr") {
    try {
      const botifyRaw = require("../../../../../data/cases/botify.json");
      if (botifyRaw.case_meta?.summary_fr) {
        casefile.off_chain.summary = botifyRaw.case_meta.summary_fr;
      }
      (casefile as any)._raw_claims = botifyRaw.claims ?? [];
      casefile.off_chain.claims = casefile.off_chain.claims.map((c: any) => {
        const raw = botifyRaw.claims?.find((r: any) => r.claim_id === c.id);
        return {
          ...c,
          title: raw?.title_fr ?? c.title,
          status: c.status === "REFERENCED" ? "RÉFÉRENCÉ" : c.status,
        };
      });
      casefile.off_chain.status = casefile.off_chain.status === "Referenced" ? "Référencé" : casefile.off_chain.status;
      // Fix descriptions: remove unproven on-chain assertions
      casefile.off_chain.claims = casefile.off_chain.claims.map((c: any) => {
        const raw = botifyRaw.claims?.find((r: any) => r.claim_id === c.id);
        return { ...c, description: raw?.description_fr ?? c.description };
      });
    } catch(e) { console.error("[i18n] FR enrichment failed", e); }
  }

  // Fix 4: inject market data from scan if missing
  if (!casefile.on_chain?.markets?.source) {
    try {
      const host = req.headers.get("host");
      const proto = req.headers.get("x-forwarded-proto") ?? "http";
      const scanUrl = `${proto}://${host}/api/scan/solana?mint=${encodeURIComponent(mint)}`;
      const scanRes = await fetch(scanUrl, { cache: "no-store" });
      if (scanRes.ok) {
        const scanData = await scanRes.json();
        if (scanData?.on_chain?.markets?.source) {
          casefile.on_chain = scanData.on_chain;
        }
      }
    } catch(e) { console.error("[market] injection failed", e); }
  }

  const html = renderCaseFilePDF(casefile, lang);

  try {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", puppeteerSsrfGuard);

    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "32px", right: "32px", bottom: "32px", left: "32px" } });
    await browser.close();
    const filename = `casefile-${mint.slice(0, 8)}-${Date.now()}.pdf`;
    return new NextResponse(Buffer.from(pdfBuffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache" } });
  } catch (err) {
    console.error("[report/casefile] Puppeteer error:", err);
    return NextResponse.json({ error: "PDF generation failed", detail: String(err) }, { status: 500 });
  }
}
