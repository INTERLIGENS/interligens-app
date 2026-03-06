#!/usr/bin/env python3
"""
PATCH 03 — Intel Vault: API Routes
- POST /api/admin/ingest
- GET  /api/admin/batches/[id]
- POST /api/admin/batches/[id]/approve
- GET  /api/scan/explain
Idempotent.
"""
import os, sys

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))

FILES = {}

# ─── admin auth helper ──────────────────────────────────────────────────────────
FILES["src/lib/intel-vault/auth.ts"] = '''\
// src/lib/intel-vault/auth.ts
import { NextRequest, NextResponse } from "next/server";

export function requireAdmin(req: NextRequest): NextResponse | null {
  const token = req.headers.get("x-admin-token") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    console.error("ADMIN_TOKEN non configuré");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
'''

# ─── POST /api/admin/ingest ─────────────────────────────────────────────────────
FILES["src/app/api/admin/ingest/route.ts"] = '''\
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
'''

# ─── GET /api/admin/batches/[id] ────────────────────────────────────────────────
FILES["src/app/api/admin/batches/[id]/route.ts"] = '''\
// src/app/api/admin/batches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/intel-vault/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const batch = await prisma.ingestionBatch.findUnique({
    where: { id: params.id },
    include: { rawDocuments: { take: 1 } },
  });

  if (!batch) return NextResponse.json({ error: "Batch introuvable" }, { status: 404 });

  // Parse sample rows from raw document
  let sample: unknown[] = [];
  let topLabels: Record<string, number> = {};
  let chains: Record<string, number> = {};

  const raw = batch.rawDocuments[0]?.content;
  if (raw) {
    try {
      const rows = JSON.parse(raw) as Array<{ chain: string; labelType: string; label: string }>;
      sample = rows.slice(0, 10);
      for (const r of rows) {
        chains[r.chain] = (chains[r.chain] ?? 0) + 1;
        topLabels[r.labelType] = (topLabels[r.labelType] ?? 0) + 1;
      }
    } catch {}
  }

  return NextResponse.json({
    id: batch.id,
    status: batch.status,
    inputType: batch.inputType,
    totalRows: batch.totalRows,
    matchedAddrs: batch.matchedAddrs,
    dedupedRows: batch.dedupedRows,
    warnings: batch.warnings ? JSON.parse(batch.warnings) : [],
    approvedBy: batch.approvedBy,
    approvedAt: batch.approvedAt,
    createdAt: batch.createdAt,
    chains,
    topLabels,
    sample,
  });
}
'''

# ─── POST /api/admin/batches/[id]/approve ──────────────────────────────────────
FILES["src/app/api/admin/batches/[id]/approve/route.ts"] = '''\
// src/app/api/admin/batches/[id]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/intel-vault/auth";
import { upsertRows } from "@/lib/intel-vault/dedup";
import type { NormalizedRow } from "@/lib/intel-vault/types";
import crypto from "crypto";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const batch = await prisma.ingestionBatch.findUnique({
    where: { id: params.id },
    include: { rawDocuments: { take: 1 } },
  });

  if (!batch) return NextResponse.json({ error: "Batch introuvable" }, { status: 404 });
  if (batch.status === "approved") {
    return NextResponse.json({ error: "Batch déjà approuvé" }, { status: 409 });
  }

  const raw = batch.rawDocuments[0]?.content;
  if (!raw) return NextResponse.json({ error: "Aucune donnée dans le batch" }, { status: 422 });

  let rows: NormalizedRow[];
  try {
    rows = JSON.parse(raw) as NormalizedRow[];
  } catch {
    return NextResponse.json({ error: "Données corrompues" }, { status: 422 });
  }

  const { created, updated } = await upsertRows(rows, params.id);

  // Invalidate cache for affected addresses
  const addresses = rows.map(r => ({ chain: r.chain, address: r.address }));
  for (const { chain, address } of addresses) {
    await prisma.riskSummaryCache.deleteMany({ where: { chain, address } });
  }

  const actorToken = req.headers.get("x-admin-token") ?? "admin";
  const actorId = crypto.createHash("sha256").update(actorToken).digest("hex").slice(0, 12);

  await prisma.ingestionBatch.update({
    where: { id: params.id },
    data: {
      status: "approved",
      approvedBy: actorId,
      approvedAt: new Date(),
      dedupedRows: updated,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "approve_batch",
      actorId,
      batchId: params.id,
      meta: JSON.stringify({ created, updated, total: rows.length }),
    },
  });

  return NextResponse.json({
    success: true,
    batchId: params.id,
    created,
    updated,
    total: rows.length,
  });
}
'''

# ─── GET /api/scan/explain ──────────────────────────────────────────────────────
FILES["src/app/api/scan/explain/route.ts"] = '''\
// src/app/api/scan/explain/route.ts
// RBAC: admin token required. Never returns entityName in retail mode.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/intel-vault/auth";

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const chain = searchParams.get("chain");
  const address = searchParams.get("address");

  if (!chain || !address) {
    return NextResponse.json({ error: "chain et address requis" }, { status: 400 });
  }

  const labels = await prisma.addressLabel.findMany({
    where: { chain: chain as never, address },
    orderBy: { lastSeenAt: "desc" },
  });

  if (labels.length === 0) {
    return NextResponse.json({ match: false, chain, address });
  }

  const actorToken = req.headers.get("x-admin-token") ?? "admin";
  const isAdmin = actorToken === process.env.ADMIN_TOKEN;

  await prisma.auditLog.create({
    data: {
      action: "explain_request",
      actorId: actorToken.slice(0, 12),
      meta: JSON.stringify({ chain, address }),
    },
  });

  return NextResponse.json({
    match: true,
    chain,
    address,
    entries: labels.map(l => ({
      labelType: l.labelType,
      label: l.label,
      confidence: l.confidence,
      sourceName: l.sourceName,
      sourceUrl: l.sourceUrl,
      evidence: l.evidence,
      firstSeenAt: l.firstSeenAt,
      lastSeenAt: l.lastSeenAt,
      visibility: l.visibility,
      // entityName ONLY for admin, never retail
      ...(isAdmin && l.entityName ? { entityName: l.entityName } : {}),
    })),
  });
}
'''

# ─── Update /api/scan to include vault lookup ───────────────────────────────────
FILES["src/lib/intel-vault/scan-lookup.ts"] = '''\
// src/lib/intel-vault/scan-lookup.ts
// Lookup function to augment existing scan results with Intel Vault data.
import { prisma } from "@/lib/prisma";

export interface VaultMatch {
  match: boolean;
  severity: "none" | "low" | "medium" | "high" | "critical";
  categories: string[];
  confidence: string;
  explainAvailable: boolean;
  labels?: Array<{ labelType: string; label: string; confidence: string }>;
}

const SEVERITY_MAP: Record<string, VaultMatch["severity"]> = {
  scam: "critical",
  drainer: "critical",
  phishing: "high",
  exploiter: "high",
  insider: "medium",
  cluster_member: "medium",
  incident_related: "medium",
  kol: "low",
  whale: "low",
  airdrop_target: "low",
  other: "low",
};

export async function vaultLookup(chain: string, address: string): Promise<VaultMatch> {
  // Check cache first
  const cached = await prisma.riskSummaryCache.findUnique({
    where: { chain_address: { chain, address } },
  });

  if (cached) {
    try {
      return JSON.parse(cached.summary) as VaultMatch;
    } catch {}
  }

  const labels = await prisma.addressLabel.findMany({
    where: { chain: chain as never, address },
    orderBy: { lastSeenAt: "desc" },
  });

  if (labels.length === 0) {
    return { match: false, severity: "none", categories: [], confidence: "none", explainAvailable: false };
  }

  const severities = labels.map(l => SEVERITY_MAP[l.labelType] ?? "low");
  const severityOrder: VaultMatch["severity"][] = ["none", "low", "medium", "high", "critical"];
  const topSeverity = severities.reduce((a, b) =>
    severityOrder.indexOf(b) > severityOrder.indexOf(a) ? b : a, "none"
  );

  const topConfidence = labels.find(l => l.confidence === "high")?.confidence
    ?? labels.find(l => l.confidence === "medium")?.confidence
    ?? "low";

  const result: VaultMatch = {
    match: true,
    severity: topSeverity,
    categories: [...new Set(labels.map(l => l.labelType))],
    confidence: topConfidence,
    explainAvailable: true,
    labels: labels.slice(0, 3).map(l => ({
      labelType: l.labelType,
      label: l.label,
      confidence: l.confidence,
    })),
  };

  // Cache the result
  await prisma.riskSummaryCache.upsert({
    where: { chain_address: { chain, address } },
    create: { chain, address, summary: JSON.stringify(result) },
    update: { summary: JSON.stringify(result) },
  });

  return result;
}
'''

def write_file(rel_path: str, content: str):
    ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))
    abs_path = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    if os.path.exists(abs_path):
        with open(abs_path, "r") as f:
            existing = f.read().strip()
        if existing == content.strip():
            print(f"✅ {rel_path} — déjà à jour, skip.")
            return
        print(f"⚠️  {rel_path} — existe déjà, écrasement.")
    with open(abs_path, "w") as f:
        f.write(content)
    print(f"✅ {rel_path} — écrit.")

def patch():
    for path, content in FILES.items():
        write_file(path, content)
    print("\n✅ Patch 03 terminé — API routes créées.")
    print("   Routes:")
    print("     POST /api/admin/ingest")
    print("     GET  /api/admin/batches/[id]")
    print("     POST /api/admin/batches/[id]/approve")
    print("     GET  /api/scan/explain")
    print("   + src/lib/intel-vault/scan-lookup.ts")

patch()
