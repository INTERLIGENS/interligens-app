import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { assessExposure } from "@/lib/security/assessment/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/security/incidents/:id/reassess
 * Re-runs the exposure rule engine against the current state of the incident
 * and writes a NEW assessment (the previous row stays for audit). Optional
 * body fields override the engine inputs:
 *   { confirmedExposure?: boolean, vendorIsLive?: boolean, analystNote? }
 */
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;
  const incident = await prisma.securityIncident.findUnique({
    where: { id },
    include: { vendor: { select: { slug: true, isActive: true } } },
  });
  if (!incident) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const assessment = assessExposure({
    incidentType: incident.incidentType as "breach",
    severity: incident.severity as "critical",
    vendorSlug: incident.vendor?.slug,
    vendorIsLive:
      typeof body.vendorIsLive === "boolean"
        ? body.vendorIsLive
        : incident.vendor?.isActive,
    confirmedExposure: body.confirmedExposure === true,
  });

  const row = await prisma.securityExposureAssessment.create({
    data: {
      incidentId: incident.id,
      exposureLevel: assessment.exposureLevel,
      affectedSurface: assessment.affectedSurface as unknown as object,
      requiresKeyRotation: assessment.requiresKeyRotation,
      requiresAccessReview: assessment.requiresAccessReview,
      requiresInfraLogReview: assessment.requiresInfraLogReview,
      requiresPublicStatement: assessment.requiresPublicStatement,
      actionChecklist: assessment.actionChecklist as unknown as object,
      analystNote:
        typeof body.analystNote === "string" ? body.analystNote : null,
    },
  });

  return NextResponse.json({ assessment: row });
}
