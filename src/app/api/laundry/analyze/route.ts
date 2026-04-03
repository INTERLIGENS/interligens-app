import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeLaundryTrail } from "@/lib/laundry/engine";
import { validateLaundryOutput } from "@/lib/laundry/guardrails";
import { requireAdminApi } from "@/lib/security/adminAuth";

export async function POST(req: NextRequest) {
  const authError = requireAdminApi(req);
  if (authError) return authError;

  const body = await req.json();
  const { walletAddress, chain, hops, kolHandle, narrativeText } = body;

  if (!walletAddress || !chain || !Array.isArray(hops)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (narrativeText) validateLaundryOutput(narrativeText);

  const output = await analyzeLaundryTrail(walletAddress, chain, hops);

  const trail = await prisma.laundryTrail.create({
    data: {
      walletAddress: output.walletAddress,
      chain: output.chain,
      trailType: output.trailType,
      laundryRisk: output.laundryRisk,
      recoveryDifficulty: output.recoveryDifficulty,
      trailBreakHop: output.trailBreakHop ?? null,
      fundsUnresolved: output.fundsUnresolved ?? null,
      narrativeText: narrativeText ?? null,
      evidenceNote: output.evidenceNote,
      kolHandle: kolHandle ?? null,
      signals: {
        create: output.signals.map(s => ({
          family: s.family,
          confirmed: s.confirmed,
          severity: s.severity,
          detail: s.detail,
          rawData: (s.rawData ?? {}) as any,
        })),
      },
    },
    include: { signals: true },
  });

  return NextResponse.json({ success: true, trailId: trail.id });
}
