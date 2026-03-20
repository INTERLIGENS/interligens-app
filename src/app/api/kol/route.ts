import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const kols: any[] = await prisma.$queryRawUnsafe(`
      SELECT k.*, 
        (SELECT COUNT(*) FROM "public"."KolWallet" w WHERE w."kolHandle" = k.handle) AS "walletCount",
        (SELECT COUNT(*) FROM "public"."KolCase" c WHERE c."kolHandle" = k.handle) AS "caseCount"
      FROM "public"."KolProfile" k
      WHERE k."riskFlag" = 'confirmed_scammer' AND k.verified = true
      ORDER BY k."totalScammed" DESC NULLS LAST
    `)
    return NextResponse.json({
      kols: kols.map(k => ({
        handle: k.handle,
        displayName: k.displayName,
        platform: k.platform,
        status: k.status,
        verified: k.verified,
        rugCount: k.rugCount ?? 0,
        totalScammed: k.totalScammed ? Number(k.totalScammed) : null,
        followerCount: k.followerCount,
        walletCount: Number(k.walletCount ?? 0),
        caseCount: Number(k.caseCount ?? 0),
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
