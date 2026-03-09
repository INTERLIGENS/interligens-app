
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { extractAddresses } from "@/lib/ingest/extractAddresses";
import { getRawDocsStorage } from "@/lib/vault/rawdocs/getStorage";

export async function POST(req: NextRequest) {
  try {
    const deny = requireAdminApi(req);
  if (deny) return deny;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const sourceId = formData.get("sourceId") as string | null;
  const defaultLabelType = (formData.get("labelType") as string) || "other";
  const defaultLabel = (formData.get("label") as string) || "";

  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!sourceId) return NextResponse.json({ error: "sourceId required" }, { status: 400 });

  const source = await prisma.sourceRegistry.findUnique({ where: { id: sourceId } });
  if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });

  // Store raw doc
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storage = getRawDocsStorage();
  const docId = crypto.randomUUID();
  await storage.save(buffer, { mime: "application/pdf", filename: file.name, batchId: docId });

  // Extract text via pdf-parse
  let text = "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } catch (e) {
    return NextResponse.json({ error: "PDF parse failed: " + String(e) }, { status: 422 });
  }

  // Detect addresses
  const candidates = extractAddresses(text);
  const chainCounts: Record<string, number> = {};
  for (const c of candidates) {
    chainCounts[c.chain] = (chainCounts[c.chain] ?? 0) + 1;
  }

  // Create batch
  const batch = await prisma.ingestionBatch.create({
    data: {
      sourceId,
      status: "quarantine",
      inputType: "pdf",
      inputPayload: file.name,
      totalRows: candidates.length,
      processedRows: 0,
      errorMessage: JSON.stringify({
        filename: file.name,
        docId,
        totalAddresses: candidates.length,
        chainDistribution: chainCounts,
        sample: candidates.slice(0, 50).map(c => ({
          address: c.address,
          chain: c.chain,
          labelType: defaultLabelType,
          label: defaultLabel || source.sourceName,
          confidence: "low",
          evidence: `PDF:${file.name}`,
        })),
      }),
    },
  });

  // Candidate rows stored in batch meta (sample). Full list in batch.meta.
  // No quarantine model: rows will be processed via approve job.

  await prisma.auditLog.create({ data: {
    action: "PDF_INGEST",
    actorId: "admin",
    batchId: batch.id,
    meta: `${file.name} => ${candidates.length} addresses`,
  }});

  return NextResponse.json({
    batchId: batch.id,
    totalAddresses: candidates.length,
    chainDistribution: chainCounts,
    sample: candidates.slice(0, 5),
  });
  } catch (e: any) {
    return NextResponse.json({ error: "PDF route crash", detail: String(e?.message ?? e) }, { status: 500 });
  }
}
