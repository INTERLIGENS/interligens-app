/**
 * src/app/api/admin/casefiles/generate/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { generateCaseFile } from "@/lib/surveillance/reports/generateCaseFile";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { signalId } = await req.json();
  if (!signalId) return NextResponse.json({ error: "signalId required" }, { status: 400 });

  const result = await generateCaseFile(signalId);
  return NextResponse.json(result);
}
