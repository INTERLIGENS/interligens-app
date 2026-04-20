import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { listIncidents } from "@/lib/security/queries";
import { assessExposure } from "@/lib/security/assessment/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/security/incidents
 *   ?status=open,monitoring      — optional CSV
 *   ?severity=critical,high      — optional CSV
 *   ?limit=<n>                   — default 50, max 200
 */
export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const sp = req.nextUrl.searchParams;
  const parseCsv = (key: string) => {
    const raw = sp.get(key);
    if (!raw) return undefined;
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };
  const limit = Number(sp.get("limit") ?? "50");

  try {
    const incidents = await listIncidents({
      limit,
      status: parseCsv("status"),
      severity: parseCsv("severity"),
    });
    return NextResponse.json({ incidents });
  } catch (err) {
    console.warn("[admin/security/incidents] failed", err);
    return NextResponse.json({ incidents: [], pending: true });
  }
}

/**
 * POST /api/admin/security/incidents
 * Body (JSON):
 *   { vendorSlug?, title, summaryShort, summaryLong?, incidentType, severity,
 *     status?, detectedAt?, sourceUrl?, externalId?, runAssessment? }
 *
 * Creates the incident + (if runAssessment=true) an initial
 * SecurityExposureAssessment derived from the rule engine.
 */
export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summaryShort =
    typeof body.summaryShort === "string" ? body.summaryShort.trim() : "";
  const incidentType =
    typeof body.incidentType === "string" ? body.incidentType : "";
  const severity = typeof body.severity === "string" ? body.severity : "";

  if (!title || !summaryShort || !incidentType || !severity) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const vendorSlug =
    typeof body.vendorSlug === "string" ? body.vendorSlug : null;
  const vendor = vendorSlug
    ? await prisma.securityVendor.findUnique({ where: { slug: vendorSlug } })
    : null;

  const detectedAt =
    typeof body.detectedAt === "string" && body.detectedAt
      ? new Date(body.detectedAt)
      : new Date();
  if (Number.isNaN(detectedAt.getTime())) {
    return NextResponse.json({ error: "invalid_detectedAt" }, { status: 400 });
  }

  try {
    const incident = await prisma.securityIncident.create({
      data: {
        vendorId: vendor?.id ?? null,
        externalId: typeof body.externalId === "string" ? body.externalId : null,
        title,
        summaryShort,
        summaryLong:
          typeof body.summaryLong === "string" ? body.summaryLong : null,
        incidentType,
        severity,
        status: typeof body.status === "string" ? body.status : "open",
        detectedAt,
        sourceUrl:
          typeof body.sourceUrl === "string" ? body.sourceUrl : null,
      },
    });

    if (body.runAssessment) {
      const result = assessExposure({
        incidentType: incident.incidentType as "breach",
        severity: incident.severity as "critical",
        vendorSlug: vendor?.slug,
        vendorIsLive: vendor?.isActive,
      });
      await prisma.securityExposureAssessment.create({
        data: {
          incidentId: incident.id,
          exposureLevel: result.exposureLevel,
          affectedSurface: result.affectedSurface as unknown as object,
          requiresKeyRotation: result.requiresKeyRotation,
          requiresAccessReview: result.requiresAccessReview,
          requiresInfraLogReview: result.requiresInfraLogReview,
          requiresPublicStatement: result.requiresPublicStatement,
          actionChecklist: result.actionChecklist as unknown as object,
        },
      });
    }

    return NextResponse.json({ incident });
  } catch (err) {
    console.error("[admin/security/incidents] create failed", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
