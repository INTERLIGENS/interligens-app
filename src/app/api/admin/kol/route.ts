import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/security/adminAuth'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  const auth = requireAdminApi(req)
  if (auth) return auth

  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const search = searchParams.get("search") ?? ""

  const where = search
    ? { handle: { contains: search, mode: "insensitive" as const } }
    : {}

  const [rows, total] = await Promise.all([
    prisma.kolProfile.findMany({
      where,
      include: { kolWallets: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.kolProfile.count({ where }),
  ])

  const profiles = rows.map(({ kolWallets, ...rest }) => ({
    ...rest,
    wallets: JSON.stringify(kolWallets.map(w => w.id)),
  }))

  return NextResponse.json({ profiles, total })
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
