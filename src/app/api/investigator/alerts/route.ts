import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorSession } from "@/lib/security/investigatorAuth";
import { getPublishedAlerts } from "@/lib/investigator/registry";

export async function GET(req: NextRequest) {
  const deny = await requireInvestigatorSession(req);
  if (deny) return deny;

  return NextResponse.json({ alerts: getPublishedAlerts() });
}
