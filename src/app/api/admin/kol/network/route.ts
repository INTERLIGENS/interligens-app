import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (token !== process.env.ADMIN_TOKEN) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const kols: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "public"."KolProfile" WHERE "riskFlag" = 'confirmed_scammer' ORDER BY "totalScammed" DESC NULLS LAST`)
    const wallets: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "public"."KolWallet"`)
    const cases: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "public"."KolCase"`)

    // Build project clusters — group KOLs by shared caseId
    const projectMap: Record<string, string[]> = {}
    for (const c of cases) {
      if (!projectMap[c.caseId]) projectMap[c.caseId] = []
      if (!projectMap[c.caseId].includes(c.kolHandle)) projectMap[c.caseId].push(c.kolHandle)
    }

    // Build KOL connections — who worked together
    const connections: { a: string, b: string, project: string }[] = []
    for (const [project, handles] of Object.entries(projectMap)) {
      for (let i = 0; i < handles.length; i++) {
        for (let j = i + 1; j < handles.length; j++) {
          connections.push({ a: handles[i], b: handles[j], project })
        }
      }
    }

    return NextResponse.json({
      kols: kols.map(k => ({
        handle: k.handle,
        displayName: k.displayName ?? k.handle,
        rugCount: k.rugCount ?? 0,
        totalScammed: k.totalScammed ?? 0,
        status: k.status,
        verified: k.verified,
        walletCount: wallets.filter(w => w.kolHandle === k.handle).length,
        caseCount: cases.filter(c => c.kolHandle === k.handle).length,
      })),
      wallets,
      cases,
      projectMap,
      connections,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
