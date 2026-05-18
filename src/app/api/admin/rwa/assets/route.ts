import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'
import { RwaAssetClass } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const { searchParams } = new URL(req.url)
  const issuerId = searchParams.get('issuerId')?.trim() || undefined

  const assets = await prisma.rwaAsset.findMany({
    where: issuerId ? { issuerId } : undefined,
    orderBy: [{ issuerId: 'asc' }, { symbol: 'asc' }],
    include: {
      issuer: { select: { id: true, slug: true, displayName: true } },
      _count: { select: { contracts: true } },
    },
  })
  return NextResponse.json({
    assets: assets.map((a) => ({ ...a, contractCount: a._count.contracts })),
  })
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  try {
    const body = (await req.json()) as Record<string, unknown>
    const issuerId = String(body.issuerId ?? '').trim()
    const symbol = String(body.symbol ?? '').trim()
    const name = String(body.name ?? '').trim()
    const assetClassRaw = String(body.assetClass ?? '')

    if (!issuerId || !symbol || !name || !assetClassRaw) {
      return NextResponse.json(
        { error: 'issuerId, symbol, name, assetClass required' },
        { status: 400 },
      )
    }
    if (!(assetClassRaw in RwaAssetClass)) {
      return NextResponse.json({ error: 'invalid assetClass' }, { status: 400 })
    }

    const asset = await prisma.rwaAsset.create({
      data: {
        issuerId,
        symbol,
        name,
        assetClass: assetClassRaw as RwaAssetClass,
        underlyingReference:
          (body.underlyingReference as string | undefined) || null,
        isinOrEquivalent: (body.isinOrEquivalent as string | undefined) || null,
        cusipOrEquivalent: (body.cusipOrEquivalent as string | undefined) || null,
        officialProductUrl:
          (body.officialProductUrl as string | undefined) || null,
        isActive: body.isActive === false ? false : true,
      },
    })
    return NextResponse.json({ asset }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unique'))
      return NextResponse.json(
        { error: 'symbol already exists for this issuer' },
        { status: 409 },
      )
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
