import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_KOL_FILTER } from "@/lib/kol/publishGate";
import { PUBLISHED_LAUNDRY_FILTER, redactLaundryTrail, LAUNDRY_PUBLICATION_SELECT } from "@/lib/laundry/publicationGate";

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

  // Publication du trail : le filtre est dans le `where` (la base ne rend pas
  // la ligne retirée) ET revérifié sur l'objet (défense en profondeur).
  // `PUBLIC_KOL_FILTER` ci-dessus ne couvre que la publication du PROFIL — un
  // profil public peut porter un narratif retiré.
  const trail = await prisma.laundryTrail.findFirst({
    where: { kolHandle: handle, ...PUBLISHED_LAUNDRY_FILTER },
    include: { signals: true },
    orderBy: { createdAt: "desc" },
  });

  if (!redactLaundryTrail(trail as { publication?: unknown } | null)) {
    return NextResponse.json(null);
  }
  return NextResponse.json(trail);
}
