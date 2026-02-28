import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { renderCaseFilePDF } from "@/components/pdf/pdfRenderer";

export const runtime = "nodejs";

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mint = (searchParams.get("mint") || "").trim();
  if (!mint) return NextResponse.json({ error: "Missing ?mint=" }, { status: 400 });

  const baseUrl = getBaseUrl(req);
  const scanUrl = `${baseUrl}/api/scan/solana?mint=${encodeURIComponent(mint)}`;
  console.log("[REPORT]", { mint, scanUrl });

  const r = await fetch(scanUrl, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: "scan_failed", status: r.status }, { status: 500 });

  const casefile = await r.json();
  console.log("[REPORT_OFFCHAIN]", { source: casefile?.off_chain?.source, claims: casefile?.off_chain?.claims?.length ?? 0 });

  const html = renderCaseFilePDF(casefile);

  try {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "32px", right: "32px", bottom: "32px", left: "32px" } });
    await browser.close();
    const filename = `casefile-${mint.slice(0, 8)}-${Date.now()}.pdf`;
    return new NextResponse(pdfBuffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (err) {
    console.error("[report/casefile] Puppeteer error:", err);
    return NextResponse.json({ error: "PDF generation failed", detail: String(err) }, { status: 500 });
  }
}
