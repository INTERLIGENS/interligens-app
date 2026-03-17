import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const search = searchParams.get("search") ?? "";
  const limit  = 25;

  const where = search ? { handle: { contains: search.toLowerCase() } } : {};

  const [total, profiles] = await Promise.all([
    prisma.kolProfile.count({ where }),
    prisma.kolProfile.findMany({
      where, orderBy: { createdAt: "desc" },
      skip: (page-1)*limit, take: limit,
    }),
  ]);

  return NextResponse.json({ profiles, total, page, pages: Math.ceil(total/limit) });
}
