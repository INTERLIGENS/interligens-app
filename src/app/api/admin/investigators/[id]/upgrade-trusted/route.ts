import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { checkTrustedContributorEligibility } from "@/lib/investigators/eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;
  const existing = await prisma.investigatorProfile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const check = await checkTrustedContributorEligibility(id);
  if (!check.eligible) {
    const failed = Object.entries(check.criteria)
      .filter(([, c]) => !c.met)
      .map(([k]) => k);
    return NextResponse.json(
      {
        error: "Eligibility criteria not met",
        failedCriteria: failed,
        criteria: check.criteria,
      },
      { status: 400 }
    );
  }

  const actorId = req.headers.get("x-admin-actor") ?? "admin";

  await prisma.investigatorProfile.update({
    where: { id },
    data: {
      accessLevel: "TRUSTED_CONTRIBUTOR",
      verificationStatus: "TRUSTED",
      isEligibleForPublishing: true,
    },
  });

  await prisma.investigatorProgramAuditLog.create({
    data: {
      profileId: id,
      event: "TRUSTED_CONTRIBUTOR_GRANTED",
      actorId,
      metadata: { handle: existing.handle },
    },
  });

  return NextResponse.json({ success: true });
}
