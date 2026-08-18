// src/app/api/v1/kol/[handle]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_KOL_FILTER } from "@/lib/kol/publishGate";
import { redactProceeds } from "@/lib/kol/proceedsGate";
import { redactMonetary, redactEvidenceAmount, sumPublishedMonetary, MONETARY_PUBLICATION_SELECT } from "@/lib/publication/monetaryGate";
export const maxDuration = 15;
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  // Publish gate: only expose profiles that pass PUBLIC_KOL_FILTER (published,
  // or legacy publishable+draft). Non-public handles 404 like the profile page.
  const kol = await prisma.kolProfile.findFirst({
    where: { handle, ...PUBLIC_KOL_FILTER },
    include: {
      evidences: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, createdAt: true, kolHandle: true, type: true, label: true,
          description: true, wallets: true, amountUsd: true, txCount: true,
          dateFirst: true, dateLast: true, token: true, sampleTx: true,
          sourceUrl: true, twitterPost: true, postTimestamp: true,
          deltaMinutes: true,
        },
      },
      kolCases: {
        select: {
          id: true, createdAt: true, kolHandle: true, caseId: true, role: true,
          paidUsd: true, evidence: true, claimType: true,
          lastReviewedAt: true, sourceLabel: true,
          sourceUrl: true, versionNote: true,
        },
      },
      _count: { select: { evidences: true, kolCases: true } },
    },
  });
  if (!kol) return NextResponse.json({ found: false, handle, error: "KOL not found" }, { status: 404 });
  // A14 — une somme calculée à la volée est invisible à toute requête : aucun
  // filtre Prisma ne l'atteint. `sumPublishedMonetary` rend `null`, jamais 0 —
  // « 0 $ » serait une affirmation, et une affirmation fausse.
  const totalPaidUsd = sumPublishedMonetary(kol, kol.kolCases.map((c) => c.paidUsd), "proceeds");
  return NextResponse.json({
    version: "1.0", found: true,
    kol: {
      id: kol.id, handle: kol.handle, platform: kol.platform, displayName: kol.displayName,
      label: kol.label, riskFlag: kol.riskFlag, confidence: kol.confidence, status: kol.status,
      tier: kol.tier, rugCount: kol.rugCount, followerCount: kol.followerCount, verified: kol.verified,
      tags: kol.tags, pricePerPost: kol.pricePerPost,
      exitDate: kol.exitDate,
      exitPostUrl: kol.exitPostUrl,
      totalDocumented: redactProceeds(kol, kol.totalDocumented),
      // A14 — LA ligne du rapport A13. `totalScammed` était servi brut juste
      // ici, à côté d'un champ redacted : bkokoski, 210 900 $ retirés et
      // 4 500 000 $ servis. Facteur 21, même énoncé.
      totalScammed: redactMonetary(kol, kol.totalScammed, "scam_scale"),
      stats: { evidenceItems: kol._count.evidences, rugLinkedCases: kol._count.kolCases, totalPaidUsd, proceedsSource: "KolProceedsEvent" },
      // Les montants portés par les preuves et les dossiers passent par le
      // même point : le chiffre retiré d'un endroit ne doit pas ressortir par
      // une table voisine (A13 — les 210 000 $ existent trois fois).
      evidences: kol.evidences.map((e) => ({ ...e, amountUsd: redactEvidenceAmount(kol, e) })),
      cases: kol.kolCases.map((c) => ({ ...c, paidUsd: redactMonetary(kol, c.paidUsd, "proceeds") })),
      profileUrl: `https://interligens.com/en/kol/${kol.handle}`,
      legalReportUrl: `https://interligens.com/api/kol/${kol.handle}/pdf-legal`,
    },
  });
}
