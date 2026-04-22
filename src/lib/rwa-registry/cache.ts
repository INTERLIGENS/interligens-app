import { prisma } from '@/lib/prisma'
import { RwaLayer0Result } from './verdict'
import { RwaMatchVerdict } from '@prisma/client'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

// ─── READ CACHE ───────────────────────────────────────────────

export async function readCache(
  inputAddressNorm: string,
  chainKey: string,
  currentRegistryVersion: number
): Promise<RwaLayer0Result | null> {
  try {
    const cached = await prisma.rwaScanCache.findUnique({
      where: {
        inputAddressNorm_chainKey: { inputAddressNorm, chainKey }
      },
      include: { matchedContract: true }
    })

    if (!cached) return null

    // Invalide si version registry a changé
    if (cached.registryVersion !== currentRegistryVersion) return null

    // Invalide si TTL expiré
    if (cached.cachedUntil < new Date()) return null

    return cached.explanationJson as unknown as RwaLayer0Result
  } catch {
    return null
  }
}

// ─── WRITE CACHE ──────────────────────────────────────────────

export async function writeCache(
  inputAddressNorm: string,
  chainKey: string,
  result: RwaLayer0Result,
  registryVersion: number
): Promise<void> {
  const cachedUntil = new Date(Date.now() + CACHE_TTL_MS)

  try {
    await prisma.rwaScanCache.upsert({
      where: {
        inputAddressNorm_chainKey: { inputAddressNorm, chainKey }
      },
      create: {
        inputAddressNorm,
        chainKey,
        registryVersion,
        matchVerdict:     result.matchVerdict as RwaMatchVerdict,
        matchedContractId: null,
        matchedAssetId:   result.asset ? undefined : undefined,
        matchedIssuerId:  result.issuer ? undefined : undefined,
        confidence:       result.confidence,
        explanationJson:  result as unknown as import("@prisma/client").Prisma.InputJsonValue,
        cachedUntil,
      },
      update: {
        registryVersion,
        matchVerdict:     result.matchVerdict as RwaMatchVerdict,
        confidence:       result.confidence,
        explanationJson:  result as unknown as import("@prisma/client").Prisma.InputJsonValue,
        cachedUntil,
      }
    })
  } catch (err) {
    // Cache write failure est non-bloquant
    console.error('[RWA Cache] write failed:', err)
  }
}

// ─── GET REGISTRY VERSION ─────────────────────────────────────

export async function getRegistryVersion(): Promise<number> {
  const meta = await prisma.rwaRegistryMeta.findUnique({ where: { id: 1 } })
  if (!meta) {
    // Bootstrap singleton si absent
    const created = await prisma.rwaRegistryMeta.create({
      data: { id: 1, version: 1 }
    })
    return created.version
  }
  return meta.version
}

// ─── BUMP REGISTRY VERSION ───────────────────────────────────
// À appeler après chaque publish / deprecate / migrate admin

export async function bumpRegistryVersion(): Promise<number> {
  const meta = await prisma.rwaRegistryMeta.upsert({
    where: { id: 1 },
    create: { id: 1, version: 1 },
    update: { version: { increment: 1 } }
  })
  return meta.version
}
