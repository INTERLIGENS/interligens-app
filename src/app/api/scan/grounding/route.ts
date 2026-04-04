import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildGroundingContext } from '@/lib/ask/groundingContext'
import { generateWhyBullets, generateWhyBulletsForLaunch } from '@/lib/ask/whyBullets'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')
  const token = searchParams.get('token')
  const locale = (searchParams.get('locale') ?? 'en') as 'en' | 'fr'

  // Look up by wallet address
  if (address) {
    try {
      const wallet = await prisma.kolWallet.findFirst({
        where: { address },
        select: { kolHandle: true },
      })
      if (!wallet) return NextResponse.json({ match: false, bullets: [] })

      const ctx = await buildGroundingContext(wallet.kolHandle, locale)
      if (!ctx) return NextResponse.json({ match: false, bullets: [] })

      const bullets = generateWhyBullets(ctx)
      return NextResponse.json({
        match: true,
        handle: ctx.handle,
        bullets,
        proceedsSummary: ctx.proceedsSummary ?? null,
        evidenceDepth: ctx.evidenceDepth ?? null,
        coordinationSignalsCount: ctx.coordinationSignals.length,
        relatedActorsCount: ctx.relatedActorsCount,
        dataCoverage: ctx.dataCoverageSummary,
      })
    } catch {
      return NextResponse.json({ match: false, bullets: [] })
    }
  }

  // Look up by token symbol
  if (token) {
    try {
      const bullets = await generateWhyBulletsForLaunch(token, locale)
      return NextResponse.json({ match: bullets.length > 0, token, bullets })
    } catch {
      return NextResponse.json({ match: false, bullets: [] })
    }
  }

  return NextResponse.json({ error: 'address or token required' }, { status: 400 })
}
