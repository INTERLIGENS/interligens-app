import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const h = decodeURIComponent(handle).trim().toLowerCase().replace(/^@/, "")
  try {
    const directCount = await prisma.kolEvidence.count({ where: { kolHandle: h } })
    const kol = await prisma.kolProfile.findFirst({
      where: { handle: { equals: h, mode: "insensitive" } },
      include: { evidences: true }
    })
    if (!kol) return NextResponse.json({ found: false }, { status: 404 })
    const { kolWallets, kolCases, evidences, ...rest } = kol as any
    return NextResponse.json({
      found: true,
      debug: { directCount, evidencesLength: evidences?.length, dbUrl: process.env.DATABASE_URL?.slice(0,40) },
      kol: { ...rest, wallets: kolWallets, caseLinks: kolCases, evidences }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
