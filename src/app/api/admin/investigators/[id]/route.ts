import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { checkTrustedContributorEligibility } from "@/lib/investigators/eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteCtx) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;

  const profile = await prisma.investigatorProfile.findUnique({
    where: { id },
    include: {
      ndaAcceptance: true,
      betaTermsAcceptance: true,
    },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const [programAudit, activity, activityCounts] = await Promise.all([
    prisma.investigatorProgramAuditLog.findMany({
      where: { profileId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.investigatorActivityLog.findMany({
      where: { profileId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.investigatorActivityLog.groupBy({
      by: ["event"],
      where: { profileId: id },
      _count: { _all: true },
    }),
  ]);

  const eligibility = await checkTrustedContributorEligibility(id);

  const summary: Record<string, number> = {};
  for (const r of activityCounts) {
    summary[r.event] = r._count._all;
  }

  return NextResponse.json({
    profile,
    programAudit,
    activity,
    activitySummary: summary,
    eligibility,
  });
}
