// src/app/api/kol/[handle]/class-action/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export interface ClassActionPackage {
  reportId: string;
  generatedAt: string;
  subject: {
    handle: string;
    label: string | null;
    platform: string;
    evmAddress: string | null;
    tier: string | null;
  };
  caseStats: {
    rugLinkedCases: number;
    estimatedTotalLoss: number;
    documentedOnChainProceeds: number;
    evidenceItems: number;
    victimWallets: number;
  };
  jurisdictions: { jurisdiction: string; relevance: string; priority: string }[];
  defendants: { role: string; handle: string; label: string | null; confidence: string; linkedCases: number }[];
  cexTargets: { name: string; wallet: string; amountUsd: number; action: string; complicityScore?: number }[];
  victimPathways: { wallet: string; token: string; solPaid: number; usdLoss: number; purchaseDate: string }[];
  legalTheories: { theory: string; jurisdiction: string; elements: string[]; strength: string }[];
  nextSteps: string[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const kol = await prisma.kolProfile.findUnique({
    where: { handle },
    include: { evidences: true, kolCases: true },
  });

  if (!kol) return NextResponse.json({ error: "KOL not found" }, { status: 404 });

  const networkActors = await prisma.kolProfile.findMany({
    where: { handle: { in: ["GordonGekko", "planted", "DonWedge"] } },
    include: { kolCases: true },
  });

  const totalLoss = kol.kolCases.reduce((sum, c) => sum + (c.paidUsd ?? 0), 0);
  const documentedProceeds = kol.evidences
    .filter((e) => e.amountUsd !== null)
    .reduce((sum, e) => sum + (e.amountUsd ?? 0), 0);

  const pkg: ClassActionPackage = {
    reportId: `INTL-CA-${handle.toUpperCase()}-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    subject: {
      handle: kol.handle,
      label: kol.label,
      platform: kol.platform,
      evmAddress: kol.evmAddress ?? null,
      tier: kol.tier ?? null,
    },
    caseStats: {
      rugLinkedCases: kol.kolCases.length,
      estimatedTotalLoss: totalLoss,
      documentedOnChainProceeds: documentedProceeds,
      evidenceItems: kol.evidences.length,
      victimWallets: 4,
    },
    jurisdictions: [
      { jurisdiction: "United States (SDNY / DOJ)", relevance: "US-based exchange touchpoints. Delaware entity. Wire fraud / securities fraud.", priority: "HIGH" },
      { jurisdiction: "Canada (RCMP / OSC)", relevance: "Subject self-identified as Toronto-based. Dione Protocol LLC (Canadian entity).", priority: "HIGH" },
      { jurisdiction: "EU / AMF (France)", relevance: "EU-based investors potentially affected. MiCA cross-border jurisdiction possible.", priority: "MEDIUM" },
    ],
    defendants: [
      { role: "Primary subject", handle: kol.handle, label: kol.label, confidence: "CONFIRMED", linkedCases: kol.kolCases.length },
      ...networkActors.map((actor) => ({
        role: "Network co-defendant",
        handle: actor.handle,
        label: actor.label,
        confidence: actor.verified ? "CONFIRMED" : "STRONG_LINKAGE",
        linkedCases: actor.kolCases.length,
      })),
    ],
    cexTargets: [
      { name: "TITAN EXCHANGE", wallet: "D5YqVMoSxnqeZAKAUUE1Dm3bmjtdxQ5DCF356ozqN9cM", amountUsd: 64000, action: "Immediate freeze + KYC disclosure + SAR", complicityScore: 78 },
      { name: "UNKNOWN CEX (ET3F)", wallet: "ET3F3q42vUpfDHW8rgrhA1S2WPwb6Fhx97fsLR3EkxSn", amountUsd: 97000, action: "Preservation request + subpoena / MLAT", complicityScore: 81 },
      { name: "BINANCE", wallet: "3xcErQV4y3dEbSZbmyv3gHSFz7JCHufo9weuw71fEJxf", amountUsd: 36750, action: "Subpoena / MLAT — KYC @GordonGekko account holder", complicityScore: 72 },
      { name: "KUCOIN 2", wallet: "3g1hYfna2A1nj7WZctKeYYb5eNEQHobvFbwhRrnh5xQx", amountUsd: 63000, action: "Preservation request — @GordonGekko cashout Jan 2025", complicityScore: 68 },
    ],
    victimPathways: [
      { wallet: "ARu4n5...ZAravu7C", token: "BOTIFY", solPaid: 10.37, usdLoss: 1900, purchaseDate: "2026-03-20" },
      { wallet: "FE52Qw...HfouGEE6", token: "BOTIFY", solPaid: 0.36, usdLoss: 66, purchaseDate: "2026-03-19" },
      { wallet: "8K1wts...RjL7uRwj", token: "BOTIFY", solPaid: 4.0, usdLoss: 730, purchaseDate: "2026-03-18" },
      { wallet: "C1g9H6...1vuFcbtJ", token: "BOTIFY", solPaid: 0.65, usdLoss: 119, purchaseDate: "2026-03-18" },
    ],
    legalTheories: [
      { theory: "Wire fraud / securities fraud", jurisdiction: "United States (18 U.S.C. § 1343)", elements: ["Material misrepresentation in token promotion", "Use of electronic communication (X/Twitter)", "Pecuniary loss to victims", "Interstate or foreign commerce nexus"], strength: "STRONG" },
      { theory: "Fraud / misrepresentation", jurisdiction: "Canada (Criminal Code s.380)", elements: ["Subject self-identified as Toronto-based", "Dione Protocol LLC — Canadian entity", "Undisclosed insider allocation to family/friends", "Public promotion without disclosure of financial interest"], strength: "STRONG" },
      { theory: "AML — VASP obligations", jurisdiction: "Multi-jurisdiction", elements: ["Proceeds moved through mixer/relay network", "CEX deposit without apparent SAR filing", "Structuring pattern (50+ senders to single destination)"], strength: "MEDIUM" },
      { theory: "Deceptive commercial practices (MiCA / AMF)", jurisdiction: "EU / France", elements: ["EU investors potentially affected", "Cross-border digital asset promotion", "Undisclosed material conflicts of interest"], strength: "DEVELOPING" },
    ],
    nextSteps: [
      "File victim intake form via INTERLIGENS victim reporting system",
      "Retain counsel in primary jurisdictions (US + Canada)",
      "Submit exchange preservation requests to TITAN EXCHANGE + ET3F",
      "File SAR with FinCEN (US) and FINTRAC (Canada)",
      "Prepare MLAT request for cross-border KYC disclosure",
      "Consolidate victim affidavits for class certification",
      "File AMF report if French-domiciled victims identified",
    ],
  };

  return NextResponse.json({ classAction: pkg });
}
