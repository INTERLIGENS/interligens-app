import { NextResponse } from "next/server";
import { DEMO_WATCHLIST, DEMO_PROOFS, aggregateSignalsForHandle, signalPriority } from "@/lib/osint/watchlist";

export const dynamic = "force-dynamic";

export interface Insight {
  id: string;
  handle: string;
  title: string;
  summary: string;
  signals: { ctaDangerous?: boolean; domainRisk?: boolean; caDetected?: boolean; narrativeSpike?: boolean };
  proofUrls: string[];
  updatedAt: string;
}

export async function GET() {
  const insights: Insight[] = Object.keys(DEMO_PROOFS).map((handle) => {
    const signals = aggregateSignalsForHandle(handle);
    const proofs = DEMO_PROOFS[handle] ?? [];
    const entry = DEMO_WATCHLIST.find((e) => e.handle === handle);
    const labels = [
      signals.ctaDangerous && "dangerous CTA",
      signals.domainRisk && "pump.fun / domain risk",
      signals.caDetected && "CA detected",
      signals.narrativeSpike && "narrative spike",
    ].filter(Boolean) as string[];
    return {
      id: `osint-${handle.toLowerCase()}`,
      handle,
      title: labels.length ? `@${handle} — ${labels.join(", ")}` : `@${handle} — observed patterns`,
      summary: `Public signals from @${handle}: ${labels.length ? labels.join(", ") : "general activity"}. ${proofs.length} proof link${proofs.length !== 1 ? "s" : ""}. Tracked as: ${entry?.whyTracked ?? "observable patterns"}.`,
      signals,
      proofUrls: proofs.map((p) => p.url),
      updatedAt: new Date().toISOString(),
    };
  }).sort((a, b) => signalPriority(b.signals as any) - signalPriority(a.signals as any));

  return NextResponse.json({ count: insights.length, mode: process.env.OSINT_MODE ?? "fixtures", insights });
}
