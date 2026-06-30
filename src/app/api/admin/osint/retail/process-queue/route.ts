/**
 * src/app/api/admin/osint/retail/process-queue/route.ts
 *
 * SPRINT C1 — POST /api/admin/osint/retail/process-queue (ADMIN, async vision).
 *
 * C'est le mécanisme de traitement HORS de la requête HTTP de submit : il prend
 * des lignes retail QUEUED, appelle la vision sur la version NORMALISÉE (jamais
 * l'original), puis le cerveau A (processSubmission) en SHADOW. Déclenché
 * manuellement (admin) ou par un cron — pas par le soumetteur.
 *
 * DOUBLE KILL SWITCH : si OSINT_RETAIL_PROCESSING_ENABLED != "true" → 403, rien
 * n'est traité (les lignes restent QUEUED). Budget vision journalier re-vérifié
 * AVANT chaque appel : dépassé → on s'arrête, lignes laissées QUEUED.
 *
 * INVARIANTS : trustTier forcé anonymous_retail (le cerveau interdit alors toute
 * auto-assertion KOL↔token) ; toutes les écritures sont shadow / non publiques.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { isRetailProcessingEnabled, dailyVisionBudgetUsd } from "@/lib/osint/retail/retailConfig";
import {
  preflightRetail,
  listQueuedRetail,
  markProcessing,
  markError,
  buildRetailProcessingStore,
  estimatedVisionSpendTodayUsd,
  VISION_COST_PER_IMAGE_USD,
  RETAIL_SOURCE_TYPE,
} from "@/lib/osint/retail/retailStore";
import { buildReviewablePlan } from "@/lib/osint/retail/buildReviewablePlan";
import { callVision, type VisionMediaType } from "@/lib/osint/vision/callVision";
import { resolveVisionTokens } from "@/lib/osint/vision/resolveTokens";
import { verifyMintOnChain } from "@/lib/osint/vision/verifyMintOnChain";
import { processSubmission } from "@/lib/osint/decision";
import { SourceTrustTier, SubmissionStatus } from "@/lib/osint/contracts";
import { VISION_MODEL } from "@/lib/osint/vision/visionPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const PROMPT_VERSION = "vision_v1";

/** Préflight EvidenceSnapshot.extractionMethod (le cerveau écrit la preuve shadow). */
async function preflightEvidence(): Promise<string | null> {
  const cols = (await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'EvidenceSnapshot' AND column_name IN ('extractionMethod','extractionConfidence')`,
  )) as Array<{ column_name: string }>;
  if (cols.length < 2) return "EvidenceSnapshot.extractionMethod/extractionConfidence missing — apply MIGRATION_osint_vision_ingest_v1.sql.";
  return null;
}

function isVisionMedia(x: string | null): x is VisionMediaType {
  return x === "image/png" || x === "image/jpeg" || x === "image/gif" || x === "image/webp";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdminApi(req);
  if (denied) return denied;

  // DOUBLE KILL SWITCH — traitement fermé par défaut.
  if (!isRetailProcessingEnabled()) {
    return NextResponse.json(
      { error: "processing_disabled", detail: "OSINT_RETAIL_PROCESSING_ENABLED is false — queue left untouched." },
      { status: 403 },
    );
  }

  const pf = (await preflightRetail()) ?? (await preflightEvidence());
  if (pf) return NextResponse.json({ error: "migration_not_applied", detail: pf }, { status: 412 });

  let body: { limit?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(body.limit) || DEFAULT_LIMIT));

  const nowIso = new Date().toISOString();
  const budget = dailyVisionBudgetUsd();
  let spendToday = await estimatedVisionSpendTodayUsd(nowIso);

  const queued = await listQueuedRetail(limit);
  const processed: Array<{ id: string; status: string; reason?: string }> = [];
  let stoppedForBudget = false;

  for (const row of queued) {
    // Budget : re-vérifié AVANT chaque appel vision.
    if (spendToday + VISION_COST_PER_IMAGE_USD > budget) {
      stoppedForBudget = true;
      break;
    }
    if (!row.normalizedImageB64 || !isVisionMedia(row.normalizedMediaType)) {
      await markError(row.id, SubmissionStatus.ERROR_FINAL, "missing normalized image for vision");
      processed.push({ id: row.id, status: SubmissionStatus.ERROR_FINAL, reason: "no_normalized_image" });
      continue;
    }

    // Verrou optimiste : ne traite que si encore QUEUED.
    const locked = await markProcessing(row.id);
    if (!locked) continue;

    try {
      const vision = await callVision(row.normalizedImageB64, row.normalizedMediaType, null);
      spendToday += VISION_COST_PER_IMAGE_USD;

      const resolutions = await resolveVisionTokens(vision, { verifyMint: verifyMintOnChain });
      const plan = buildReviewablePlan({
        vision,
        resolutions,
        imageSha256: row.imageSha256,
        perceptualHash: row.perceptualHash,
        modelVersion: VISION_MODEL,
        promptVersion: PROMPT_VERSION,
        submitter: row.submitter,
        ingestedAt: row.ingestedAt || nowIso,
        sourceType: RETAIL_SOURCE_TYPE,
        capturedAt: null,
        fileName: `retail_${row.imageSha256.slice(0, 12)}`,
        bytes: 0,
        tweetUrl: row.tweetUrl,
        contextNote: row.contextNote,
      });

      const result = await processSubmission(plan, SourceTrustTier.ANONYMOUS_RETAIL, {
        store: buildRetailProcessingStore(row.id),
        verifyMint: verifyMintOnChain,
      });
      processed.push({ id: row.id, status: result.status });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      const retryable = code !== "VISION_NOT_JSON";
      const status = retryable ? SubmissionStatus.ERROR_RETRYABLE : SubmissionStatus.ERROR_FINAL;
      await markError(row.id, status, `processing error: ${e instanceof Error ? e.message : String(e)}`);
      processed.push({ id: row.id, status, reason: "processing_error" });
    }
  }

  return NextResponse.json({
    ok: true,
    requested: limit,
    found: queued.length,
    processed: processed.length,
    stoppedForBudget,
    budgetUsd: budget,
    estSpendTodayUsd: Math.round(spendToday * 100) / 100,
    results: processed,
  });
}
