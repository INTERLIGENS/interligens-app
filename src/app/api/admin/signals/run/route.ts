/**
 * src/app/api/admin/signals/run/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { detectAllInfluencers } from "@/lib/surveillance/signals/detectSellWhileShilling";
import { updateAllScores } from "@/lib/surveillance/signals/recidivismScore";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const sinceDays = parseInt(searchParams.get("sinceDays") ?? "30");

  const detection = await detectAllInfluencers(sinceDays);
  const scores = await updateAllScores();

  return NextResponse.json({ detection, scoresUpdated: scores.length });
}
