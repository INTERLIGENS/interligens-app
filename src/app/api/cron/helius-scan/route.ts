// src/app/api/cron/helius-scan/route.ts
// Cron: for every published KolProfile, re-run the on-chain proceeds scan via
// the existing computeProceedsForHandle helper (Helius-backed). When the event
// count changes vs. the last snapshot, regenerate the PDF dossier. Always
// stamps lastHeliusScan so the admin UI can surface staleness.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeProceedsForHandle } from "@/lib/kol/proceeds";
import { generateCasePdf } from "@/lib/pdf/engine";

export const runtime = "nodejs";
export const maxDuration = 300;

type ScanRow = {
  handle: string;
  beforeEventCount: number;
  afterEventCount: number;
  totalProceedsUsd: number;
  scanError?: string;
  pdfScore?: number;
  pdfUrl?: string;
  pdfError?: string;
};

async function countEvents(handle: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c FROM "KolProceedsEvent" WHERE "kolHandle" = ${handle}
  `;
  return Number(rows[0]?.c ?? 0);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const handleFilter = url.searchParams.get("handle");

  const profiles = await prisma.kolProfile.findMany({
    where: handleFilter
      ? { handle: handleFilter }
      : { publishStatus: "published" },
    select: { handle: true },
    orderBy: { handle: "asc" },
  });

  const rows: ScanRow[] = [];
  const startedAt = new Date();

  for (const p of profiles) {
    const handle = p.handle;
    const before = await countEvents(handle);

    let totalProceedsUsd = 0;
    let scanError: string | undefined;
    try {
      const r = await computeProceedsForHandle(handle);
      totalProceedsUsd = r.totalProceedsUsd;
      if (!r.success && r.error) scanError = r.error;
    } catch (e) {
      scanError = e instanceof Error ? e.message : String(e);
    }

    const after = await countEvents(handle);
    const row: ScanRow = {
      handle,
      beforeEventCount: before,
      afterEventCount: after,
      totalProceedsUsd,
    };
    if (scanError) row.scanError = scanError;

    if (after !== before) {
      const pdf = await generateCasePdf(handle);
      if (pdf.success) {
        row.pdfScore = pdf.score;
        row.pdfUrl = pdf.pdfUrl;
      } else {
        row.pdfError = pdf.error;
      }
    }

    await prisma.kolProfile.update({
      where: { handle },
      data: { lastHeliusScan: new Date() },
    });

    rows.push(row);
    await new Promise((res) => setTimeout(res, 250));
  }

  return NextResponse.json({
    scannedAt: startedAt.toISOString(),
    profilesScanned: rows.length,
    pdfsRegenerated: rows.filter((r) => r.pdfUrl).length,
    results: rows,
  });
}
