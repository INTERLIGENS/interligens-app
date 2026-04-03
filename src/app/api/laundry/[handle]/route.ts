import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const trail = await prisma.laundryTrail.findFirst({
    where: { kolHandle: handle },
    include: { signals: true },
    orderBy: { createdAt: "desc" },
  });

  if (!trail) return NextResponse.json(null);
  return NextResponse.json(trail);
}
