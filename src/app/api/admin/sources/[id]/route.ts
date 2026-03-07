import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuth } from "@/lib/security/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = ["handle","sourceName","sourceType","homepageUrl","description",
                   "defaultChain","defaultLabelType","defaultLabel","defaultVisibility",
                   "license","tosRisk","status","trusted"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  if ("sourceName" in data) data["name"] = data["sourceName"];

  const source = await prisma.sourceRegistry.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(source);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.sourceRegistry.update({
    where: { id: params.id },
    data: { status: "paused" },
  });
  return NextResponse.json({ deleted: true, id: params.id });
}
