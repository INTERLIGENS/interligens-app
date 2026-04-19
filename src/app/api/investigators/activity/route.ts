import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { InvestigatorActivityEvent } from "@prisma/client";
import { getInvestigatorSessionContext } from "@/lib/investigators/session";

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
 * record metadata events.
 *
 * IDOR hotfix: the authoritative `profileId` is derived from the signed
 * investigator_session cookie. Any `profileId` supplied in the body is
 * only ever compared against the session-derived one — never trusted as
 * the write target. An attacker can no longer write activity events
 * attributed to a profile they don't own.
 */
export async function POST(req: NextRequest) {
  // Same-origin guard — this is an internal write path, not a public API.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ctx = await getInvestigatorSessionContext(req);
  if (!ctx || !ctx.profileId) {
    // No valid session OR legacy session with no profile row — activity
    // is per-profile, so both cases are unauthenticated for our purposes.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const suppliedProfileId =
    typeof body.profileId === "string" ? body.profileId : "";
  const event = body.event as InvestigatorActivityEvent | undefined;
  const metadata =
    body.metadata && typeof body.metadata === "object" ? body.metadata : null;

  // If a profileId is supplied, it must match the session's profile. We
  // deliberately return a generic 403 with no hint that the resource
  // exists under a different owner.
  if (suppliedProfileId && suppliedProfileId !== ctx.profileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!event || !VALID.includes(event)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  // Always write against the session-derived profileId, never the body.
  const profileId = ctx.profileId;

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
