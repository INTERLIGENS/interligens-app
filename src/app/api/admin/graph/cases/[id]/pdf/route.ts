import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi as requireAdmin } from '@/lib/security/adminAuth'
import { prisma } from '@/lib/prisma'
import { renderGraphPDF } from '@/lib/pdf/graph/templateGraph'
import { createHash } from 'crypto'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const { id } = await context.params
    const lang = new URL(req.url).searchParams.get('lang') ?? 'en'

    const graphCase = await prisma.graphCase.findUnique({
      where: { id },
      include: { nodes: true, edges: true }
    })
    if (!graphCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const payload = JSON.stringify({ nodes: graphCase.nodes, edges: graphCase.edges, generated: new Date().toISOString() })
    const sha256 = createHash('sha256').update(payload).digest('hex')

    const html = renderGraphPDF(graphCase, lang, sha256)

    const isDev = process.env.NODE_ENV === 'development'
    const browser = await puppeteer.launch(isDev ? {
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    } : {
      headless: true,
      executablePath: await chromium.executablePath(
        'https://pub-bbfbc08b4f584a1a91027b0ca9b696fd.r2.dev/chromium-v143.0.4-pack.x64.tar'
      ),
      args: chromium.args,
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    })
    await browser.close()

    const filename = `INTERLIGENS_GraphReport_${graphCase.title.replace(/\s+/g, '_')}_${lang.toUpperCase()}.pdf`

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-SHA256': sha256,
      }
    })
  } catch (e: any) {
    console.error('[GRAPH PDF]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
