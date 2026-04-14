import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const applications = await prisma.investigatorApplication.findMany({
    orderBy: { submittedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ applications });
}
