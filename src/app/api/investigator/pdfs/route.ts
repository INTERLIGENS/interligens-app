import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorSession } from "@/lib/security/investigatorAuth";
import { getPublishedPdfs } from "@/lib/investigator/registry";

export async function GET(req: NextRequest) {
  const deny = await requireInvestigatorSession(req);
  if (deny) return deny;

  const pdfs = getPublishedPdfs().map((p) => ({
    id: p.id,
    title: p.title,
    language: p.language,
    version: p.version,
    publishedAt: p.publishedAt,
    fileSize: p.fileSize,
    relatedCaseId: p.relatedCaseId,
    downloadUrl: `/api/investigator/pdfs/download?file=${encodeURIComponent(p.filename)}`,
  }));

  return NextResponse.json({ pdfs });
}
