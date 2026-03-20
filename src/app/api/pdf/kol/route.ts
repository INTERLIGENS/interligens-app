import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { renderKolPdf } from "@/lib/pdf/kol/templateKol"

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

    const html = renderKolPdf(kol, mode)

    if (format === "html") {
      return new NextResponse(html, { headers: { "Content-Type": "text/html" } })
    }

    const puppeteer = await import("puppeteer-core")
    const isDev = process.env.NODE_ENV === "development"

    let executablePath: string
    let args: string[]

    if (isDev) {
      // Local Mac — utilise Chrome installé
      executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      args = ["--no-sandbox", "--disable-setuid-sandbox"]
    } else {
      const chromium = await import("@sparticuz/chromium-min")
      executablePath = await chromium.default.executablePath(
        process.env.CHROMIUM_REMOTE_EXEC_PATH!
      )
      args = chromium.default.args
    }

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
