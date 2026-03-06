// src/app/api/admin/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/intel-vault/auth";
import { parseCsv, parseJson, parseSheet, parseText } from "@/lib/intel-vault/parsers";
import type { ParseOptions, NormalizedRow } from "@/lib/intel-vault/types";

interface IngestPayload {
  type: "url" | "file" | "text" | "address";
  payload: {
    url?: string;
    content?: string;
    address?: string;
    // optional overrides
    defaultChain?: string;
    defaultLabelType?: string;
    label?: string;
    sourceName?: string;
    visibility?: string;
    confidence?: string;
  };
}

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  let body: IngestPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, payload } = body;

  const opts: ParseOptions = {
    defaultChain: payload.defaultChain as never,
    defaultLabelType: payload.defaultLabelType as never,
    label: payload.label,
    sourceName: payload.sourceName,
    sourceUrl: payload.url,
    visibility: (payload.visibility ?? "internal_only") as never,
    confidence: (payload.confidence ?? "low") as never,
  };

  let rows: NormalizedRow[] = [];
  let totalScanned = 0;
  let warnings: string[] = [];

  if (type === "url" && payload.url) {
    const isSheet = payload.url.includes("docs.google.com/spreadsheets");
    if (isSheet) {
      const result = await parseSheet(payload.url, opts);
      rows = result.rows;
      totalScanned = result.totalScanned;
      warnings = result.warnings;
    } else {
      // Raw URL: fetch and try CSV then JSON
      try {
        const res = await fetch(payload.url);
        const text = await res.text();
        const trimmed = text.trim();
        const result = trimmed.startsWith("{") || trimmed.startsWith("[")
          ? parseJson(text, opts)
          : parseCsv(text, opts);
        rows = result.rows;
        totalScanned = result.totalScanned;
        warnings = result.warnings;
      } catch (e) {
        return NextResponse.json({ error: `Fetch failed: ${(e as Error).message}` }, { status: 422 });
      }
    }
  } else if (type === "file" && payload.content) {
    const trimmed = payload.content.trim();
    const result = trimmed.startsWith("{") || trimmed.startsWith("[")
      ? parseJson(payload.content, opts)
      : parseCsv(payload.content, opts);
    rows = result.rows;
    totalScanned = result.totalScanned;
    warnings = result.warnings;
  } else if (type === "text" && payload.content) {
    const result = parseText(payload.content, opts);
    rows = result.rows;
    totalScanned = result.totalScanned;
    warnings = result.warnings;
  } else if (type === "address" && payload.address) {
    const { buildRow } = await import("@/lib/intel-vault/normalizer");
    rows = [buildRow(payload.address, opts)];
    totalScanned = 1;
  } else {
    return NextResponse.json({ error: "type ou payload invalide" }, { status: 400 });
  }

  if (rows.length === 0 && warnings.length === 0) {
    warnings.push("Aucune adresse valide trouvée");
  }

  // Create batch in PENDING state (rows stored as JSON in RawDocument)
  const batch = await prisma.ingestionBatch.create({
    data: {
      inputType: type,
      inputPayload: payload.url ?? (payload.content?.slice(0, 500) ?? payload.address ?? ""),
      status: "pending",
      totalRows: totalScanned,
      matchedAddrs: rows.length,
      dedupedRows: 0,
      warnings: warnings.length ? JSON.stringify(warnings) : null,
      rawDocuments: {
        create: {
          content: JSON.stringify(rows),
          mimeType: "application/json",
        },
      },
    },
  });

  return NextResponse.json({
    batchId: batch.id,
    status: "pending",
    totalScanned,
    matched: rows.length,
    warnings,
    sample: rows.slice(0, 5),
  });
}
