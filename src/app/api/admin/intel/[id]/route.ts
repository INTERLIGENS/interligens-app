/**
 * PATCH /api/admin/intel/[id]
 * Body: { read?: boolean, starred?: boolean, starOverride?: number | null }
 * Validation: starOverride must be null or integer 1..5.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { read?: unknown; starred?: unknown; starOverride?: unknown }
    | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: {
    read?: boolean;
    starred?: boolean;
    starOverride?: number | null;
  } = {};

  if (body.read !== undefined) {
    if (typeof body.read !== "boolean") {
      return NextResponse.json({ error: "read must be boolean" }, { status: 400 });
    }
    data.read = body.read;
  }

  if (body.starred !== undefined) {
    if (typeof body.starred !== "boolean") {
      return NextResponse.json({ error: "starred must be boolean" }, { status: 400 });
    }
    data.starred = body.starred;
  }

  if (body.starOverride !== undefined) {
    const v = body.starOverride;
    if (v === null) {
      data.starOverride = null;
    } else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) {
      data.starOverride = v;
    } else {
      return NextResponse.json(
        { error: "starOverride must be null or integer 1..5" },
        { status: 400 },
      );
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const item = await prisma.founderIntelItem.update({ where: { id }, data });
    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
}
