import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const profiles = await prisma.investigatorProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      ndaAcceptance: { select: { ndaVersion: true, ndaLanguage: true, signedAt: true } },
      betaTermsAcceptance: { select: { termsVersion: true, termsLanguage: true, acceptedAt: true } },
    },
  });

  return NextResponse.json({ profiles });
}
