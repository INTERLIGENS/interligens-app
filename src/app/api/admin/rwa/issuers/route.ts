import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'
import { RwaIssuerType, RwaIssuerStatus } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const issuers = await prisma.rwaIssuer.findMany({
    orderBy: { displayName: 'asc' },
    include: { _count: { select: { assets: true } } },
  })
  return NextResponse.json({
    issuers: issuers.map((i) => ({ ...i, assetCount: i._count.assets })),
  })
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  try {
    const body = (await req.json()) as Record<string, unknown>
    const slug = String(body.slug ?? '').trim()
    const displayName = String(body.displayName ?? '').trim()
    const issuerTypeRaw = String(body.issuerType ?? '')
    if (!slug || !displayName || !issuerTypeRaw) {
      return NextResponse.json(
        { error: 'slug, displayName, issuerType required' },
        { status: 400 },
      )
    }
    if (!(issuerTypeRaw in RwaIssuerType)) {
      return NextResponse.json({ error: 'invalid issuerType' }, { status: 400 })
    }

    const issuer = await prisma.rwaIssuer.create({
      data: {
        slug,
        displayName,
        issuerType: issuerTypeRaw as RwaIssuerType,
        legalEntityName: (body.legalEntityName as string | undefined) || null,
        jurisdictionCode: (body.jurisdictionCode as string | undefined) || null,
        regulatoryStatus: (body.regulatoryStatus as string | undefined) || null,
        websiteUrl: (body.websiteUrl as string | undefined) || null,
        riskNotesInternal:
          (body.riskNotesInternal as string | undefined) || null,
        status: RwaIssuerStatus.DRAFT,
      },
    })
    return NextResponse.json({ issuer }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unique')) {
      return NextResponse.json({ error: 'slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
