// src/lib/kol/publishGate.ts
// Filtre central pour toutes les surfaces publiques KOL
// Importer dans toutes les queries publiques

/**
 * Filtre Prisma pour la liste publique /kol
 * Priorité publishStatus, fallback publishable pour backward compat
 */
export const PUBLIC_KOL_FILTER = {
  OR: [
    { publishStatus: 'published' },
    { publishable: true, publishStatus: 'draft' }, // profils anciens avant la migration
  ],
}

/** Admin — voit tout sauf restricted */
export const ADMIN_KOL_FILTER = {
  publishStatus: { not: 'restricted' as const },
}

/** Investigateur — voit tout */
export const ALL_KOL_FILTER = {}

/**
 * In-memory equivalent of PUBLIC_KOL_FILTER — use on already-loaded profiles
 * (e.g. after a findMany with `include`) to preserve identical semantics.
 *
 * Never hand-inline `publishable && publishStatus === 'published'`: that was the
 * pre-gate AND logic and drops profiles that passed the review flow cleanly
 * (publishStatus='published' without the legacy publishable=true flag).
 */
export function isKolPublic(profile: {
  publishStatus?: string | null
  publishable?: boolean | null
}): boolean {
  if (profile.publishStatus === 'published') return true
  if (profile.publishable === true && profile.publishStatus === 'draft') return true
  return false
}

/**
 * Garde-fou avant publication manuelle.
 * Un profil doit avoir du contenu minimal pour passer en published.
 */
export function isPublishEligible(profile: {
  handle: string
  tier?: string | null
  evidenceStatus?: string | null
  walletAttributionStatus?: string | null
}): { eligible: boolean; reason?: string } {
  if (!profile.handle) return { eligible: false, reason: 'handle manquant' }

  const hasSubstance =
    profile.tier ||
    (profile.evidenceStatus && profile.evidenceStatus !== 'none') ||
    (profile.walletAttributionStatus && profile.walletAttributionStatus !== 'none')

  if (!hasSubstance) {
    return { eligible: false, reason: 'profil vide — aucune substance documentée' }
  }

  return { eligible: true }
}
