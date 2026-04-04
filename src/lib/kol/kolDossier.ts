// src/lib/kol/kolDossier.ts

import { prisma } from '@/lib/prisma'
import { parseBehaviorFlags } from './behaviorFlags'

export async function getKolDossier(handle: string) {
  const h = handle.trim().toLowerCase().replace(/^@/, '')

  const profile = await prisma.kolProfile.findFirst({
    where: { handle: { equals: h, mode: 'insensitive' } },
    include: {
      aliases: true,
      kolWallets: true,
      tokenLinks: true,
      evidences: true,
      kolCases: true,
      laundryTrails: true,
    },
  })

  if (!profile) return null

  const behaviorFlagsList = parseBehaviorFlags(profile.behaviorFlags)
  const hasLaundryTrail = profile.laundryTrails.length > 0
  const hasObservedProceeds = (profile.totalDocumented ?? 0) > 0

  const completeness = computeCompletenessBadge({
    completenessLevel: profile.completenessLevel,
    evidenceDepth: profile.evidenceDepth,
    profileStrength: profile.profileStrength,
  })

  const {
    aliases,
    kolWallets,
    tokenLinks,
    evidences,
    kolCases,
    laundryTrails,
    ...profileFields
  } = profile

  return {
    ...profileFields,
    behaviorFlagsList,
    aliases,
    wallets: kolWallets,
    tokenLinks,
    evidences,
    caseLinks: kolCases,
    hasLaundryTrail,
    hasObservedProceeds,
    aggregates: {
      walletsCount: kolWallets.length,
      linkedTokensCount: tokenLinks.length,
      evidenceCount: evidences.length,
      linkedCasesCount: kolCases.length,
      hasLaundryTrail,
      hasObservedProceeds,
      observedProceedsTotal: profile.totalDocumented ?? 0,
      behaviorFlagsList,
    },
    completeness,
  }
}

function computeCompletenessBadge(profile: {
  completenessLevel: string
  evidenceDepth: string
  profileStrength: string
}): { label: string; tier: 'low' | 'medium' | 'high' | 'complete' } {
  const strength = profile.profileStrength
  if (strength === 'comprehensive') return { label: 'Comprehensive', tier: 'complete' }
  if (strength === 'strong') return { label: 'Strong', tier: 'high' }
  if (strength === 'standard') return { label: 'Standard', tier: 'medium' }
  if (strength === 'basic') return { label: 'Basic', tier: 'medium' }
  return { label: 'Minimal', tier: 'low' }
}
