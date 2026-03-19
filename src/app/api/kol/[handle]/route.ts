import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, context: { params: Promise<{ handle: string }> }) {
  const { handle } = await context.params
  const kol = await prisma.kOLProfile.findUnique({
    where: { handle: handle.toLowerCase() },
    include: { wallets: true, caseLinks: true }
  })
  if (!kol) return NextResponse.json({ found: false }, { status: 404 })
  return NextResponse.json({ found: true, kol })
}
