import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const sources = await prisma.watchSource.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { name, url, investigator, tags } = await req.json();
  if (!name || !url) return NextResponse.json({ error: "name and url required" }, { status: 400 });

  const source = await prisma.watchSource.create({
    data: { name, url, investigator: investigator ?? "@david", tags: JSON.stringify(tags ?? []) },
  });

  return NextResponse.json({ ok: true, source });
}
