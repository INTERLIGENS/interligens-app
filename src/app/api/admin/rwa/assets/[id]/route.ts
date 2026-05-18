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
  const asset = await prisma.rwaAsset.findUnique({
    where: { id },
    include: {
      issuer: { select: { id: true, slug: true, displayName: true, status: true } },
      contracts: { orderBy: [{ isPrimary: 'desc' }, { chainKey: 'asc' }] },
      aliases: true,
      sources: { orderBy: { capturedAt: 'desc' } },
    },
  })
  if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ asset })
}
