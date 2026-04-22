import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'
import { RwaIssuerType, RwaIssuerStatus } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const { id } = await params
  const issuer = await prisma.rwaIssuer.findUnique({
    where: { id },
    include: {
      assets: {
        orderBy: { symbol: 'asc' },
        include: { _count: { select: { contracts: true } } },
      },
      aliases: true,
      sources: { orderBy: { capturedAt: 'desc' } },
    },
  })
  if (!issuer) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({
    issuer: {
      ...issuer,
      assets: issuer.assets.map((a) => ({
        ...a,
        contractCount: a._count.contracts,
      })),
    },
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const { id } = await params
  const body = (await req.json()) as Record<string, unknown>

  const data: Record<string, unknown> = {}
  if (typeof body.displayName === 'string') data.displayName = body.displayName
  if (typeof body.slug === 'string') data.slug = body.slug
  if (typeof body.legalEntityName === 'string')
    data.legalEntityName = body.legalEntityName || null
  if (typeof body.jurisdictionCode === 'string')
    data.jurisdictionCode = body.jurisdictionCode || null
  if (typeof body.regulatoryStatus === 'string')
    data.regulatoryStatus = body.regulatoryStatus || null
  if (typeof body.websiteUrl === 'string')
    data.websiteUrl = body.websiteUrl || null
  if (typeof body.riskNotesInternal === 'string')
    data.riskNotesInternal = body.riskNotesInternal || null
  if (typeof body.issuerType === 'string' && body.issuerType in RwaIssuerType) {
    data.issuerType = body.issuerType as RwaIssuerType
  }
  if (typeof body.status === 'string' && body.status in RwaIssuerStatus) {
    data.status = body.status as RwaIssuerStatus
  }

  try {
    const issuer = await prisma.rwaIssuer.update({ where: { id }, data })
    return NextResponse.json({ issuer })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
