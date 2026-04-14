/**
 * GET /api/admin/intel
 * Paginated feed for the Founder Intel page. Admin-only.
 * Query: category, minStars, unreadOnly, priority, cursor, limit.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";
import type { Prisma, IntelCategory, IntelPriority } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES: IntelCategory[] = ["SCAM", "COMPETITOR", "AI", "REGULATORY", "ECOSYSTEM"];
const PRIORITIES: IntelPriority[] = ["HIGH", "NORMAL", "LOW"];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const categoryParam = url.searchParams.get("category");
  const minStarsParam = url.searchParams.get("minStars");
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const priorityParam = url.searchParams.get("priority");
  const cursor = url.searchParams.get("cursor");
  const limitParam = url.searchParams.get("limit");

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(limitParam ?? "", 10) || DEFAULT_LIMIT),
  );

  const where: Prisma.FounderIntelItemWhereInput = {};

  if (categoryParam && CATEGORIES.includes(categoryParam as IntelCategory)) {
    where.category = categoryParam as IntelCategory;
  }

  if (minStarsParam) {
    const n = Number.parseInt(minStarsParam, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 5) {
      where.starRating = { gte: n };
    }
  }

  if (unreadOnly) where.read = false;

  if (priorityParam && PRIORITIES.includes(priorityParam as IntelPriority)) {
    where.priority = priorityParam as IntelPriority;
  }

  const items = await prisma.founderIntelItem.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const last = items.pop();
    nextCursor = last?.id ?? null;
  }

  const unreadCount = await prisma.founderIntelItem.count({ where: { read: false } });

  return NextResponse.json({ items, nextCursor, unreadCount });
}
