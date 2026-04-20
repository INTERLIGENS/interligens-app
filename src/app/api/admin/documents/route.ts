/**
 * GET/POST /api/admin/documents
 *
 * GET  — list all AdminDocument rows.
 * POST — create a metadata-only row. The actual file upload happens
 *        separately via the presign route + client PUT to R2.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set([
  "LEGAL",
  "DATA_ROOM",
  "OPERATIONAL",
  "EDITORIAL",
]);

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  try {
    const docs = await prisma.adminDocument.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ documents: docs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/documents GET] failed", err);
    return NextResponse.json(
      { error: "list_failed", message: message.slice(0, 200) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        category?: string;
        version?: string;
        r2Key?: string;
        r2Url?: string;
        status?: string;
      }
    | null;

  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }
  if (typeof body.category !== "string" || !VALID_CATEGORIES.has(body.category)) {
    return NextResponse.json(
      { error: "invalid_category", message: "Must be one of LEGAL, DATA_ROOM, OPERATIONAL, EDITORIAL" },
      { status: 400 },
    );
  }

  try {
    const doc = await prisma.adminDocument.create({
      data: {
        title: body.title.trim().slice(0, 200),
        description:
          typeof body.description === "string"
            ? body.description.slice(0, 2000)
            : null,
        category: body.category,
        version:
          typeof body.version === "string" ? body.version.slice(0, 50) : null,
        r2Key:
          typeof body.r2Key === "string" ? body.r2Key.slice(0, 500) : null,
        r2Url:
          typeof body.r2Url === "string" ? body.r2Url.slice(0, 2000) : null,
        status: body.status === "uploaded" ? "uploaded" : "pending",
      },
    });
    return NextResponse.json({ ok: true, document: doc });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/documents POST] failed", err);
    return NextResponse.json(
      { error: "create_failed", message: message.slice(0, 200) },
      { status: 500 },
    );
  }
}
