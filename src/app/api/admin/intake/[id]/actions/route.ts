import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { extractFromUrl, extractFromText, extractFromFile } from "@/lib/intake/extract";
import { routeIntake } from "@/lib/intake/router";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const { id } = await params;

  const { action } = await req.json().catch(() => ({}));
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  const record = await prisma.intakeRecord.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── archive ──────────────────────────────────────────────────────────────
  if (action === "archive") {
    await prisma.intakeRecord.update({ where: { id }, data: { status: "archived" } });
    return NextResponse.json({ ok: true, status: "archived" });
  }

  // ── rerun_extract ────────────────────────────────────────────────────────
  if (action === "rerun_extract") {
    let extractResult;
    try {
      if (record.inputType === "url" && record.sourceRef) {
        extractResult = await extractFromUrl(record.sourceRef);
      } else if (record.rawText) {
        extractResult = await extractFromText(record.rawText);
      } else {
        return NextResponse.json({ error: "No source to re-extract from" }, { status: 400 });
      }
    } catch (e: unknown) {
      const err = e as Error;
      return NextResponse.json({ error: err.message }, { status: 422 });
    }

    const currentVersion = record.extractVersion ?? "v1";
    const vNum = parseInt(currentVersion.replace("v", "")) || 1;
    const newVersion = `v${vNum + 1}`;

    await prisma.intakeRecord.update({
      where: { id },
      data: {
        extracted:        JSON.stringify(extractResult.extracted),
        extractWarnings:  JSON.stringify(extractResult.warnings),
        rawText:          extractResult.rawText ?? null,
        rawTextTruncated: extractResult.rawTextTruncated,
        extractVersion:   newVersion,
        // DO NOT touch linkedBatchId or linkedBatchId2
      },
    });

    await prisma.auditLog.create({ data: { action: "INTAKE_RERUN", actorId: "david", meta: JSON.stringify({ intakeId: id, version: newVersion }) } });

    return NextResponse.json({
      ok: true, extractVersion: newVersion,
      addressCount: extractResult.extracted.addresses.length,
      handleCount:  extractResult.extracted.handles.length,
      warnings:     extractResult.warnings,
    });
  }

  // ── push_to_vault ─────────────────────────────────────────────────────────
  if (action === "push_to_vault") {
    if (!record.pendingBatch && record.linkedBatchId) {
      return NextResponse.json({ error: "Batch already exists. Use linkedBatchId." }, { status: 400 });
    }

    const extracted = JSON.parse(record.extracted || "{}");
    if (!extracted.addresses?.length) {
      return NextResponse.json({ error: "No addresses to push" }, { status: 400 });
    }

    const routeResult = await routeIntake(id, extracted, record.parserUsed);

    // pick the right batch field
    const batchField = !record.linkedBatchId ? "linkedBatchId" : "linkedBatchId2";
    await prisma.intakeRecord.update({
      where: { id },
      data: {
        [batchField]:  routeResult.linkedBatchId ?? null,
        pendingBatch:  false,
        status:        "routed",
      },
    });

    await prisma.auditLog.create({ data: { action: "INTAKE_PUSH_TO_VAULT", actorId: "david", batchId: routeResult.linkedBatchId ?? null, meta: JSON.stringify({ intakeId: id }) } });

    return NextResponse.json({ ok: true, linkedBatchId: routeResult.linkedBatchId, batchField });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
