import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit"
import { prisma } from "@/lib/prisma"
import { buildKolCanonicalSnapshot } from "@/lib/kol/canonical"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.public)
  if (!rl.allowed) return rateLimitResponse(rl)
  const { handle } = await params
  const h = decodeURIComponent(handle).trim().toLowerCase().replace(/^@/, "")
  try {
    const snapshot = await buildKolCanonicalSnapshot(h)
    if (!snapshot) return NextResponse.json({ found: false }, { status: 404 })

    // Enforce publish gate (equivalent to PUBLIC_KOL_FILTER)
    const isPublic =
      snapshot.publishStatus !== "restricted" &&
      (snapshot.publishStatus === "published" ||
        (snapshot.publishable && snapshot.publishStatus === "draft"))
    if (!isPublic) return NextResponse.json({ found: false }, { status: 404 })

    // Fetch full relations for backward compat — evidences/wallets/cases
    const relations = await prisma.kolProfile.findFirst({
      where: { handle: { equals: h, mode: "insensitive" } },
      select: { handle: true, evidences: true, kolWallets: true, kolCases: true },
    })

    return NextResponse.json({
      found: true,
      kol: {
        ...snapshot,
        wallets: relations?.kolWallets ?? [],
        caseLinks: relations?.kolCases ?? [],
        evidences: relations?.evidences ?? [],
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
