import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorApi } from "@/lib/security/investigatorAuth";
import {
  DEMO_WATCHLIST,
  DEMO_PROOFS,
  aggregateSignalsForHandle,
  signalPriority,
} from "@/lib/osint/watchlist";

export async function GET(req: NextRequest) {
  const deny = requireInvestigatorApi(req);
  if (deny) return deny;

  const alerts = DEMO_WATCHLIST
    .filter((w) => w.isWatched)
    .map((w) => {
      const signals = aggregateSignalsForHandle(w.handle);
      return {
        handle: w.handle,
        displayName: w.displayName,
        category: w.category,
        whyTracked: w.whyTracked,
        signals,
        priority: signalPriority(signals),
        proofCount: (DEMO_PROOFS[w.handle] ?? []).length,
      };
    })
    .sort((a, b) => b.priority - a.priority);

  return NextResponse.json({ alerts });
}
