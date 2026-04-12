// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/admin/intelligence/entities
// List and upsert CanonicalEntity records.
// Auth: requireAdminApi
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { buildDedupKey, normalizeValue } from "@/lib/intelligence/normalize";
import type { IntelEntityType } from "@/lib/intelligence";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const riskClass = url.searchParams.get("riskClass") || url.searchParams.get("risk") || undefined;
  const type = url.searchParams.get("type") || undefined;
  const search = url.searchParams.get("search") || url.searchParams.get("q") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = url.searchParams.has("offset")
    ? parseInt(url.searchParams.get("offset")!)
    : (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (riskClass) where.riskClass = riskClass;
  if (type) where.type = type;
  if (search) where.value = { contains: search, mode: "insensitive" };

  const [entities, total] = await Promise.all([
    prisma.canonicalEntity.findMany({
      where,
      include: {
        observations: {
          select: {
            id: true,
            sourceSlug: true,
            riskClass: true,
            listIsActive: true,
            label: true,
            ingestedAt: true,
          },
          orderBy: { ingestedAt: "desc" },
        },
        _count: { select: { cases: true } },
      },
      orderBy: { lastSeenAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.canonicalEntity.count({ where }),
  ]);

  return NextResponse.json({ records: entities, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: {
    type: string;
    value: string;
    chain?: string;
    riskClass?: string;
    displaySafety?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.type || !body.value) {
    return NextResponse.json(
      { error: "type and value are required" },
      { status: 400 }
    );
  }

  const normalized = normalizeValue(body.type as IntelEntityType, body.value);
  const dedupKey = buildDedupKey(body.type as IntelEntityType, normalized);
  const now = new Date();

  const entity = await prisma.canonicalEntity.upsert({
    where: { dedupKey },
    create: {
      type: body.type as any,
      value: normalized,
      chain: body.chain ?? null,
      riskClass: (body.riskClass as any) ?? "UNKNOWN",
      strongestSource: "admin-manual",
      sourceCount: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      dedupKey,
      displaySafety: (body.displaySafety as any) ?? "INTERNAL_ONLY",
    },
    update: {
      lastSeenAt: now,
      ...(body.riskClass ? { riskClass: body.riskClass as any } : {}),
      ...(body.displaySafety ? { displaySafety: body.displaySafety as any } : {}),
    },
  });

  return NextResponse.json({ entity }, { status: 201 });
}
