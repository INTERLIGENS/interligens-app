// src/app/api/internal/pdf/regen/route.ts
// Admin-token protected endpoint.
//   POST  { handle }                → regenerate one
//   GET   ?handle=all               → regenerate every published profile
//   GET   ?handle=<name>            → regenerate one

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { generateCasePdf } from "@/lib/pdf/engine";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const guard = requireAdminApi(req);
  if (guard) return guard;

  const body = await req.json().catch(() => ({}));
  const handle = typeof body.handle === "string" ? body.handle : "";
  if (!handle) return NextResponse.json({ error: "Missing handle" }, { status: 400 });

  const result = await generateCasePdf(handle);
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function GET(req: NextRequest) {
  const guard = requireAdminApi(req);
  if (guard) return guard;

  const handle = req.nextUrl.searchParams.get("handle");
  if (!handle) return NextResponse.json({ error: "Missing handle" }, { status: 400 });

  if (handle !== "all") {
    const result = await generateCasePdf(handle);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  const profiles = await prisma.kolProfile.findMany({
    where: { publishStatus: "published" },
    select: { handle: true },
    orderBy: { handle: "asc" },
  });

  const results: Awaited<ReturnType<typeof generateCasePdf>>[] = [];
  for (const p of profiles) {
    const r = await generateCasePdf(p.handle);
    results.push(r);
    await new Promise((res) => setTimeout(res, 500));
  }

  const succeeded = results.filter((r) => r.success).length;
  return NextResponse.json({
    count: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  });
}
