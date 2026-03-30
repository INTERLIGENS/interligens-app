import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'

export async function POST(req: NextRequest) {
  const auth = requireAdminApi(req)
  if (auth) return auth
  try {
    const { kolHandle, address, chain, label, sourceLabel, sourceUrl } = await req.json()
    const wallet = await prisma.kolWallet.create({ data: { kolHandle, address, chain: chain ?? 'SOL', label, sourceLabel, sourceUrl } })
    return NextResponse.json(wallet, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
