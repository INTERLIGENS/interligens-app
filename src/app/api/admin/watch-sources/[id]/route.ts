import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { checkSource } from "@/lib/intake/watcher";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const { id } = await params;
  await prisma.watchSource.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const { id } = await params;
  const { action } = await req.json();

  if (action === "check_now") {
    const source = await prisma.watchSource.findUnique({ where: { id } });
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const intakeId = await checkSource({
      id: source.id, name: source.name, url: source.url,
      investigator: source.investigator,
      tags: JSON.parse(source.tags || "[]"),
      lastHash: source.lastHash ?? undefined,
    });
    await prisma.watchSource.update({
      where: { id },
      data: { lastChecked: new Date(), lastIntakeId: intakeId ?? source.lastIntakeId, errorCount: 0 },
    });
    return NextResponse.json({ ok: true, intakeId, status: intakeId ? "new_content" : "unchanged" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
