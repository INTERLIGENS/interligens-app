import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromReq,
  validateSession,
} from "@/lib/security/investigatorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const token = getSessionTokenFromReq(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await validateSession(token);
  if (!session)
    return NextResponse.json({ error: "Session expired" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const legalFirstName = typeof body.legalFirstName === "string" ? body.legalFirstName.trim().slice(0, 120) : "";
  const legalLastName = typeof body.legalLastName === "string" ? body.legalLastName.trim().slice(0, 120) : "";
  const primaryEmail = typeof body.primaryEmail === "string" ? body.primaryEmail.trim().toLowerCase().slice(0, 200) : "";
  const country = typeof body.country === "string" ? body.country.trim().slice(0, 80) : "";
  const organizationName = typeof body.organizationName === "string" ? body.organizationName.trim().slice(0, 200) || null : null;

  if (!legalFirstName || !legalLastName || !primaryEmail || !country) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!EMAIL_RE.test(primaryEmail)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  // Look up InvestigatorProfile linked to this access. Create one if missing
  // (first-time identity completion).
  let profile = await prisma.investigatorProfile.findUnique({
    where: { accessId: session.accessId },
  });
  if (!profile) {
    profile = await prisma.investigatorProfile.create({
      data: {
        handle: session.label,
        accessId: session.accessId,
        legalFirstName,
        legalLastName,
        primaryEmail,
        country,
        organizationName,
      },
    });
  } else {
    profile = await prisma.investigatorProfile.update({
      where: { id: profile.id },
      data: {
        legalFirstName,
        legalLastName,
        primaryEmail,
        country,
        organizationName,
      },
    });
  }

  await prisma.investigatorProgramAuditLog.create({
    data: {
      profileId: profile.id,
      event: "INVESTIGATOR_IDENTITY_COMPLETED",
      actorId: session.accessId,
      metadata: {
        handle: profile.handle,
        country,
      },
    },
  });

  return NextResponse.json({ success: true });
}
