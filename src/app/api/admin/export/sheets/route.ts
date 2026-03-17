import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/export/sheets
 * Exports address labels to a Google Sheet via Apps Script webhook.
 * 
 * Setup:
 * 1. Create a Google Sheet
 * 2. Extensions → Apps Script → paste the webhook code (see GOOGLE_APPS_SCRIPT_URL env)
 * 3. Deploy as web app (anyone can access)
 * 4. Set GOOGLE_APPS_SCRIPT_URL in Vercel env
 */

const EXPORT_MAX_ROWS = 10000;

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return NextResponse.json({
      error: "GOOGLE_APPS_SCRIPT_URL not configured",
      setup: "See /admin/export for setup instructions",
    }, { status: 503 });
  }

  const { filter } = await req.json().catch(() => ({}));

  const where: Record<string,unknown> = { isActive: true };
  if (filter?.chain)      where.chain     = filter.chain;
  if (filter?.labelType)  where.labelType = filter.labelType;
  if (filter?.confidence) where.confidence = filter.confidence;

  const rows = await prisma.addressLabel.findMany({
    where,
    select: {
      address: true, chain: true, labelType: true, label: true,
      confidence: true, sourceName: true, firstSeenAt: true,
    },
    orderBy: { firstSeenAt: "desc" },
    take: EXPORT_MAX_ROWS,
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to export" }, { status: 400 });
  }

  // Push to Google Sheets via Apps Script
  const payload = {
    headers: ["address", "chain", "labelType", "label", "confidence", "sourceName", "firstSeenAt"],
    rows: rows.map(r => [
      r.address, r.chain, r.labelType, r.label,
      r.confidence, r.sourceName,
      new Date(r.firstSeenAt).toISOString(),
    ]),
    sheetName: `Intel Vault ${new Date().toLocaleDateString("fr-FR")}`,
  };

  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "Apps Script error", detail: text }, { status: 502 });
  }

  await prisma.auditLog.create({
    data: {
      action: "EXPORT_TO_SHEETS",
      actorId: "admin",
      meta: JSON.stringify({ rows: rows.length, filter }),
    },
  });

  const result = await res.json().catch(() => ({}));

  return NextResponse.json({
    ok: true,
    rowsExported: rows.length,
    sheetUrl: result.sheetUrl ?? null,
  });
}
