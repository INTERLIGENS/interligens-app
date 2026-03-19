// INTERLIGENS KOL Evidence Types
// Publishing Standard v1 — March 2026

export type ClaimType =
  | 'verified_onchain'
  | 'source_attributed'
  | 'analytical_estimate'

export type ConfidenceLevel =
  | 'confirmed'
  | 'strong_linkage'
  | 'provisional'

export interface KolCaseEvidence {
  id: string
  kolHandle: string
  caseId: string
  role: string
  paidUsd?: number
  evidence?: string
  // Publishing Standard v1 fields
  claimType?: ClaimType
  confidenceLevel?: ConfidenceLevel
  sourceUrl?: string
  sourceLabel?: string
  methodologyRef?: string
  lastReviewedAt?: string
  versionNote?: string
}

export interface KolWalletRecord {
  id: string
  kolHandle: string
  address: string
  chain: string
  label?: string
  status: string
  // No family-linked field — use source-attributed only
  claimType?: ClaimType
  sourceLabel?: string
  sourceUrl?: string
}

export interface KolProfilePublic {
  id: string
  handle: string
  displayName?: string
  platform: string
  status: string
  riskFlag: string
  verified: boolean
  followerCount?: number
  rugCount: number
  totalScammed?: number
  notes?: string
  confidence?: string
  wallets: KolWalletRecord[]
  caseLinks: KolCaseEvidence[]
}

// ─── Publishability Gate ───────────────────────────────────────────────────

export interface PublishabilityResult {
  publishable: boolean
  blockers: string[]
  warnings: string[]
}

const PROHIBITED_PUBLIC_STRINGS = [
  'serial scammer', 'confirmed scammer', 'fraudster', 'criminal actor',
  'stole', 'stolen', 'guilty', 'mom wallet', 'dad wallet', 'family wallet',
  'no allegation', 'paid to promote', 'est. scammed', 'rugs confirmed',
  'scammer profile',
]

export function checkPublishability(profile: KolProfilePublic, cases: KolCaseEvidence[]): PublishabilityResult {
  const blockers: string[] = []
  const warnings: string[] = []

  // 1. Must have at least 1 verified on-chain OR source-attributed claim
  const hasVerifiedClaim = cases.some(c =>
    c.claimType === 'verified_onchain' || c.claimType === 'source_attributed'
  )
  if (!hasVerifiedClaim && cases.length > 0) {
    blockers.push('No verified on-chain or source-attributed case. Analytical estimates alone are insufficient for public publication.')
  }

  // 2. Estimated figures must have methodology ref
  cases.forEach(c => {
    if (c.paidUsd && !c.methodologyRef) {
      warnings.push(`Case ${c.caseId}: estimated figure shown without methodology reference.`)
    }
  })

  // 3. Cases with claimType=undefined get a warning
  cases.forEach(c => {
    if (!c.claimType) {
      warnings.push(`Case ${c.caseId}: no claim type assigned. Assign verified_onchain, source_attributed, or analytical_estimate.`)
    }
  })

  // 4. Cases with confidenceLevel=undefined get a warning
  cases.forEach(c => {
    if (!c.confidenceLevel) {
      warnings.push(`Case ${c.caseId}: no confidence level assigned.`)
    }
  })

  // 5. Check notes and evidence for prohibited strings
  const allText = [
    profile.notes ?? '',
    ...cases.map(c => c.evidence ?? ''),
    ...profile.wallets.map(w => w.label ?? ''),
  ].join(' ').toLowerCase()

  PROHIBITED_PUBLIC_STRINGS.forEach(term => {
    if (allText.includes(term.toLowerCase())) {
      blockers.push(`Prohibited wording detected: "${term}". Replace per Publishing Standard v1 Section F.`)
    }
  })

  return {
    publishable: blockers.length === 0,
    blockers,
    warnings,
  }
}
