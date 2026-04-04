import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminApi } from "@/lib/security/adminAuth"
import { ADMIN_KOL_FILTER } from "@/lib/kol/publishGate"
import { isPublishEligible } from "@/lib/kol/publishGate"

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("publishStatus")

  const where = {
    ...ADMIN_KOL_FILTER,
    ...(status ? { publishStatus: status } : {}),
  }

  const profiles = await prisma.kolProfile.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      handle: true,
      displayName: true,
      tier: true,
      publishStatus: true,
      publishable: true,
      editorialStatus: true,
      evidenceStatus: true,
      walletAttributionStatus: true,
      proceedsStatus: true,
      internalNote: true,
      summary: true,
      evidenceDepth: true,
      completenessLevel: true,
      profileStrength: true,
      behaviorFlags: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ profiles })
}

const DENSITY_FIELDS = [
  'summary', 'observedBehaviorSummary', 'documentedFacts', 'partialFacts',
  'behaviorFlags', 'evidenceDepth', 'completenessLevel',
  'proceedsCoverage', 'walletAttributionStrength', 'profileStrength',
] as const

const VALID_PUBLISH_STATUS = ["draft", "reviewed", "published", "restricted"]

export async function PATCH(req: NextRequest) {
  const deny = requireAdminApi(req)
  if (deny) return deny

  const body = await req.json()
  const { handle, publishStatus, ...rest } = body

  if (!handle) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 })
  }

  if (publishStatus && !VALID_PUBLISH_STATUS.includes(publishStatus)) {
    return NextResponse.json(
      { error: `publishStatus must be one of: ${VALID_PUBLISH_STATUS.join(", ")}` },
      { status: 400 },
    )
  }

  const profile = await prisma.kolProfile.findUnique({
    where: { handle },
    select: {
      handle: true,
      tier: true,
      evidenceStatus: true,
      walletAttributionStatus: true,
      publishStatus: true,
    },
  })

  if (!profile) {
    return NextResponse.json({ error: "profile not found" }, { status: 404 })
  }

  if (publishStatus === "published") {
    const check = isPublishEligible(profile)
    if (!check.eligible) {
      return NextResponse.json(
        { error: `not eligible: ${check.reason}` },
        { status: 422 },
      )
    }
  }

  const data: Record<string, unknown> = {}
  if (publishStatus) data.publishStatus = publishStatus

  for (const field of DENSITY_FIELDS) {
    if (rest[field] !== undefined) {
      data[field] = rest[field]
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 })
  }

  const updated = await prisma.kolProfile.update({
    where: { handle },
    data,
    select: {
      handle: true,
      publishStatus: true,
      evidenceDepth: true,
      completenessLevel: true,
      profileStrength: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ updated })
}
