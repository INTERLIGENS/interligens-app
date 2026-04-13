import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const profiles = await prisma.vaultProfile.findMany({
    where: { visibility: { in: ["SEMI_PUBLIC", "PUBLIC"] } },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    select: {
      handle: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      languages: true,
      specialties: true,
      coverageZones: true,
      websiteUrl: true,
      twitterHandle: true,
      telegramHandle: true,
      contactEmail: true,
      visibility: true,
      isFeatured: true,
      isVerified: true,
      badges: true,
    },
    take: 500,
  });

  // contactEmail only surfaces when visibility = PUBLIC
  const scrubbed = profiles.map((p) => ({
    ...p,
    contactEmail: p.visibility === "PUBLIC" ? p.contactEmail : null,
  }));

  return NextResponse.json({ investigators: scrubbed });
}
