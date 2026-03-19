import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPublishability } from '@/lib/kol/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (token !== process.env.ADMIN_TOKEN) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const handle = req.nextUrl.searchParams.get('handle')
  if (!handle) return NextResponse.json({ error: 'handle required' }, { status: 400 })

  try {
    const rows: any[] = await prisma.$queryRawUnsafe('SELECT * FROM "public"."KolProfile" WHERE handle = $1', handle)
    if (!rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const wallets: any[] = await prisma.$queryRawUnsafe('SELECT * FROM "public"."KolWallet" WHERE "kolHandle" = $1', handle)
    const cases: any[] = await prisma.$queryRawUnsafe('SELECT * FROM "public"."KolCase" WHERE "kolHandle" = $1', handle)

    const profile = { ...rows[0], wallets, caseLinks: cases }
    const result = checkPublishability(profile, cases)

    return NextResponse.json({ handle, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
