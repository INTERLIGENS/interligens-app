import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import {
  buildBotifyEvidenceRows,
  rowsToCsv,
  loadBotifyDbEnrichment,
  type BotifyCase,
} from "@/scripts/export/botifySpreadsheet";
// Static import of the canonical case file (the data/ copy carries the
// detective_trade block; the src/data copy does not). A literal relative
// import is traced by webpack and bundled into the serverless function.
import botifyCaseJson from "../../../../../../data/cases/botify.json";

export const dynamic = "force-dynamic";

// Admin-only download: returns the BOTIFY evidence table as an attachment.
export async function GET(req: NextRequest) {
  const auth = requireAdminApi(req);
  if (auth) return auth;

  const caseData = botifyCaseJson as unknown as BotifyCase;
  const db = await loadBotifyDbEnrichment(caseData.case_meta.case_id);
  const rows = buildBotifyEvidenceRows(caseData, db);
  const csv = rowsToCsv(rows);

  // Prefix BOM so Excel reads UTF-8 dashes/accents correctly.
  return new NextResponse("﻿" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="BOTIFY_EVIDENCE_TABLE.csv"',
      "Cache-Control": "no-store",
    },
  });
}
