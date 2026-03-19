import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const h = decodeURIComponent(handle).trim().toLowerCase().replace(/^@/, "")
  try {
    const all: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "public"."KolProfile"`)
    const row = all.find((r: any) => String(r.handle).trim().toLowerCase().replace(/^@/, "") === h)
    if (!row) return NextResponse.json({ found: false }, { status: 404 })
    const wallets: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "public"."KolWallet" WHERE "kolHandle" = $1`, row.handle)
    const cases: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "public"."KolCase" WHERE "kolHandle" = $1`, row.handle)
    return NextResponse.json({ found: true, kol: { ...row, wallets, caseLinks: cases } })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
