/**
 * src/app/api/admin/osint/process/route.ts
 *
 * SPRINT A — POST /api/admin/osint/process (admin-only, SHADOW MODE).
 *
 * Prend un ExtractionPlan (claims[] + provenance) et lance processSubmission :
 * décision PAR CLAIM, matérialisation shadow (EvidenceSnapshot pending /
 * KolTokenLink draft), écriture de la ligne OsintSubmission, idempotence par
 * imageSha256. Vision/Helius : la résolution ticker on-chain passe par le vrai
 * verifyMintOnChain ; AUCUN appel vision ici (le plan est déjà extrait).
 *
 * INVARIANTS DÉFENDUS EN CODE (pas seulement par le plan) :
 *   - jamais isPublic=true, jamais visibility='public', jamais publishStatus='published'
 *   - anonymous_retail ne peut JAMAIS auto-créer une assertion KOL↔token
 *     (garanti par classifyClaim ; la route ne fait que passer le trustTier).
 *
 * PRÉREQUIS DB : MIGRATION_osint_submission_v1.sql (table OsintSubmission) +
 * MIGRATION_osint_vision_ingest_v1.sql (EvidenceSnapshot.extractionMethod/
 * extractionConfidence) doivent être appliquées. Sinon → 412. Cette route n'est
 * PAS exécutée contre la prod ce sprint.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { verifyMintOnChain } from "@/lib/osint/vision/verifyMintOnChain";
import { processSubmission } from "@/lib/osint/decision";
import type {
  SubmissionStore,
  ReviewablePlan,
} from "@/lib/osint/decision";
import { SourceTrustTier, SOURCE_TRUST_WEIGHT } from "@/lib/osint/contracts";

export const runtime = "nodejs";

function isValidTrustTier(x: unknown): x is SourceTrustTier {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(SOURCE_TRUST_WEIGHT, x);
}

/** Préflight : les deux migrations additives doivent être appliquées. */
async function preflight(): Promise<string | null> {
  const tbl = (await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'OsintSubmission'`,
  )) as Array<{ table_name: string }>;
  if (!tbl.length) return "OsintSubmission table missing — apply MIGRATION_osint_submission_v1.sql first.";

  const cols = (await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'EvidenceSnapshot' AND column_name IN ('extractionMethod','extractionConfidence')`,
  )) as Array<{ column_name: string }>;
  if (cols.length < 2) return "EvidenceSnapshot.extractionMethod/extractionConfidence missing — apply MIGRATION_osint_vision_ingest_v1.sql first.";
  return null;
}

/** Store prisma + SQL brut. Toutes les écritures sont shadow (jamais publiques). */
function buildPrismaStore(): SubmissionStore {
  return {
    async findByImageSha256(sha256) {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT id, status FROM "OsintSubmission" WHERE "imageSha256" = $1 LIMIT 1`,
        sha256,
      )) as Array<{ id: string; status: string }>;
      return rows[0] ?? null;
    },

    async listRecentForPoisoning(kolHandle, sinceIso) {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT "imageSha256", "perceptualHash", "submitter" AS submitter, "trustTier", "status", "ingestedAt"
           FROM "OsintSubmission"
          WHERE lower(COALESCE((SELECT "kolHandle" FROM "EvidenceSnapshot" e WHERE e."sha256" = "OsintSubmission"."imageSha256" LIMIT 1), '')) = lower($1)
            AND "ingestedAt" >= $2::timestamptz`,
        kolHandle,
        sinceIso,
      )) as Array<{
        imageSha256: string;
        perceptualHash: string | null;
        trustTier: string;
        status: string;
        ingestedAt: Date;
      }>;
      return rows.map((r) => ({
        imageSha256: r.imageSha256,
        perceptualHash: r.perceptualHash,
        kolHandle,
        trustTier: (isValidTrustTier(r.trustTier) ? r.trustTier : SourceTrustTier.ANONYMOUS_RETAIL),
        verified: r.status === "AUTO_COMMITTED_SHADOW" || r.status === "RESOLVED_BY_REVIEW",
        ingestedAt: new Date(r.ingestedAt).toISOString(),
      }));
    },

    async insertEvidenceShadow(input) {
      const id = randomUUID();
      // ON CONFLICT (sha256) DO NOTHING — idempotent au niveau fichier.
      const rows = (await prisma.$queryRawUnsafe(
        `INSERT INTO "EvidenceSnapshot"
            ("id","relationType","relationKey","snapshotType","title","caption",
             "isPublic","reviewStatus","kolHandle","tokenSymbol","sha256",
             "extractionMethod","notes","createdAt","updatedAt")
         VALUES ($1,'kol_token',$2,$3,$4,$5,false,$6,$7,$8,$9,$10,$11,now(),now())
         ON CONFLICT ("sha256") DO NOTHING
         RETURNING id`,
        id,
        input.relationKey,
        input.snapshotType,
        `${input.kolHandle ?? "unknown"} × ${input.tokenSymbol ? "$" + input.tokenSymbol : "(multi)"} — vision OSINT`,
        "Vision-auto shadow evidence (unpublished).",
        input.reviewStatus,
        input.kolHandle,
        input.tokenSymbol,
        input.imageSha256,
        input.extractionMethod,
        input.notes,
      )) as Array<{ id: string }>;
      return { id: rows[0]?.id ?? id };
    },

    async upsertLinkDraft(input) {
      // Profil draft non publiable (FK), puis lien forcé draft / pending_review.
      await prisma.kolProfile.upsert({
        where: { handle: input.kolHandle },
        update: {},
        create: {
          handle: input.kolHandle,
          platform: "x",
          displayName: input.kolHandle,
          publishable: false,
          publishStatus: "draft",
        } as never,
      });
      const link = await prisma.kolTokenLink.upsert({
        where: {
          kolHandle_contractAddress_chain: {
            kolHandle: input.kolHandle,
            contractAddress: input.contractAddress,
            chain: input.chain,
          },
        },
        update: {}, // no-clobber
        create: {
          kolHandle: input.kolHandle,
          contractAddress: input.contractAddress,
          chain: input.chain,
          tokenSymbol: input.tokenSymbol,
          role: "promoter",
          visibility: "draft", // JAMAIS 'public'
          reviewStatus: input.reviewStatus,
          createdByBridge: true,
          note: input.note,
        } as never,
      });
      return { id: (link as { id: string }).id };
    },

    async insertSubmission(input) {
      const id = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "OsintSubmission"
            ("id","status","imageSha256","perceptualHash","promptVersion","modelVersion",
             "sourceType","trustTier","submitter","rawVisionPass1","rawVisionPass2",
             "decisionReasons","claimsCount","evidenceSnapshotId","ingestedAt","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15::timestamptz,now(),now())`,
        id,
        input.status,
        input.imageSha256,
        input.perceptualHash,
        input.promptVersion,
        input.modelVersion,
        input.sourceType,
        input.trustTier,
        input.submitter,
        JSON.stringify(input.rawVisionPass1 ?? null),
        JSON.stringify(input.rawVisionPass2 ?? null),
        JSON.stringify(input.decisionReasons ?? []),
        input.claimsCount,
        input.evidenceSnapshotId,
        input.ingestedAt,
      );
      return { id };
    },
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdminApi(req);
  if (denied) return denied;

  let body: { plan?: ReviewablePlan; trustTier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const plan = body.plan;
  if (!plan || !plan.provenance?.imageSha256 || !Array.isArray(plan.claims)) {
    return NextResponse.json({ error: "Body must be { plan: ExtractionPlan, trustTier? }" }, { status: 400 });
  }

  // trustTier par défaut = anonymous_retail (soumission retail). L'admin peut
  // explicitement élever (investigator/admin) — c'est lui qui répond du tier.
  const trustTier: SourceTrustTier = isValidTrustTier(body.trustTier)
    ? body.trustTier
    : SourceTrustTier.ANONYMOUS_RETAIL;

  const pf = await preflight();
  if (pf) return NextResponse.json({ error: "Migration not applied", detail: pf }, { status: 412 });

  try {
    const result = await processSubmission(plan, trustTier, {
      store: buildPrismaStore(),
      verifyMint: verifyMintOnChain,
    });
    return NextResponse.json({ ok: true, trustTier, result }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "processSubmission failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
