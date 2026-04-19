import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { MmStatus } from "@/lib/mm/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

const ALLOWED_STATUS: MmStatus[] = [
  "CONVICTED",
  "CHARGED",
  "SETTLED",
  "INVESTIGATED",
  "DOCUMENTED",
  "OBSERVED",
];

function clampInt(value: string | null, min: number, max: number, fallback: number) {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get("limit"), 1, 100, 50);
  const offset = clampInt(url.searchParams.get("offset"), 0, 100000, 0);
  const statusParam = url.searchParams.get("status");
  const bandParam = url.searchParams.get("band");

  const admin =
    url.searchParams.get("admin") === "1" &&
    req.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;

  const where: {
    workflow?: { in: ("PUBLISHED" | "CHALLENGED")[] };
    status?: MmStatus;
    riskBand?: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  } = {};

  if (!admin) {
    where.workflow = { in: ["PUBLISHED", "CHALLENGED"] };
  }

  if (statusParam && ALLOWED_STATUS.includes(statusParam as MmStatus)) {
    where.status = statusParam as MmStatus;
  }
  if (bandParam && ["GREEN", "YELLOW", "ORANGE", "RED"].includes(bandParam)) {
    where.riskBand = bandParam as "GREEN" | "YELLOW" | "ORANGE" | "RED";
  }

  const [total, entities] = await Promise.all([
    prisma.mmEntity.count({ where }),
    prisma.mmEntity.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        slug: true,
        name: true,
        legalName: true,
        jurisdiction: true,
        status: true,
        riskBand: true,
        defaultScore: true,
        publicSummary: true,
        publicSummaryFr: true,
        knownAliases: true,
        workflow: true,
        publishedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    version: "1.0",
    total,
    limit,
    offset,
    entities,
    meta: {
      methodologyUrl: "/mm/methodology",
      legalUrl: "/mm/legal",
      adminOnlyIncludesDrafts: admin,
    },
  });
}
