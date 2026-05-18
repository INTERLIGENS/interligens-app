import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'
import {
  RwaContractVerificationStatus,
  RwaVerificationEventType,
} from '@prisma/client'
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
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const reason =
    (typeof body.reason === 'string' ? body.reason : null) ||
    'Contract deprecated'
  const actor = (typeof body.actor === 'string' ? body.actor : null) || 'admin'

  const contract = await prisma.rwaContract.update({
    where: { id },
    data: {
      isDeprecated: true,
      verificationStatus: RwaContractVerificationStatus.DEPRECATED,
      lastCheckedAt: new Date(),
    },
  })

  await prisma.rwaVerificationEvent.create({
    data: {
      contractId: id,
      eventType: RwaVerificationEventType.DEPRECATED,
      summary: reason,
      actor,
    },
  })

  const registryVersion = await bumpRegistryVersion()
  return NextResponse.json({ contract, registryVersion })
}
