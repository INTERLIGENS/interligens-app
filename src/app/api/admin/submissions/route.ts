
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuth } from "@/lib/security/auth";

export async function GET(req: NextRequest) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const submissions = await prisma.communitySubmission.findMany({
    where: { status },
    orderBy: [{ severityDerived: "desc" }, { createdAt: "asc" }],
    take: 200,
  });
  return NextResponse.json({ submissions });
}
