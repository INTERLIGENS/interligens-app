import { RwaMatchVerdict, RwaAliasType } from '@prisma/client'

// ─── TYPES ────────────────────────────────────────────────────

export type RwaLayer0Result = {
  matchVerdict:         RwaMatchVerdict
  badgeLabel:           string
  confidence:           number   // 0.0 - 1.0
  issuer?:              { slug: string; displayName: string; jurisdictionCode?: string | null }
  asset?:               { symbol: string; name: string; assetClass: string }
  officialAddress?:     string
  supersededByAddress?: string   // si LEGACY_VERIFIED
  aliasType?:           string   // si EXACT_ALIAS_VERIFIED
  scannedAddress:       string
  chainKey:             string
  tigerMessage:         string
  badgeColor:           string
  badgeBg:              string
  scoreImpact:          number
  isInstantDanger:      false    // jamais true sur Couche 0 seule en Phase 1
  cachedUntil:          string   // ISO date
  registryVersion:      number
  isImplementationOnly?: boolean // cas spécial IMPLEMENTATION
  redirectToAddress?:   string   // si IMPLEMENTATION, pointer vers le proxy
}

// ─── BADGE MAPPING ────────────────────────────────────────────

const BADGE_MAP: Record<RwaMatchVerdict, { label: string; color: string; bg: string }> = {
  EXACT_VERIFIED:           { label: 'Issuer Verified',           color: '#00C851', bg: '#0D2D1A' },
  EXACT_ALIAS_VERIFIED:     { label: 'Official Proxy / Bridge Verified', color: '#00C851', bg: '#0D2D1A' },
  LEGACY_VERIFIED:          { label: 'Legacy Contract',           color: '#FF6B00', bg: '#1A1200' },
  PROBABLE_FAMILY_MISMATCH: { label: 'Known Issuer, Wrong Contract', color: '#FF3B30', bg: '#2D0D0D' },
  UNKNOWN:                  { label: 'Issuer Not Listed',         color: '#FF9500', bg: '#1A1A00' },
}

// ─── SCORE IMPACT ─────────────────────────────────────────────

const SCORE_IMPACT: Record<RwaMatchVerdict, number> = {
  EXACT_VERIFIED:           +20,
  EXACT_ALIAS_VERIFIED:     +20,
  LEGACY_VERIFIED:            0,
  PROBABLE_FAMILY_MISMATCH: -40,
  UNKNOWN:                  -10,
}

// ─── TIGER MESSAGES ───────────────────────────────────────────

function buildTigerMessage(
  verdict: RwaMatchVerdict,
  issuerName?: string,
  aliasType?: string
): string {
  switch (verdict) {
    case 'EXACT_VERIFIED':
      return `Adresse officielle reconnue. C'est bien ${issuerName ?? 'cet émetteur'}. On continue l'analyse — custodian, réserves, track record.`

    case 'EXACT_ALIAS_VERIFIED':
      if (aliasType === 'PROXY') {
        return `Proxy officiel confirmé. C'est un contrat de représentation légitime de ${issuerName ?? 'cet émetteur'}. On continue l'analyse complète.`
      }
      if (aliasType === 'BRIDGE_REPRESENTATION') {
        return `Représentation bridge officielle confirmée pour ${issuerName ?? 'cet émetteur'}. On continue l'analyse complète.`
      }
      return `Contrat officiel alternatif confirmé pour ${issuerName ?? 'cet émetteur'}. On continue l'analyse.`

    case 'LEGACY_VERIFIED':
      return `Ce contrat est connu mais il a été migré. L'émetteur est légitime — mais vérifie que tu utilises bien le contrat actuel avant de toucher quoi que ce soit.`

    case 'PROBABLE_FAMILY_MISMATCH':
      return `Ce token évoque ${issuerName ?? 'un émetteur connu'}, mais cette adresse ne correspond à aucun contrat officiel répertorié. Ça ne veut pas dire scam garanti — ça veut dire qu'on ne peut pas valider. Prudence maximale avant tout mouvement.`

    case 'UNKNOWN':
      return `Cet émetteur n'est dans aucun registry vérifié. Ça ne veut pas dire que c'est une arnaque — ça veut dire qu'on ne peut pas confirmer. Les 4 couches d'analyse continuent.`
  }
}

// ─── BUILD VERDICT ────────────────────────────────────────────

export function buildVerdict(params: {
  verdict:          RwaMatchVerdict
  scannedAddress:   string
  chainKey:         string
  registryVersion:  number
  cachedUntil:      Date
  issuer?:          { slug: string; displayName: string; jurisdictionCode?: string | null }
  asset?:           { symbol: string; name: string; assetClass: string }
  officialAddress?: string
  supersededByAddress?: string
  aliasType?:       RwaAliasType | null
}): RwaLayer0Result {
  const badge = BADGE_MAP[params.verdict]
  const aliasTypeStr = params.aliasType ?? undefined

  return {
    matchVerdict:         params.verdict,
    badgeLabel:           badge.label,
    confidence:           confidenceFromVerdict(params.verdict),
    issuer:               params.issuer,
    asset:                params.asset,
    officialAddress:      params.officialAddress,
    supersededByAddress:  params.supersededByAddress,
    aliasType:            aliasTypeStr,
    scannedAddress:       params.scannedAddress,
    chainKey:             params.chainKey,
    tigerMessage:         buildTigerMessage(params.verdict, params.issuer?.displayName, aliasTypeStr),
    badgeColor:           badge.color,
    badgeBg:              badge.bg,
    scoreImpact:          SCORE_IMPACT[params.verdict],
    isInstantDanger:      false,
    cachedUntil:          params.cachedUntil.toISOString(),
    registryVersion:      params.registryVersion,
  }
}

function confidenceFromVerdict(verdict: RwaMatchVerdict): number {
  switch (verdict) {
    case 'EXACT_VERIFIED':           return 1.0
    case 'EXACT_ALIAS_VERIFIED':     return 0.95
    case 'LEGACY_VERIFIED':          return 0.85
    case 'PROBABLE_FAMILY_MISMATCH': return 0.5
    case 'UNKNOWN':                  return 0.0
  }
}

// ─── IMPLEMENTATION CASE ─────────────────────────────────────

export function buildImplementationResult(
  scannedAddress: string,
  chainKey: string,
  registryVersion: number,
  proxyAddress?: string | null
): RwaLayer0Result {
  return {
    matchVerdict:        'UNKNOWN',
    badgeLabel:          'Implementation Contract',
    confidence:          0,
    scannedAddress,
    chainKey,
    tigerMessage:        "C'est un contrat d'implémentation interne, pas l'adresse officielle. L'adresse publique correcte est celle du proxy. Ne l'utilise pas directement.",
    badgeColor:          '#FF9500',
    badgeBg:             '#1A1A00',
    scoreImpact:         0,
    isInstantDanger:     false,
    cachedUntil:         new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    registryVersion,
    isImplementationOnly: true,
    redirectToAddress:   proxyAddress ?? undefined,
  }
}
