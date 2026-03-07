import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuth } from "@/lib/security/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await prisma.sourceTemplate.findMany({ where: { sourceId: (await params).id } });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { inputType, columnMapping, rules } = body;
  if (!inputType || !columnMapping) return NextResponse.json({ error: "inputType and columnMapping required" }, { status: 400 });
  const tpl = await prisma.sourceTemplate.create({
    data: { sourceId: (await params).id, inputType, columnMapping: JSON.stringify(columnMapping), rules: rules ? JSON.stringify(rules) : null },
  });
  return NextResponse.json(tpl, { status: 201 });
}
