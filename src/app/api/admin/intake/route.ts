import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";
import { requireSalt } from "@/lib/config/requireSalt";
import { extractFromUrl, extractFromFile, extractFromText } from "@/lib/intake/extract";
import { routeIntake } from "@/lib/intake/router";

// Sel des ipHash / userAgentHash stockés sur IntakeRecord.
//
// CC-OFFLINE-217 — SÉPARATION DES AUTORITÉS DE SECRET.
// Ces deux colonnes dépendent DÉSORMAIS EXCLUSIVEMENT d'INTAKE_HASH_SALT.
// Aucun repli vers ADMIN_TOKEN, sous aucune forme : ni `||`, ni `??`, ni
// second appel en rattrapage. Un credential d'authentification ne doit pas
// servir de clé de pseudonymisation — et ADMIN_TOKEN portait ici les DEUX
// fonctions à la fois, sans même une variable d'indirection à geler.
//
// POURQUOI « HASH » ET NON « IP » DANS LE NOM : la route hache deux sujets,
// l'adresse ET l'user-agent. Le nom suit la convention du dépôt
// (VAULT_AUDIT_SALT, IP_HASH_SALT, OSINT_RETAIL_IP_SALT) sans mentir sur la
// portée.
//
// FAIL CLOSED, ASSUMÉ. requireSalt lève si la variable manque : la requête
// échoue plutôt que de hacher sous une clé d'emprunt. Nous sommes précisément
// dans la fenêtre où les autorités sont séparées AVANT que l'ancien credential
// soit tué ; un secret absent refuse, il n'emprunte pas.
//
// Le repli littéral "secret" avait déjà été retiré ici : il clait le HMAC sur
// une chaîne publique, donc les IP et user-agents redevenaient ré-identifiables
// par table.
function hmac(val: string): string {
  return createHmac("sha256", requireSalt("INTAKE_HASH_SALT")).update(val).digest("hex");
}

// ── POST /api/admin/intake ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const ipHash = hmac(req.headers.get("x-forwarded-for") ?? "unknown");
  const uaHash = hmac(req.headers.get("user-agent") ?? "unknown");

  let type: string, provenance: Record<string,unknown> = {};
  let url: string | undefined, text: string | undefined;
  let fileBuffer: Buffer | undefined, mime: string | undefined, filename: string | undefined, sizeBytes = 0;

  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    type = form.get("type") as string ?? "file";
    const raw = form.get("provenance");
    if (raw) try { provenance = JSON.parse(raw as string); } catch {}
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    mime     = file.type;
    filename = file.name;
    sizeBytes = file.size;
    fileBuffer = Buffer.from(await file.arrayBuffer());
  } else {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    type = body.type;
    provenance = body.provenance ?? {};
    url  = body.url;
    text = body.text;
  }

  // create pending record
  const intake = await prisma.intakeRecord.create({
    data: {
      status:    "pending",
      inputType: type ?? "text",
      sourceRef: url ?? filename ?? null,
      submittedBy: (provenance.investigatorHandle as string) ?? "david",
      provenance: JSON.stringify(provenance),
      ipHash, userAgentHash: uaHash,
    },
  });

  // extraction
  let extractResult;
  try {
    if (type === "url" && url) {
      extractResult = await extractFromUrl(url);
    } else if (type === "file" && fileBuffer) {
      extractResult = await extractFromFile(fileBuffer, mime ?? "application/octet-stream", filename ?? "upload", sizeBytes);
    } else if (type === "text" && text) {
      extractResult = await extractFromText(text);
    } else {
      await prisma.intakeRecord.update({ where: { id: intake.id }, data: { status: "failed", extractWarnings: JSON.stringify(["Missing payload"]) } });
      return NextResponse.json({ error: "type or payload missing" }, { status: 400 });
    }
  } catch (e: unknown) {
    const err = e as Error & { status?: number; code?: string };
    await prisma.intakeRecord.update({ where: { id: intake.id }, data: { status: "failed", extractWarnings: JSON.stringify([err.message]) } });
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status ?? 422 });
  }

  // route
  const routeResult = await routeIntake(intake.id, extractResult.extracted, extractResult.parserUsed);

  // update record
  await prisma.intakeRecord.update({
    where: { id: intake.id },
    data: {
      status:          routeResult.linkedBatchId ? "routed" : routeResult.pendingBatch ? "needs_manual" : routeResult.classification === "rawdoc" ? "needs_manual" : "routed",
      parserUsed:      extractResult.parserUsed,
      rawText:         extractResult.rawText ?? null,
      rawTextTruncated: extractResult.rawTextTruncated,
      extracted:       JSON.stringify(extractResult.extracted),
      classification:  routeResult.classification,
      routerConfidence: routeResult.confidence,
      extractWarnings: JSON.stringify(extractResult.warnings),
      pendingBatch:    routeResult.pendingBatch,
      linkedBatchId:   routeResult.linkedBatchId ?? null,
    },
  });

  // audit
  await prisma.auditLog.create({ data: { action: "INTAKE_CREATED", actorId: (provenance.investigatorHandle as string) ?? "david", meta: JSON.stringify({ intakeId: intake.id, classification: routeResult.classification }) } });
  await prisma.auditLog.create({ data: { action: "INTAKE_ROUTED",  actorId: (provenance.investigatorHandle as string) ?? "david", batchId: routeResult.linkedBatchId ?? null, meta: JSON.stringify({ intakeId: intake.id, classification: routeResult.classification, confidence: routeResult.confidence }) } });

  return NextResponse.json({
    ok: true,
    intakeId:        intake.id,
    status:          routeResult.linkedBatchId ? "routed" : "needs_manual",
    classification:  routeResult.classification,
    routerConfidence: routeResult.confidence,
    linkedBatchId:   routeResult.linkedBatchId ?? null,
    pendingBatch:    routeResult.pendingBatch,
    addressCount:    extractResult.extracted.addresses.length,
    handleCount:     extractResult.extracted.handles.length,
    warnings:        extractResult.warnings,
  });
}

// ── GET /api/admin/intake ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const status         = searchParams.get("status") ?? undefined;
  const classification = searchParams.get("classification") ?? undefined;
  const page           = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 25;

  const where: Record<string,unknown> = {};
  if (status)         where.status         = status;
  if (classification) where.classification = classification;

  const [total, records] = await Promise.all([
    prisma.intakeRecord.count({ where }),
    prisma.intakeRecord.findMany({
      where, orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit, take: limit,
      select: { id:true, createdAt:true, status:true, inputType:true, sourceRef:true,
        classification:true, routerConfidence:true, linkedBatchId:true, pendingBatch:true,
        extractWarnings:true, submittedBy:true, provenance:true },
    }),
  ]);

  return NextResponse.json({ records, total, page, pages: Math.ceil(total / limit) });
}
