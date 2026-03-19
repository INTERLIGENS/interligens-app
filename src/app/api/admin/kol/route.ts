import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'

export async function GET(req: NextRequest) {
  const auth = requireAdminApi(req)
  if (auth) return auth
  const kols = await prisma.kOLProfile.findMany({
    include: { wallets: true, caseLinks: true },
    orderBy: { totalScammed: 'desc' }
  })
  return NextResponse.json(kols)
}

export async function POST(req: NextRequest) {
  const auth = requireAdminApi(req)
  if (auth) return auth
  const data = await req.json()
  const kol = await prisma.kOLProfile.create({ data })
  return NextResponse.json(kol, { status: 201 })
}
