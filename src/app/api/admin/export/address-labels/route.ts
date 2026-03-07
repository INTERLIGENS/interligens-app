import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuth } from "@/lib/security/auth";

const EXPORT_MAX_ROWS = parseInt(process.env.EXPORT_MAX_ROWS ?? "250000");
const ALLOW_ENTITY_EXPORT = process.env.ALLOW_ENTITY_EXPORT === "true";

export async function GET(req: NextRequest) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const includeEntityName = ALLOW_ENTITY_EXPORT &&
    req.nextUrl.searchParams.get("includeEntityName") === "1";

  const total = await prisma.addressLabel.count();
  if (total > EXPORT_MAX_ROWS) {
    return NextResponse.json({ error: "too large", rows: total, max: EXPORT_MAX_ROWS }, { status: 413 });
  }

  const rows = await prisma.addressLabel.findMany({
    select: {
      address: true, chain: true, labelType: true, label: true,
      confidence: true, sourceUrl: true, visibility: true, license: true,
      tosRisk: true, firstSeenAt: true, lastSeenAt: true,
      ...(includeEntityName ? { entityName: true } : {}),
    },
    orderBy: { firstSeenAt: "desc" },
  });

  await prisma.auditLog.create({
    data: {
      action: "EXPORT_ADDRESS_LABELS",
      actorId: "admin",
      meta: JSON.stringify({ format, rows: rows.length }),
    },
  });

  if (format === "csv") {
    const cols = ["address","chain","labelType","label","confidence","sourceUrl",
                  "visibility","license","tosRisk","firstSeenAt","lastSeenAt","createdAt",
                  ...(includeEntityName ? ["entityName"] : [])];
    const csv = [
      cols.join(","),
      ...rows.map(r => cols.map(c => JSON.stringify((r as Record<string,unknown>)[c] ?? "")).join(",")),
    ].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="address-labels-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ rows, total: rows.length, includeEntityName });
}
