import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_KOL_FILTER } from "@/lib/kol/publishGate";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  // Publish gate: only serve the trail if the handle maps to a public profile.
  const publicProfile = await prisma.kolProfile.findFirst({
    where: { handle, ...PUBLIC_KOL_FILTER },
    select: { id: true },
  });
  if (!publicProfile) return NextResponse.json(null, { status: 404 });

  const trail = await prisma.laundryTrail.findFirst({
    where: { kolHandle: handle },
    include: { signals: true },
    orderBy: { createdAt: "desc" },
  });

  if (!trail) return NextResponse.json(null);
  return NextResponse.json(trail);
}
