import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'

export async function POST(req: NextRequest) {
  const auth = requireAdminApi(req)
  if (auth) return auth
  try {
    const data = await req.json()
    const ev = await prisma.kolEvidence.create({ data })
    return NextResponse.json(ev, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
