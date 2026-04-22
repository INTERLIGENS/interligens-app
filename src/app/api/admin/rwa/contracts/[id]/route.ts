import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const { id } = await params
  const contract = await prisma.rwaContract.findUnique({
    where: { id },
    include: {
      asset: {
        include: {
          issuer: { select: { id: true, slug: true, displayName: true } },
        },
      },
      supersededBy: true,
      supersedes: true,
      aliases: true,
      sources: { orderBy: { capturedAt: 'desc' } },
      verificationEvents: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!contract)
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ contract })
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
  if (typeof body.tokenStandard === 'string')
    data.tokenStandard = body.tokenStandard || null
  if (typeof body.isPrimary === 'boolean') data.isPrimary = body.isPrimary

  try {
    // If promoting to primary, demote siblings in same chainKey for same asset
    if (data.isPrimary === true) {
      const existing = await prisma.rwaContract.findUnique({
        where: { id },
        select: { assetId: true, chainKey: true },
      })
      if (existing) {
        await prisma.rwaContract.updateMany({
          where: {
            assetId: existing.assetId,
            chainKey: existing.chainKey,
            isPrimary: true,
            NOT: { id },
          },
          data: { isPrimary: false },
        })
      }
    }

    const contract = await prisma.rwaContract.update({ where: { id }, data })
    return NextResponse.json({ contract })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
