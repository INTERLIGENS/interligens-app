import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { renderKolPdf } from "@/lib/pdf/kol/templateKol"
import { renderKolPdfLegal } from "@/lib/pdf/kol/templateKolLegal"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const handle = searchParams.get("handle")
    const mode = searchParams.get("mode") ?? "retail"
    const format = searchParams.get("format") ?? "pdf"

    if (!handle) return NextResponse.json({ error: "Missing ?handle=" }, { status: 400 })

    const kol = await prisma.kolProfile.findUnique({
      where: { handle },
      include: { kolWallets: true, kolCases: true, evidences: true }
    })
    if (!kol) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const html = mode === "lawyer" ? renderKolPdfLegal(kol) : renderKolPdf(kol, mode)

    if (format === "html") {
      return new NextResponse(html, { headers: { "Content-Type": "text/html" } })
    }

    const puppeteer = await import("puppeteer-core")
    const isDev = process.env.NODE_ENV === "development"
    const chromium = await import("@sparticuz/chromium-min")

    const executablePath = isDev
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : await chromium.default.executablePath("https://pub-bbfbc08b4f584a1a91027b0ca9b696fd.r2.dev/chromium-v143.0.4-pack.x64.tar")

    const args = isDev
      ? ["--no-sandbox", "--disable-setuid-sandbox"]
      : chromium.default.args

    const browser = await puppeteer.default.launch({ executablePath, args, headless: true })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: "networkidle0" })
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      })
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="INTERLIGENS_${handle}_${mode}.pdf"`,
        },
      })
    } finally {
      await browser.close()
    }
  } catch (e: any) {
    console.error("PDF KOL error:", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
