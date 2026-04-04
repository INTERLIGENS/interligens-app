import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const submissions = await prisma.transparencySubmission.findMany({
    orderBy: { createdAt: 'desc' },
    include: { wallets: true },
  })

  return NextResponse.json({
    submissions: submissions.map(s => ({
      ...s,
      walletCount: s.wallets.length,
    })),
  })
}
