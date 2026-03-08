
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const deny = requireAdminApi(req);
  if (deny) return deny;

  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const submissions = await prisma.communitySubmission.findMany({
    where: { status },
    orderBy: [{ severityDerived: "desc" }, { createdAt: "asc" }],
    take: 200,
  });
  return NextResponse.json({ submissions });
}
