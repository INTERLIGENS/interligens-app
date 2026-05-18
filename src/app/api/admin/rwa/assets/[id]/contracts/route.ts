import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'
import {
  RwaContractVerificationStatus,
  RwaVerificationEventType,
} from '@prisma/client'
import {
  validateChainKey,
  detectChainFamily,
  normalizeAddress,
} from '@/lib/rwa-registry/normalize'
import { bumpRegistryVersion } from '@/lib/rwa-registry/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const { id } = await params
  const contracts = await prisma.rwaContract.findMany({
    where: { assetId: id },
    orderBy: [{ isPrimary: 'desc' }, { chainKey: 'asc' }],
  })
  return NextResponse.json({ contracts })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const { id: assetId } = await params

  try {
    const body = (await req.json()) as Record<string, unknown>
    const chainKeyRaw = String(body.chainKey ?? '').trim()
    const addressRaw = String(body.contractAddress ?? '').trim()
    if (!chainKeyRaw || !addressRaw) {
      return NextResponse.json(
        { error: 'chainKey and contractAddress required' },
        { status: 400 },
      )
    }

    const chainKey = validateChainKey(chainKeyRaw)
    const chainFamily = detectChainFamily(chainKey)
    const contractAddressNorm = normalizeAddress(addressRaw, chainFamily)

    const isPrimary = Boolean(body.isPrimary)
    const tokenStandard =
      (body.tokenStandard as string | undefined)?.trim() || null

    // If marking this primary, demote any other primary for the same asset+chainKey
    if (isPrimary) {
      await prisma.rwaContract.updateMany({
        where: { assetId, chainKey, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const contract = await prisma.rwaContract.create({
      data: {
        assetId,
        chainFamily,
        chainKey,
        contractAddressRaw: addressRaw,
        contractAddressNorm,
        tokenStandard,
        isPrimary,
        isDeprecated: false,
        verificationStatus: RwaContractVerificationStatus.VERIFIED_OFFICIAL,
        verificationDate: new Date(),
      },
    })

    await prisma.rwaVerificationEvent.create({
      data: {
        contractId: contract.id,
        eventType: RwaVerificationEventType.CREATED,
        summary: `Contract created on ${chainKey}`,
        actor: 'admin',
      },
    })

    const registryVersion = await bumpRegistryVersion()
    return NextResponse.json({ contract, registryVersion }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unique'))
      return NextResponse.json(
        { error: 'contract already exists for this chain' },
        { status: 409 },
      )
    if (
      msg.includes('Invalid EVM address') ||
      msg.includes('Invalid Solana address') ||
      msg.includes('Unsupported chainKey')
    ) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
