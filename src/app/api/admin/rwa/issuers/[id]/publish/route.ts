import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'
import { RwaIssuerStatus } from '@prisma/client'
import { bumpRegistryVersion } from '@/lib/rwa-registry/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const { id } = await params
  const issuer = await prisma.rwaIssuer.update({
    where: { id },
    data: { status: RwaIssuerStatus.PUBLISHED },
  })
  const registryVersion = await bumpRegistryVersion()
  return NextResponse.json({ issuer, registryVersion })
}
