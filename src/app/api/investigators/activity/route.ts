import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { InvestigatorActivityEvent } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: InvestigatorActivityEvent[] = [
  "LOGIN",
  "WORKSPACE_OPENED",
  "CASE_CREATED",
  "CASE_OPENED",
  "CASE_UPDATED",
  "ENTITY_ADDED",
  "ENTITY_COUNT_SNAPSHOT",
  "EXPORT_TRIGGERED",
  "SHARE_ACTIVATED",
  "SHARE_DEACTIVATED",
  "PUBLISH_SUBMITTED",
  "ASSISTANT_QUERIED",
  "IDENTITY_UPDATED",
  "SETTINGS_UPDATED",
];

function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/**
 * Internal activity log writer. Called server-side by workspace code to
 * record metadata events. Origin check: only accepts same-origin requests.
 */
export async function POST(req: NextRequest) {
  // Same-origin guard — this is an internal write path, not a public API.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const profileId = typeof body.profileId === "string" ? body.profileId : "";
  const event = body.event as InvestigatorActivityEvent | undefined;
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : null;

  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }
  if (!event || !VALID.includes(event)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    await prisma.investigatorActivityLog.create({
      data: {
        profileId,
        event,
        metadata: metadata ?? undefined,
        ipAddress: getClientIp(req),
      },
    });

    await prisma.investigatorProfile.update({
      where: { id: profileId },
      data: { lastActiveAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[investigators/activity] write failed", err);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }
}
