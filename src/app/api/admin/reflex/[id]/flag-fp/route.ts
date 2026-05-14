/**
 * REFLEX V1 — POST/DELETE /api/admin/reflex/:id/flag-fp
 *
 * Toggles falsePositiveFlag on a ReflexAnalysis row. Auth is enforced
 * by src/proxy.ts which gates /api/admin/* via admin_session cookie or
 * Basic Auth — the handler itself trusts the request reached it.
 *
 * V1 records "admin" verbatim in falsePositiveFlaggedBy. When multiple
 * admins exist, swap to the session's accessId or email.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLAGGED_BY_V1 = "admin";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  try {
    const updated = await prisma.reflexAnalysis.update({
      where: { id },
      data: {
        falsePositiveFlag: true,
        falsePositiveFlaggedAt: new Date(),
        falsePositiveFlaggedBy: FLAGGED_BY_V1,
      },
      select: { id: true, falsePositiveFlag: true, falsePositiveFlaggedAt: true },
    });
    return NextResponse.json({
      ok: true,
      id: updated.id,
      flag: updated.falsePositiveFlag,
      flaggedAt: updated.falsePositiveFlaggedAt?.toISOString() ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[api/admin/reflex/flag-fp] POST error:", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  try {
    const updated = await prisma.reflexAnalysis.update({
      where: { id },
      data: {
        falsePositiveFlag: false,
        falsePositiveFlaggedAt: null,
        falsePositiveFlaggedBy: null,
      },
      select: { id: true, falsePositiveFlag: true },
    });
    return NextResponse.json({
      ok: true,
      id: updated.id,
      flag: updated.falsePositiveFlag,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[api/admin/reflex/flag-fp] DELETE error:", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
