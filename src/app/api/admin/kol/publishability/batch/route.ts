import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'
import { checkPublishability } from '@/lib/kol/types'
import type { KolCaseEvidence, KolWalletRecord, PublishabilityResult } from '@/lib/kol/types'

export const dynamic = 'force-dynamic'

// Batch publishability gate — accepts up to one admin-directory page of
// handles and returns the checkPublishability() verdict for each. Uses the
// admin_session cookie via requireAdminApi (same auth as /api/admin/kol),
// so the admin UI can call it client-side with credentials: 'include'.
export async function POST(req: NextRequest) {
  const auth = requireAdminApi(req)
  if (auth) return auth

  let handles: string[] = []
  try {
    const body = await req.json()
    handles = Array.isArray(body?.handles)
      ? body.handles.filter((h: unknown): h is string => typeof h === 'string').slice(0, 100)
      : []
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (handles.length === 0) return NextResponse.json({ results: {} })

  try {
    const [profiles, wallets, cases] = await Promise.all([
      prisma.kolProfile.findMany({
        where: { handle: { in: handles } },
        select: {
          handle: true, displayName: true, platform: true,
          status: true, riskFlag: true, verified: true, notes: true,
        },
      }),
      prisma.kolWallet.findMany({ where: { kolHandle: { in: handles } } }),
      prisma.kolCase.findMany({ where: { kolHandle: { in: handles } } }),
    ])

    const results: Record<string, PublishabilityResult> = {}

    for (const handle of handles) {
      const p = profiles.find(x => x.handle === handle)
      if (!p) continue

      const walletRecords: KolWalletRecord[] = wallets
        .filter(w => w.kolHandle === handle)
        .map(w => ({
          id: w.id, kolHandle: w.kolHandle, address: w.address, chain: w.chain,
          label: w.label ?? undefined, status: w.status,
          claimType: (w.claimType ?? undefined) as KolWalletRecord['claimType'],
          sourceLabel: w.sourceLabel ?? undefined, sourceUrl: w.sourceUrl ?? undefined,
        }))

      const caseRecords: KolCaseEvidence[] = cases
        .filter(c => c.kolHandle === handle)
        .map(c => ({
          id: c.id, kolHandle: c.kolHandle, caseId: c.caseId, role: c.role,
          paidUsd: c.paidUsd ?? undefined, evidence: c.evidence ?? undefined,
          claimType: (c.claimType ?? undefined) as KolCaseEvidence['claimType'],
          confidenceLevel: (c.confidenceLevel ?? undefined) as KolCaseEvidence['confidenceLevel'],
          methodologyRef: c.methodologyRef ?? undefined,
        }))

      results[handle] = checkPublishability(
        {
          id: handle,
          handle: p.handle,
          displayName: p.displayName ?? undefined,
          platform: p.platform,
          status: p.status,
          riskFlag: p.riskFlag,
          verified: p.verified,
          rugCount: 0,
          notes: p.notes ?? undefined,
          wallets: walletRecords,
          caseLinks: caseRecords,
        },
        caseRecords,
      )
    }

    return NextResponse.json({ results })
  } catch (e: any) {
    console.error('[KOL publishability batch]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
