import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CaseExportFormat } from "@prisma/client";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import {
  buildCaseIocs,
  filterIocsByPublishability,
  FORMAT_PUBLISHABILITY_RULES,
  type IocPublishability,
} from "@/lib/vault/iocExportBuilder";
import { computeExportHash } from "@/lib/vault/iocExportHash";
import {
  serializeCsvFull,
  serializeJsonStructured,
  serializeStixLike,
  serializeThreatIntelCsv,
} from "@/lib/vault/iocExportFormats";
import { buildPoliceAnnexHtml, renderPoliceAnnexPdf } from "@/lib/vault/iocExportPdf";

type RouteCtx = { params: Promise<{ caseId: string }> };

const VALID_FORMATS = new Set<CaseExportFormat>([
  "CSV_FULL",
  "JSON_STRUCTURED",
  "STIX_LIKE_JSON",
  "POLICE_ANNEX_PDF",
  "THREAT_INTEL_CSV",
]);

const FORMAT_MIME: Record<CaseExportFormat, string> = {
  CSV_FULL: "text/csv",
  JSON_STRUCTURED: "application/json",
  STIX_LIKE_JSON: "application/json",
  POLICE_ANNEX_PDF: "application/pdf",
  THREAT_INTEL_CSV: "text/csv",
};

const FORMAT_EXT: Record<CaseExportFormat, string> = {
  CSV_FULL: "csv",
  JSON_STRUCTURED: "json",
  STIX_LIKE_JSON: "json",
  POLICE_ANNEX_PDF: "pdf",
  THREAT_INTEL_CSV: "csv",
};

// ── GET — list past exports for this case ─────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  try {
    const exports = await prisma.caseExport.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        exportFormat: true,
        exportedBy: true,
        includedCounts: true,
        iocCount: true,
        snapshotCount: true,
        privateExcluded: true,
        contentHashSha256: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ exports });
  } catch (err) {
    console.error("[exports] list failed", err);
    return NextResponse.json({ exports: [] });
  }
}

// ── POST — generate an investigative export ───────────────────────────────────

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));

  // Validate format
  const formatRaw = typeof body.format === "string" ? body.format.toUpperCase() : "";
  if (!VALID_FORMATS.has(formatRaw as CaseExportFormat)) {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }
  const format = formatRaw as CaseExportFormat;

  // Optional client-side decrypted title (server cannot decrypt)
  const caseTitle =
    typeof body.caseTitle === "string"
      ? body.caseTitle.slice(0, 500).trim() || "Investigator Casefile"
      : "Investigator Casefile";

  // Only JSON_STRUCTURED may include PRIVATE — and only if explicitly requested
  const includePrivate =
    format === "JSON_STRUCTURED" && body.includePrivate === true;

  // Build IOC list from DB
  const buildResult = await buildCaseIocs(caseId);

  // Determine publishability filter
  let allowedPublishability: IocPublishability[];
  if (includePrivate) {
    allowedPublishability = ["PRIVATE", "SHAREABLE", "PUBLISHABLE", "REDACTED"];
  } else {
    allowedPublishability = FORMAT_PUBLISHABILITY_RULES[format] as IocPublishability[];
  }

  const { included, privateExcluded } = filterIocsByPublishability(
    buildResult.iocs,
    allowedPublishability
  );

  const generatedAt = new Date().toISOString();
  const exportHash = computeExportHash(included);

  // Compute per-type counts for metadata
  const byType: Record<string, number> = {};
  for (const ioc of included) {
    byType[ioc.type] = (byType[ioc.type] ?? 0) + 1;
  }
  const snapshotCount = included.filter((i) => i.type === "EVIDENCE_SNAPSHOT").length;

  // Serialize content
  let contentText: string | null = null;
  let contentBase64: string | null = null;

  const exportId = crypto.randomUUID();

  if (format === "CSV_FULL") {
    contentText = serializeCsvFull(included);
  } else if (format === "JSON_STRUCTURED") {
    contentText = serializeJsonStructured(
      included,
      buildResult.rawSnapshots,
      {
        exportId,
        caseId,
        caseTitle,
        workspaceId: ctx.workspace.id,
        generatedAt,
        generatedBy: ctx.access.label,
        includedCounts: byType,
        publishabilityFilter: allowedPublishability,
        exportHashSha256: exportHash,
        caseStatus: buildResult.meta.caseStatus,
        caseCreatedAt: buildResult.meta.caseCreatedAt,
        caseUpdatedAt: buildResult.meta.caseUpdatedAt,
      },
      privateExcluded
    );
  } else if (format === "STIX_LIKE_JSON") {
    contentText = serializeStixLike(included, {
      exportId,
      caseId,
      generatedAt,
      exportHashSha256: exportHash,
    });
  } else if (format === "THREAT_INTEL_CSV") {
    contentText = serializeThreatIntelCsv(included, caseId, generatedAt);
  } else if (format === "POLICE_ANNEX_PDF") {
    const html = buildPoliceAnnexHtml({
      caseId,
      caseTitle,
      generatedAt,
      generatedBy: ctx.access.label,
      exportHashSha256: exportHash,
      iocs: included,
      snapshots: buildResult.rawSnapshots,
      privateExcluded,
    });
    try {
      const pdfBuffer = await renderPoliceAnnexPdf(html);
      contentBase64 = pdfBuffer.toString("base64");
    } catch (err) {
      // Puppeteer unavailable in this environment — fall back to HTML annex
      console.warn("[exports] Puppeteer unavailable, serving HTML annex", err);
      contentText = html;
      const dateSuffix = generatedAt.slice(0, 10);
      const filename = `interligens-annex-${caseId.slice(0, 8)}-${dateSuffix}.html`;
      // Persist record then return HTML response
      const record = await persistExportRecord({
        caseId,
        workspaceId: ctx.workspace.id,
        investigatorAccessId: ctx.access.id,
        format,
        exportedBy: ctx.access.label,
        byType,
        allowedPublishability,
        exportHash,
        included,
        snapshotCount,
        privateExcluded,
      });
      await logAudit({
        investigatorAccessId: ctx.access.id,
        profileId: ctx.profile.id,
        workspaceId: ctx.workspace.id,
        caseId,
        action: "CASE_EXPORT_CREATED",
        actor: ctx.access.label,
        request,
        metadata: {
          exportId: record.id,
          format,
          iocCount: included.length,
          snapshotCount,
          privateExcluded,
          exportHashSha256: exportHash,
          fallback: "html",
        },
      });
      return NextResponse.json({
        exportId: record.id,
        format,
        generatedAt,
        exportHashSha256: exportHash,
        iocCount: included.length,
        snapshotCount,
        privateExcluded,
        includedCounts: byType,
        contentText,
        encoding: "utf8",
        mimeType: "text/html",
        filename,
      });
    }
  }

  const mimeType = FORMAT_MIME[format];
  const ext = FORMAT_EXT[format];
  const dateSuffix = generatedAt.slice(0, 10);
  const filename = `interligens-${format.toLowerCase().replace(/_/g, "-")}-${caseId.slice(0, 8)}-${dateSuffix}.${ext}`;

  // Persist export record
  const record = await persistExportRecord({
    caseId,
    workspaceId: ctx.workspace.id,
    investigatorAccessId: ctx.access.id,
    format,
    exportedBy: ctx.access.label,
    byType,
    allowedPublishability,
    exportHash,
    included,
    snapshotCount,
    privateExcluded,
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "CASE_EXPORT_CREATED",
    actor: ctx.access.label,
    request,
    metadata: {
      exportId: record.id,
      format,
      iocCount: included.length,
      snapshotCount,
      privateExcluded,
      exportHashSha256: exportHash,
    },
  });

  return NextResponse.json({
    exportId: record.id,
    format,
    generatedAt,
    exportHashSha256: exportHash,
    iocCount: included.length,
    snapshotCount,
    privateExcluded,
    includedCounts: byType,
    ...(contentText !== null
      ? { contentText, encoding: "utf8" }
      : { contentBase64, encoding: "base64" }),
    mimeType,
    filename,
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function persistExportRecord(p: {
  caseId: string;
  workspaceId: string;
  investigatorAccessId: string;
  format: CaseExportFormat;
  exportedBy: string;
  byType: Record<string, number>;
  allowedPublishability: IocPublishability[];
  exportHash: string;
  included: { type: string }[];
  snapshotCount: number;
  privateExcluded: number;
}) {
  try {
    return await prisma.caseExport.create({
      data: {
        caseId: p.caseId,
        workspaceId: p.workspaceId,
        investigatorAccessId: p.investigatorAccessId,
        exportFormat: p.format,
        exportedBy: p.exportedBy,
        includedCounts: p.byType,
        publishabilityFilter: p.allowedPublishability,
        contentHashSha256: p.exportHash,
        iocCount: p.included.length,
        snapshotCount: p.snapshotCount,
        privateExcluded: p.privateExcluded,
      },
      select: { id: true },
    });
  } catch (err) {
    // Table not yet migrated — return a stub so the rest of the flow completes
    console.error("[exports] persist failed (migration applied?)", err);
    return { id: "pending-migration" };
  }
}
