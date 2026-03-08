import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json();
  const allowed = ["handle","sourceName","sourceType","homepageUrl","description",
                   "defaultChain","defaultLabelType","defaultLabel","defaultVisibility",
                   "license","tosRisk","status","trusted"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  if ("sourceName" in data) data["name"] = data["sourceName"];

  const source = await prisma.sourceRegistry.update({
    where: { id: (await params).id },
    data,
  });
  return NextResponse.json(source);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const deny = requireAdminApi(req);
  if (deny) return deny;

  await prisma.sourceRegistry.update({
    where: { id: (await params).id },
    data: { status: "paused" },
  });
  return NextResponse.json({ deleted: true, id: (await params).id });
}
