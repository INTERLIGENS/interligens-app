import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const deny = requireAdminApi(req);
  if (deny) return deny;
  const templates = await prisma.sourceTemplate.findMany({ where: { sourceId: (await params).id } });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const deny = requireAdminApi(req);
  if (deny) return deny;
  const body = await req.json();
  const { inputType, columnMapping, rules } = body;
  if (!inputType || !columnMapping) return NextResponse.json({ error: "inputType and columnMapping required" }, { status: 400 });
  const tpl = await prisma.sourceTemplate.create({
    data: { sourceId: (await params).id, inputType, columnMapping: JSON.stringify(columnMapping), rules: rules ? JSON.stringify(rules) : null },
  });
  return NextResponse.json(tpl, { status: 201 });
}
