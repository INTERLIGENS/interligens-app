// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/admin/intelligence/cases
// List and create CaseRecord entries.
// Auth: requireAdminApi
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const sourceSlug = url.searchParams.get("sourceSlug") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (sourceSlug) where.sourceSlug = sourceSlug;

  const [cases, total] = await Promise.all([
    prisma.caseRecord.findMany({
      where,
      include: {
        entities: {
          include: {
            entity: {
              select: { id: true, type: true, value: true, riskClass: true },
            },
          },
        },
        _count: { select: { evidence: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.caseRecord.count({ where }),
  ]);

  return NextResponse.json({ records: cases, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: {
    title: string;
    caseType: string;
    summary?: string;
    sourceSlug: string;
    externalRef?: string;
    externalUrl?: string;
    entityIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title || !body.sourceSlug || !body.caseType) {
    return NextResponse.json(
      { error: "title, caseType, and sourceSlug are required" },
      { status: 400 }
    );
  }

  const caseRecord = await prisma.caseRecord.create({
    data: {
      title: body.title,
      caseType: body.caseType as any,
      summary: body.summary?.slice(0, 280),
      sourceSlug: body.sourceSlug,
      externalRef: body.externalRef,
      externalUrl: body.externalUrl,
      ...(body.entityIds && body.entityIds.length > 0
        ? {
            entities: {
              create: body.entityIds.map((entityId) => ({
                entityId,
                matchBasis: "EXACT_ADDRESS" as any,
              })),
            },
          }
        : {}),
    },
    include: { entities: true },
  });

  return NextResponse.json({ case: caseRecord }, { status: 201 });
}
