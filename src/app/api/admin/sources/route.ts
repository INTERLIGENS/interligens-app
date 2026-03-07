import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuth } from "@/lib/security/auth";

export async function GET(req: NextRequest) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = 50;
  const [sources, total] = await Promise.all([
    prisma.sourceRegistry.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sourceRegistry.count(),
  ]);
  return NextResponse.json({ sources, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { handle, sourceName, sourceType, homepageUrl, description,
          defaultChain, defaultLabelType, defaultLabel, defaultVisibility,
          license, tosRisk } = body;

  if (!sourceName) return NextResponse.json({ error: "sourceName required" }, { status: 400 });

  const source = await prisma.sourceRegistry.create({
    data: {
      name: sourceName,
      handle: handle ?? null,
      sourceName,
      sourceType: sourceType ?? "other",
      url: homepageUrl ?? null,
      homepageUrl: homepageUrl ?? null,
      description: description ?? null,
      defaultChain: defaultChain ?? null,
      defaultLabelType: defaultLabelType ?? null,
      defaultLabel: defaultLabel ?? null,
      defaultVisibility: defaultVisibility ?? "internal_only",
      license: license ?? null,
      tosRisk: tosRisk ?? "low",
      status: "active",
    },
  });
  return NextResponse.json(source, { status: 201 });
}
