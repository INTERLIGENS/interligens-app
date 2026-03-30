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
  try {
    const data = await req.json()
    const kol = await prisma.kolProfile.create({ data })
    return NextResponse.json(kol, { status: 201 })
  } catch (e: any) {
    console.error('[KOL POST]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
