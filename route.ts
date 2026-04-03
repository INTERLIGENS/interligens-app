// src/app/api/admin/kol-review/route.ts
// Review des profils seedés non publiés
// Auth: requireAdminApi (Bearer token)

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAdminApi } from '@/lib/security/adminAuth'

const prisma = new PrismaClient()

// GET — liste des profils non published avec leurs statuts
export async function GET(req: NextRequest) {
  const authError = requireAdminApi(req)
  if (authError) return authError

  const profiles = await prisma.kolProfile.findMany({
    where: { publishStatus: { not: 'published' } },
    select: {
      handle:                  true,
      displayName:             true,
      tier:                    true,
      publishStatus:           true,
      editorialStatus:         true,
      walletAttributionStatus: true,
      evidenceStatus:          true,
      proceedsStatus:          true,
      internalNote:            true,
      createdAt:               true,
      updatedAt:               true,
      kolWallets:  { select: { id: true } },
      evidences:   { select: { id: true } },
    },
    orderBy: [
      { editorialStatus: 'asc' },
      { evidenceStatus: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  const withCounts = profiles.map((p) => ({
    ...p,
    walletsCount:  p.kolWallets.length,
    evidenceCount: p.evidences.length,
    kolWallets:    undefined,
    evidences:     undefined,
  }))

  return NextResponse.json({ profiles: withCounts, total: withCounts.length })
}

// PATCH — met à jour publishStatus et/ou editorialStatus d'un profil
export async function PATCH(req: NextRequest) {
  const authError = requireAdminApi(req)
  if (authError) return authError

  const body = await req.json()
  const { handle, publishStatus, editorialStatus } = body

  if (!handle) {
    return NextResponse.json({ error: 'handle requis' }, { status: 400 })
  }

  const allowedPublish   = ['draft', 'reviewed', 'published', 'restricted']
  const allowedEditorial = ['pending', 'reviewed', 'approved']

  if (publishStatus && !allowedPublish.includes(publishStatus)) {
    return NextResponse.json({ error: 'publishStatus invalide' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (publishStatus) {
    updates.publishStatus = publishStatus
    updates.publishable   = publishStatus === 'published'  // sync backward compat
  }
  if (editorialStatus && allowedEditorial.includes(editorialStatus)) {
    updates.editorialStatus = editorialStatus
  }

  const profile = await prisma.kolProfile.update({
    where: { handle },
    data:  updates,
    select: { handle: true, publishStatus: true, publishable: true, editorialStatus: true },
  })

  return NextResponse.json({ ok: true, profile })
}
