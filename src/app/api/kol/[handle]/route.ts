import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PUBLIC_KOL_FILTER } from "@/lib/kol/publishGate"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const h = decodeURIComponent(handle).trim().toLowerCase().replace(/^@/, "")
  try {
    const directCount = await prisma.kolEvidence.count({ where: { kolHandle: h } })
    const kol = await prisma.kolProfile.findFirst({
      where: { handle: { equals: h, mode: "insensitive" }, ...PUBLIC_KOL_FILTER },
      include: { evidences: true, kolWallets: true, kolCases: true }
    })
    if (!kol) return NextResponse.json({ found: false }, { status: 404 })
    const { kolWallets, kolCases, evidences, ...rest } = kol as any
    return NextResponse.json({
      found: true,
      kol: { ...rest, wallets: kolWallets, caseLinks: kolCases, evidences }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
