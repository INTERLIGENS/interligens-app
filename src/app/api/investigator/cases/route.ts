import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorSession } from "@/lib/security/investigatorAuth";
import { getPublishedCases, getPdfsForCase, getProceedsForCase } from "@/lib/investigator/registry";

export async function GET(req: NextRequest) {
  const deny = await requireInvestigatorSession(req);
  if (deny) return deny;

  const cases = getPublishedCases().map((c) => ({
    ...c,
    pdfs: getPdfsForCase(c.id).map((p) => ({ id: p.id, title: p.title, language: p.language })),
    proceedsCount: getProceedsForCase(c.id).length,
    totalProceeds: getProceedsForCase(c.id).reduce((sum, p) => sum + p.usdValue, 0),
  }));

  return NextResponse.json({ cases });
}
