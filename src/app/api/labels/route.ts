import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')
  if (!address) return NextResponse.json({ labels: [] })

  const labels = await prisma.walletLabel.findMany({
    where: {
      address: address.toLowerCase(),
      verified: true
    },
    orderBy: { confidence: 'asc' }
  })
  return NextResponse.json({ labels })
}
