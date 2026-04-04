import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json()
  const { status, reviewStatus, publicVisibility, decisionNote, publicNote } = body

  const data: Record<string, unknown> = {}
  if (status) data.status = status
  if (reviewStatus) data.reviewStatus = reviewStatus
  if (publicVisibility) data.publicVisibility = publicVisibility
  if (decisionNote !== undefined) data.decisionNote = decisionNote
  if (publicNote !== undefined) data.publicNote = publicNote
  if (reviewStatus === 'approved' || reviewStatus === 'rejected') {
    data.reviewedAt = new Date()
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updated = await prisma.transparencySubmission.update({
    where: { id },
    data,
  })

  // If making public, set all wallets to isPublic=true
  if (publicVisibility?.startsWith('public_transparency')) {
    await prisma.transparencyWallet.updateMany({
      where: { submissionId: id },
      data: { isPublic: true },
    })
  }

  return NextResponse.json({ updated })
}
