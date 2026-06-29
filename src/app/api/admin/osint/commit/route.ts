/**
 * src/app/api/admin/osint/commit/route.ts
 *
 * OSINT Vision Ingest V1 — COMMIT (SHADOW MODE). Admin-only.
 *
 * Persists a (human-reviewed) plan produced by /api/admin/osint/ingest using the
 * SAME idempotent logic as the manual OSINT committers:
 *   - KolProfile.upsert  update:{} (no-clobber), FORCED publishable=false / draft
 *   - KolTokenLink.upsert on (kolHandle, contractAddress, chain) update:{},
 *     FORCED visibility='draft'. PENDING CAs are written AS-IS, never resolved.
 *   - EvidenceSnapshot INSERT ... ON CONFLICT (sha256) DO NOTHING.
 *
 * HARD INVARIANTS (defended in code, not just trusted from the plan):
 *   - NEVER publishStatus='published', NEVER publishable=true.
 *   - NEVER visibility='public' on a vision-auto link.
 *   - NEVER convert a "PENDING:*" CA into a real address (no blind resolution).
 *
 * PREREQUISITE: MIGRATION_osint_vision_ingest_v1.sql must be applied first
 * (adds EvidenceSnapshot.extractionMethod / extractionConfidence). Preflight
 * checks this and aborts with a clear error otherwise.
 *
 * NOTE: This route is shipped but is NOT run against production in this sprint.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { isPending } from "@/lib/osint/vision/validateCA";

interface PlanLink {
  kolHandle: string;
  contractAddress: string;
  chain: string;
  tokenSymbol?: string | null;
  role?: string;
  documentationStatus?: string;
  attributionNote?: string;
  note?: string;
}
interface PlanEvidence {
  kolHandle?: string | null;
  tokenSymbol?: string | null;
  capturedAt?: string | null;
  sessionId: string;
  localFilePath: string;
  sha256: string;
  sourceUrl?: string | null;
  relationType: string;
  relationKey: string;
  snapshotType: string;
  chainHint?: string | null;
  title: string;
  caption: string;
  sourceLabel?: string | null;
  notes?: string | null;
}

async function preflightMigration(): Promise<string | null> {
  const cols = (await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'EvidenceSnapshot'
       AND column_name IN ('extractionMethod','extractionConfidence')`,
  )) as Array<{ column_name: string }>;
  if (cols.length < 2) {
    return `Migration not applied: EvidenceSnapshot missing vision columns (found ${cols.length}/2). Run MIGRATION_osint_vision_ingest_v1.sql in the Neon SQL Editor first.`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const plan = body.plan as Record<string, unknown> | undefined;
  if (!plan || typeof plan !== "object") {
    return NextResponse.json({ error: "missing_plan" }, { status: 400 });
  }

  const profile = plan.kolProfileToCreate as Record<string, unknown> | undefined;
  const links = (plan.kolTokenLinksToCreate as PlanLink[]) ?? [];
  const evidences = (plan.evidences as PlanEvidence[]) ?? [];
  if (!profile?.handle) {
    return NextResponse.json({ error: "invalid_plan", detail: "kolProfileToCreate.handle required" }, { status: 400 });
  }
  const handle = String(profile.handle);
  if (handle === "unknown_handle") {
    return NextResponse.json({ error: "unresolved_handle", detail: "Resolve kolHandle before committing." }, { status: 422 });
  }

  // Preflight: migration must be present.
  const migErr = await preflightMigration();
  if (migErr) return NextResponse.json({ error: "migration_required", detail: migErr }, { status: 412 });

  const report = {
    mode: "shadow_commit",
    kolProfile: null as null | { handle: string; created: boolean },
    links: { ok: 0, pending: 0, failed: [] as Array<{ tokenSymbol?: string | null; error: string }> },
    evidences: { inserted: 0, skipped_existing: 0, failed: [] as Array<{ sha256: string; error: string }> },
  };

  // ── KolProfile — SHADOW, never publish ──
  try {
    const row = await prisma.kolProfile.upsert({
      where: { handle },
      update: {}, // no-clobber existing profile
      create: {
        handle,
        platform: String(profile.platform ?? "x"),
        displayName: (profile.displayName as string) ?? handle,
        evidenceStatus: String(profile.evidenceStatus ?? "partial"),
        internalNote: (profile.internalNote as string) ?? `Vision-auto OSINT ingest (shadow).`,
        publishable: false,      // FORCED — invariant
        publishStatus: "draft",  // FORCED — invariant
      },
    });
    report.kolProfile = { handle: row.handle, created: true };
  } catch (e) {
    return NextResponse.json({ error: "profile_failed", detail: (e as Error).message }, { status: 500 });
  }

  // ── KolTokenLink — shadow draft, PENDING stays PENDING ──
  for (const l of links) {
    try {
      if (isPending(l.contractAddress)) report.links.pending++;
      await prisma.kolTokenLink.upsert({
        where: {
          kolHandle_contractAddress_chain: {
            kolHandle: l.kolHandle,
            contractAddress: l.contractAddress, // PENDING:* persisted verbatim — never resolved
            chain: l.chain,
          },
        },
        update: {}, // idempotent — no doublons, no clobber
        create: {
          kolHandle: l.kolHandle,
          contractAddress: l.contractAddress,
          chain: l.chain,
          tokenSymbol: l.tokenSymbol ?? null,
          role: l.role ?? "promoter",
          documentationStatus: l.documentationStatus ?? "partial",
          attributionNote: l.attributionNote ?? null,
          note: l.note ?? null,
          visibility: "draft",            // FORCED — invariant (never 'public')
          reviewStatus: "pending_review",
          sourceType: "osint_vision_auto",
          createdByBridge: false,
        },
      });
      report.links.ok++;
    } catch (e) {
      report.links.failed.push({ tokenSymbol: l.tokenSymbol, error: (e as Error).message });
    }
  }

  // ── EvidenceSnapshot — INSERT ON CONFLICT(sha256) DO NOTHING (raw, positional) ──
  for (const e of evidences) {
    try {
      const observedAt = e.capturedAt ? new Date(e.capturedAt) : null;
      const res = (await prisma.$executeRawUnsafe(
        `INSERT INTO "EvidenceSnapshot"
           ("id","relationType","relationKey","snapshotType","imageUrl","title","caption",
            "sourceLabel","sourceUrl","observedAt","displayOrder","isPublic","reviewStatus",
            "createdAt","updatedAt","kolHandle","tokenSymbol","localFilePath","sha256","sessionId",
            "notes","extractionMethod","extractionConfidence")
         VALUES
           (gen_random_uuid()::text,$1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,now(),now(),
            $12,$13,$14,$15,$16,$17,$18,$19::jsonb)
         ON CONFLICT ("sha256") DO NOTHING`,
        e.relationType,
        e.relationKey,
        e.snapshotType,
        e.title,
        e.caption,
        e.sourceLabel ?? "Vision auto-ingest — OSINT screenshot",
        e.sourceUrl ?? null,
        observedAt,
        0,
        false,            // isPublic — FORCED false
        "pending",        // reviewStatus
        e.kolHandle ?? handle,
        e.tokenSymbol ?? null,
        e.localFilePath,
        e.sha256,
        e.sessionId,
        e.notes ?? null,
        "vision_auto",    // extractionMethod
        JSON.stringify((plan.confidence as unknown) ?? null), // extractionConfidence (jsonb text)
      )) as number;
      if (res === 0) report.evidences.skipped_existing++;
      else report.evidences.inserted++;
    } catch (err) {
      report.evidences.failed.push({ sha256: e.sha256, error: (err as Error).message });
    }
  }

  const ok = report.links.failed.length === 0 && report.evidences.failed.length === 0;
  return NextResponse.json({ ok, ...report }, { status: ok ? 200 : 207 });
}
