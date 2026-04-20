/**
 * POST /api/admin/gtm/configure
 *
 * Accepts { gtmId } and persists it in AdminDocument with category=CONFIG.
 * Next step (out of scope here): read the latest CONFIG row at boot and
 * inject GTM into the root layout. For now this only stores the value.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GTM_ID_RE = /^GTM-[A-Z0-9]{6,10}$/;

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as
    | { gtmId?: string }
    | null;
  const gtmId = body?.gtmId?.trim() ?? "";

  if (!GTM_ID_RE.test(gtmId)) {
    return NextResponse.json(
      {
        error: "invalid_gtm_id",
        message: "GTM ID must match format GTM-XXXXXXX",
      },
      { status: 400 },
    );
  }

  try {
    // Store as a CONFIG-category AdminDocument. Title doubles as the key.
    const existing = await prisma.adminDocument.findFirst({
      where: { category: "CONFIG", title: "GTM_ID" },
    });
    const doc = existing
      ? await prisma.adminDocument.update({
          where: { id: existing.id },
          data: { description: gtmId, status: "uploaded" },
        })
      : await prisma.adminDocument.create({
          data: {
            title: "GTM_ID",
            description: gtmId,
            category: "CONFIG",
            status: "uploaded",
          },
        });
    return NextResponse.json({ ok: true, id: doc.id, gtmId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/gtm/configure] failed", err);
    return NextResponse.json(
      { error: "save_failed", message: message.slice(0, 200) },
      { status: 500 },
    );
  }
}
