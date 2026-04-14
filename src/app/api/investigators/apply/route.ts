import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ApplyBody = {
  handle?: string;
  displayName?: string;
  email?: string;
  country?: string;
  languages?: string[];
  specialties?: string[];
  publicLinks?: string;
  background?: string;
  motivation?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as ApplyBody;

  const handle = typeof body.handle === "string" ? body.handle.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const country = typeof body.country === "string" ? body.country.trim() : "";
  const languages = Array.isArray(body.languages) ? body.languages.slice(0, 10) : [];
  const specialties = Array.isArray(body.specialties) ? body.specialties.slice(0, 20) : [];
  const publicLinksRaw = typeof body.publicLinks === "string" ? body.publicLinks : "";
  const background = typeof body.background === "string" ? body.background.slice(0, 4000).trim() : "";
  const motivation = typeof body.motivation === "string" ? body.motivation.slice(0, 4000).trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.slice(0, 80).trim() || null : null;

  if (!handle || !email || !country || !background || !motivation) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }
  if (languages.length === 0) {
    return NextResponse.json({ error: "At least one language required" }, { status: 400 });
  }
  if (specialties.length === 0) {
    return NextResponse.json({ error: "At least one specialty required" }, { status: 400 });
  }

  // Reject if existing application with same email is PENDING or APPROVED
  const existing = await prisma.investigatorApplication.findFirst({
    where: {
      email,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An application with this email is already pending or approved" },
      { status: 409 }
    );
  }

  const publicLinks = publicLinksRaw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20);

  try {
    const application = await prisma.investigatorApplication.create({
      data: {
        handle,
        displayName,
        email,
        country,
        languages,
        specialties,
        publicLinks: publicLinks,
        background,
        motivation,
        status: "PENDING",
      },
    });

    await prisma.investigatorProgramAuditLog.create({
      data: {
        event: "INVESTIGATOR_APPLICATION_SUBMITTED",
        metadata: {
          applicationId: application.id,
          handle,
          email,
          country,
        },
      },
    });

    return NextResponse.json({ success: true, applicationId: application.id });
  } catch (err) {
    console.error("[investigators/apply] failed", err);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
