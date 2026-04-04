import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const handle = new URL(req.url).searchParams.get('handle')
  if (!handle) return NextResponse.json({ wallets: [] })

  const wallets = await prisma.transparencyWallet.findMany({
    where: {
      kolHandle: { equals: handle.trim().toLowerCase().replace(/^@/, ''), mode: 'insensitive' },
      isPublic: true,
      submission: { publicVisibility: { startsWith: 'public_transparency' } },
    },
    select: { id: true, chain: true, address: true, label: true, ownershipClaim: true },
  })

  return NextResponse.json({ wallets })
}
