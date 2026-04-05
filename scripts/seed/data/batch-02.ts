// scripts/seed/data/batch-02.ts
// BOTIFY internal document — IMG_0647 p.2 "On Board Already"
// Source: mariaqueennft leaked document
// 5 KOLs confirmed as onboarded in BOTIFY promotion ring

import type { SeedKolProfile } from '../types'

const INTERNAL_NOTE = "Confirmed 'On Board Already' in BOTIFY internal document — source: mariaqueennft, IMG_0647 p.2"
const SOURCE_URL = 'evidence/botify-main/leaked-doc/IMG_0647.PNG'
const SOURCE_LABEL = 'BOTIFY internal document — mariaqueennft'

function botifyOnboardProfile(handle: string): SeedKolProfile {
  return {
    handle,
    platform: 'x',
    tier: 'MEDIUM',
    publishStatus: 'draft',
    evidenceStatus: 'moderate',
    editorialStatus: 'pending',
    internalNote: INTERNAL_NOTE,
    evidences: [
      {
        sourceType: 'document_excerpt',
        title: `${SOURCE_LABEL} — ${handle} listed as "On Board Already"`,
        dedupKey: `botify-doc-onboard-${handle}`,
        sourceUrl: SOURCE_URL,
        observedAt: '2025-03-01',
      },
    ],
  }
}

export const batch02: SeedKolProfile[] = [
  botifyOnboardProfile('DegnBen'),
  botifyOnboardProfile('JammaPelson'),
  botifyOnboardProfile('AnonymousCFS'),
  botifyOnboardProfile('Cheatcoiner'),
  botifyOnboardProfile('UnitedTradersComm'),
]
