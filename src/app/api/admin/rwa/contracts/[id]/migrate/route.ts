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

// REGISTRY-11 — Contract migration.
//
// Two call shapes:
//   a) { newContractId }            — link this (legacy) contract to an already-
//                                     created successor contract.
//   b) { chainKey, contractAddress, tokenStandard?, isPrimary? }
//                                   — create the successor in one step, then link.
//
// Side effects:
//   - legacy contract: supersededByContractId = new.id,
//                      verificationStatus = SUSPECTED_OLD,
//                      isDeprecated = true
//   - new contract (if created here): isPrimary inherited/requested,
//                                     verificationStatus = VERIFIED_OFFICIAL
//   - MIGRATED event logged on the legacy contract
//   - registry version bumped

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const { id: legacyId } = await params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const legacy = await prisma.rwaContract.findUnique({
    where: { id: legacyId },
    select: { id: true, assetId: true, chainKey: true },
  })
  if (!legacy) return NextResponse.json({ error: 'legacy contract not found' }, { status: 404 })

  const reason =
    (typeof body.reason === 'string' ? body.reason : null) ||
    'Migrated to successor contract'
  const actor = (typeof body.actor === 'string' ? body.actor : null) || 'admin'

  try {
    let newContractId: string
    let created: boolean = false

    if (typeof body.newContractId === 'string' && body.newContractId.trim()) {
      newContractId = body.newContractId.trim()
      const successor = await prisma.rwaContract.findUnique({
        where: { id: newContractId },
      })
      if (!successor)
        return NextResponse.json(
          { error: 'newContractId not found' },
          { status: 404 },
        )
      if (successor.assetId !== legacy.assetId)
        return NextResponse.json(
          { error: 'successor must belong to the same asset' },
          { status: 400 },
        )
    } else {
      const chainKeyRaw = String(body.chainKey ?? '').trim()
      const addressRaw = String(body.contractAddress ?? '').trim()
      if (!chainKeyRaw || !addressRaw) {
        return NextResponse.json(
          { error: 'newContractId, or (chainKey + contractAddress) required' },
          { status: 400 },
        )
      }
      const chainKey = validateChainKey(chainKeyRaw)
      const chainFamily = detectChainFamily(chainKey)
      const contractAddressNorm = normalizeAddress(addressRaw, chainFamily)
      const isPrimary = body.isPrimary !== false

      if (isPrimary) {
        await prisma.rwaContract.updateMany({
          where: {
            assetId: legacy.assetId,
            chainKey,
            isPrimary: true,
          },
          data: { isPrimary: false },
        })
      }

      const successor = await prisma.rwaContract.create({
        data: {
          assetId: legacy.assetId,
          chainFamily,
          chainKey,
          contractAddressRaw: addressRaw,
          contractAddressNorm,
          tokenStandard:
            (body.tokenStandard as string | undefined)?.trim() || null,
          isPrimary,
          isDeprecated: false,
          verificationStatus: RwaContractVerificationStatus.VERIFIED_OFFICIAL,
          verificationDate: new Date(),
        },
      })
      newContractId = successor.id
      created = true
    }

    const updatedLegacy = await prisma.rwaContract.update({
      where: { id: legacyId },
      data: {
        supersededByContractId: newContractId,
        isDeprecated: true,
        verificationStatus: RwaContractVerificationStatus.SUSPECTED_OLD,
        isPrimary: false,
        lastCheckedAt: new Date(),
      },
    })

    await prisma.rwaVerificationEvent.create({
      data: {
        contractId: legacyId,
        eventType: RwaVerificationEventType.MIGRATED,
        summary: reason,
        actor,
        metadata: { newContractId, createdSuccessor: created },
      },
    })

    const registryVersion = await bumpRegistryVersion()
    return NextResponse.json({
      legacy: updatedLegacy,
      newContractId,
      createdSuccessor: created,
      registryVersion,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (
      msg.includes('Invalid EVM address') ||
      msg.includes('Invalid Solana address') ||
      msg.includes('Unsupported chainKey')
    )
      return NextResponse.json({ error: msg }, { status: 400 })
    if (msg.includes('Unique'))
      return NextResponse.json(
        { error: 'successor contract already exists for this chain' },
        { status: 409 },
      )
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
