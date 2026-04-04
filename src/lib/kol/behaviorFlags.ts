// src/lib/kol/behaviorFlags.ts

export const BEHAVIOR_FLAG_KEYS = [
  'REPEATED_CASHOUT',
  'MULTI_HOP_TRANSFER',
  'CROSS_CASE_RECURRENCE',
  'MULTI_LAUNCH_LINKED',
  'LAUNDERING_INDICATORS',
  'KNOWN_LINKED_WALLETS',
  'COORDINATED_PROMOTION',
] as const

export type BehaviorFlagKey = (typeof BEHAVIOR_FLAG_KEYS)[number]

export const BEHAVIOR_FLAG_LABELS: Record<BehaviorFlagKey, { en: string; fr: string }> = {
  REPEATED_CASHOUT: {
    en: 'Repeated cashout pattern',
    fr: 'Schéma de cashout répété',
  },
  MULTI_HOP_TRANSFER: {
    en: 'Multi-hop transfer obfuscation',
    fr: 'Transferts multi-sauts (obfuscation)',
  },
  CROSS_CASE_RECURRENCE: {
    en: 'Recurrence across multiple cases',
    fr: 'Récurrence sur plusieurs affaires',
  },
  MULTI_LAUNCH_LINKED: {
    en: 'Linked to multiple token launches',
    fr: 'Lié à plusieurs lancements de tokens',
  },
  LAUNDERING_INDICATORS: {
    en: 'Laundering indicators detected',
    fr: 'Indicateurs de blanchiment détectés',
  },
  KNOWN_LINKED_WALLETS: {
    en: 'Known linked wallets identified',
    fr: 'Wallets liés identifiés',
  },
  COORDINATED_PROMOTION: {
    en: 'Coordinated promotion activity',
    fr: 'Activité de promotion coordonnée',
  },
}

export function parseBehaviorFlags(raw: string | string[]): BehaviorFlagKey[] {
  const arr = typeof raw === 'string' ? JSON.parse(raw) as string[] : raw
  return arr.filter((k): k is BehaviorFlagKey =>
    BEHAVIOR_FLAG_KEYS.includes(k as BehaviorFlagKey),
  )
}

export function getBehaviorFlagLabels(
  flags: BehaviorFlagKey[],
  locale: 'en' | 'fr' = 'en',
): string[] {
  return flags.map((k) => BEHAVIOR_FLAG_LABELS[k]?.[locale] ?? k)
}
