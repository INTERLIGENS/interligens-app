import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { renderKolPdf } from "@/lib/pdf/kol/templateKol"
import { renderKolPdfLegal } from "@/lib/pdf/kol/templateKolLegal"
import { checkAuth } from "@/lib/security/auth"

export async function GET(request: NextRequest) {
  // P0 SEC: gate the KOL dossier PDF behind ADMIN_TOKEN. Same pattern as
  // /api/pdf/casefile — token via Authorization: Bearer, x-admin-token
  // header, or ?token=. Missing/invalid → 401.
  const auth = await checkAuth(request)
  if (!auth.authorized) return auth.response!

  try {
    const { searchParams } = new URL(request.url)
    const handle = searchParams.get("handle")
    const mode = searchParams.get("mode") ?? "retail"
    const format = searchParams.get("format") ?? "pdf"
    const lang = searchParams.get("lang") ?? "en"

    if (!handle) return NextResponse.json({ error: "Missing ?handle=" }, { status: 400 })

    const kol = await prisma.kolProfile.findUnique({
      where: { handle },
      include: { kolWallets: true, kolCases: true, evidences: true }
    })
    if (!kol) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Build cashout evidence from KolProceedsEvent if no onchain_cashout in KolEvidence
    const hasCashoutEvidence = kol.evidences.some((e: any) => e.type === "onchain_cashout")
    if (!hasCashoutEvidence) {
      const cashoutRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT
          pe."walletAddress",
          pe."tokenSymbol",
          SUM(pe."amountUsd")::float as "totalUsd",
          COUNT(*)::int as "txCount",
          MIN(pe."eventDate") as "dateFirst",
          MAX(pe."eventDate") as "dateLast",
          (array_agg(pe."txHash" ORDER BY pe."amountUsd" DESC))[1] as "sampleTx"
        FROM "KolProceedsEvent" pe
        WHERE pe."kolHandle" = $1
        GROUP BY pe."walletAddress", pe."tokenSymbol"
        ORDER BY "totalUsd" DESC
      `, handle)

      for (const row of cashoutRows) {
        const wallet = kol.kolWallets.find((w: any) => w.address === row.walletAddress)
        kol.evidences.push({
          id: `proceeds-${row.walletAddress}-${row.tokenSymbol}`,
          type: "onchain_cashout",
          label: wallet?.label ?? row.walletAddress.slice(0, 12) + "...",
          wallets: JSON.stringify([row.walletAddress]),
          token: row.tokenSymbol,
          amountUsd: row.totalUsd,
          txCount: row.txCount,
          dateFirst: row.dateFirst,
          dateLast: row.dateLast,
          sampleTx: row.sampleTx,
          description: null,
          kolHandle: handle,
          createdAt: new Date(),
        } as any)
      }
    }

    // Deduplicate evidence by (type, label) — guard against seed re-runs
    const seenKeys = new Set<string>()
    kol.evidences = kol.evidences.filter((e: any) => {
      const key = `${e.type}|${e.label}`
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

    const laundryTrail = await prisma.laundryTrail.findFirst({
      where: { kolHandle: handle },
      include: { signals: true },
      orderBy: { createdAt: "desc" },
    })

    const html = mode === "lawyer" ? renderKolPdfLegal(kol) : renderKolPdf(kol, mode, laundryTrail, lang)

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
