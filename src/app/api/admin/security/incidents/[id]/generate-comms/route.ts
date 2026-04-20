import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { buildDraftSet } from "@/lib/security/comms/drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/security/incidents/:id/generate-comms
 *
 * Regenerates the 3-channel draft set (x + public_status + internal) for the
 * incident. Old drafts are kept (for audit); new ones are appended with
 * status=draft. The admin edits + approves in the UI.
 */
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;
  const incident = await prisma.securityIncident.findUnique({
    where: { id },
    include: {
      vendor: { select: { name: true } },
      assessments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!incident) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const assessment = incident.assessments[0] ?? null;
  const surface =
    (assessment?.affectedSurface as { summary?: string } | null) ?? null;

  const drafts = buildDraftSet({
    incident: {
      title: incident.title,
      summaryShort: incident.summaryShort,
      incidentType: incident.incidentType,
      severity: incident.severity as "critical",
      detectedAt: incident.detectedAt,
      vendorName: incident.vendor?.name ?? null,
      sourceUrl: incident.sourceUrl,
    },
    exposure: {
      exposureLevel: (assessment?.exposureLevel ?? "unlikely") as "unlikely",
      affectedSummary: surface?.summary ?? "Surface not yet mapped.",
      rotatedKeys: Boolean(assessment?.requiresKeyRotation === false),
      reviewedAccess: Boolean(assessment?.requiresAccessReview === false),
      reviewedLogs: Boolean(assessment?.requiresInfraLogReview === false),
    },
  });

  const written = [];
  for (const d of drafts) {
    const row = await prisma.securityCommsDraft.create({
      data: {
        incidentId: incident.id,
        channel: d.channel,
        tone: d.tone,
        title: d.title ?? null,
        body: d.body,
      },
    });
    written.push(row);
  }

  return NextResponse.json({ drafts: written });
}
