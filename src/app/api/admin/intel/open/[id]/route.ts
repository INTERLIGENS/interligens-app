/**
 * POST /api/admin/intel/open/[id]
 * Marks the item as read and returns its url. Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;
  try {
    const item = await prisma.founderIntelItem.update({
      where: { id },
      data: { read: true },
      select: { url: true },
    });
    return NextResponse.json({ ok: true, url: item.url });
  } catch {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
}
