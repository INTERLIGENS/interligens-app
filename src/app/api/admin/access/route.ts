import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { sendAccessCodeEmail } from "@/lib/email/accessCodeDelivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashSHA256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// GET /api/admin/access — list all access codes with session counts
export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const accesses = await prisma.investigatorAccess.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });

  return NextResponse.json({ accesses });
}

// POST /api/admin/access
// Body variants:
//   { action: "create", label, notes?, email?, recipientName? }
//   { action: "regenerate", id, email?, recipientName? }
//   { action: "email", id, email, recipientName? }
//   { action: "revoke", id }
export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action as string | undefined;

  if (action === "create") {
    const label = (body.label as string | undefined)?.trim();
    if (!label) {
      return NextResponse.json({ error: "label_required" }, { status: 400 });
    }
    const notes = (body.notes as string | undefined)?.trim() ?? null;
    const email = (body.email as string | undefined)?.trim();
    const recipientName = (body.recipientName as string | undefined)?.trim();

    const code = randomBytes(16).toString("hex");
    const codeHash = hashSHA256(code);

    const access = await prisma.investigatorAccess.create({
      data: { label, accessCodeHash: codeHash, notes },
    });

    let emailResult = null;
    if (email) {
      emailResult = await sendAccessCodeEmail({
        email,
        accessCode: code,
        label,
        name: recipientName,
      });
    }

    return NextResponse.json({ id: access.id, label, code, emailResult });
  }

  if (action === "regenerate") {
    const id = (body.id as string | undefined)?.trim();
    if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

    const access = await prisma.investigatorAccess.findUnique({ where: { id } });
    if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const newCode = randomBytes(16).toString("hex");
    const newHash = hashSHA256(newCode);

    await prisma.investigatorAccess.update({
      where: { id },
      data: { accessCodeHash: newHash },
    });
    await prisma.investigatorSession.updateMany({
      where: { investigatorAccessId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const email = (body.email as string | undefined)?.trim();
    const recipientName = (body.recipientName as string | undefined)?.trim();

    let emailResult = null;
    if (email) {
      emailResult = await sendAccessCodeEmail({
        email,
        accessCode: newCode,
        label: access.label,
        name: recipientName,
      });
    }

    return NextResponse.json({ id, label: access.label, code: newCode, emailResult });
  }

  if (action === "email") {
    const id = (body.id as string | undefined)?.trim();
    const email = (body.email as string | undefined)?.trim();
    if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

    // We cannot retrieve the plaintext code — caller must provide it or use regenerate.
    const code = (body.code as string | undefined)?.trim();
    if (!code) {
      return NextResponse.json(
        { error: "code_required — use regenerate to get a new plaintext code" },
        { status: 400 }
      );
    }

    const access = await prisma.investigatorAccess.findUnique({ where: { id } });
    if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const recipientName = (body.recipientName as string | undefined)?.trim();
    const emailResult = await sendAccessCodeEmail({
      email,
      accessCode: code,
      label: access.label,
      name: recipientName,
    });

    return NextResponse.json({ emailResult });
  }

  if (action === "revoke") {
    const id = (body.id as string | undefined)?.trim();
    if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

    await prisma.investigatorAccess.update({
      where: { id },
      data: { isActive: false },
    });
    await prisma.investigatorSession.updateMany({
      where: { investigatorAccessId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ revoked: id });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
