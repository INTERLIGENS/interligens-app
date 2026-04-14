import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";
import type { InvestigatorApplicationStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const VALID: InvestigatorApplicationStatus[] = [
  "APPROVED",
  "REJECTED",
  "NEEDS_REVIEW",
];

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision as InvestigatorApplicationStatus | undefined;
  const internalNote = typeof body.internalNote === "string" ? body.internalNote.slice(0, 2000) : null;

  if (!decision || !VALID.includes(decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const existing = await prisma.investigatorApplication.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const reviewerHeader = req.headers.get("x-admin-actor") ?? "admin";

  const updated = await prisma.investigatorApplication.update({
    where: { id },
    data: {
      status: decision,
      reviewedAt: new Date(),
      reviewedBy: reviewerHeader,
      internalNote,
    },
  });

  const eventMap: Record<
    InvestigatorApplicationStatus,
    "INVESTIGATOR_APPLICATION_APPROVED" | "INVESTIGATOR_APPLICATION_REJECTED" | "INVESTIGATOR_APPLICATION_NEEDS_REVIEW" | null
  > = {
    APPROVED: "INVESTIGATOR_APPLICATION_APPROVED",
    REJECTED: "INVESTIGATOR_APPLICATION_REJECTED",
    NEEDS_REVIEW: "INVESTIGATOR_APPLICATION_NEEDS_REVIEW",
    PENDING: null,
  };
  const event = eventMap[decision];

  if (event) {
    await prisma.investigatorProgramAuditLog.create({
      data: {
        event,
        actorId: reviewerHeader,
        metadata: {
          applicationId: id,
          handle: existing.handle,
          email: existing.email,
          internalNote: internalNote?.slice(0, 200) ?? null,
        },
      },
    });
  }

  if (decision === "APPROVED") {
    // TODO: send invite email via Resend once the investigator email template is ready.
    console.log(`[investigators/review] APPROVED ${existing.handle} (${existing.email}) — invite email TODO`);
  }

  return NextResponse.json({ success: true, application: updated });
}
