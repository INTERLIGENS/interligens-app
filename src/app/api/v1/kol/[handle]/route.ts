// src/app/api/v1/kol/[handle]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const maxDuration = 15;
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const kol = await prisma.kolProfile.findUnique({
    where: { handle },
    include: {
      evidences: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, createdAt: true, kolHandle: true, type: true, label: true,
          description: true, wallets: true, amountUsd: true, txCount: true,
          dateFirst: true, dateLast: true, token: true, sampleTx: true,
          sourceUrl: true, twitterPost: true, postTimestamp: true,
          deltaMinutes: true, rawJson: true,
        },
      },
      kolCases: {
        select: {
          id: true, createdAt: true, kolHandle: true, caseId: true, role: true,
          paidUsd: true, evidence: true, claimType: true, confidenceLevel: true,
          lastReviewedAt: true, methodologyRef: true, sourceLabel: true,
          sourceUrl: true, versionNote: true,
        },
      },
      _count: { select: { evidences: true, kolCases: true } },
    },
  });
  if (!kol) return NextResponse.json({ found: false, handle, error: "KOL not found" }, { status: 404 });
  const totalPaidUsd = kol.kolCases.reduce((sum, c) => sum + (c.paidUsd ?? 0), 0);
  return NextResponse.json({
    version: "1.0", found: true,
    kol: {
      id: kol.id, handle: kol.handle, platform: kol.platform, displayName: kol.displayName,
      label: kol.label, riskFlag: kol.riskFlag, confidence: kol.confidence, status: kol.status,
      tier: kol.tier, rugCount: kol.rugCount, followerCount: kol.followerCount, verified: kol.verified,
      notes: kol.notes, tags: kol.tags, bio: kol.bio, pricePerPost: kol.pricePerPost,
      evmAddress: kol.evmAddress, exitDate: kol.exitDate, exitNarrative: kol.exitNarrative,
      exitPostUrl: kol.exitPostUrl, totalDocumented: kol.totalDocumented, totalScammed: kol.totalScammed,
      stats: { evidenceItems: kol._count.evidences, rugLinkedCases: kol._count.kolCases, totalPaidUsd, proceedsSource: "KolProceedsEvent" },
      evidences: kol.evidences, cases: kol.kolCases,
      profileUrl: `https://interligens.com/en/kol/${kol.handle}`,
      legalReportUrl: `https://interligens.com/api/kol/${kol.handle}/pdf-legal`,
    },
  });
}
