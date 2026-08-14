/**
 * src/lib/osint/retail/runProcessQueueBatch.ts
 *
 * Boucle de traitement de la file retail, extraite de
 * POST /api/admin/osint/retail/process-queue pour qu'un cron puisse l'appeler
 * sans dupliquer la logique.
 *
 * POURQUOI CETTE EXTRACTION
 * La route admin était le SEUL point d'entrée : ni cron, ni bouton d'UI, aucun
 * appelant hors test. Une soumission acceptée serait restée QUEUED
 * indéfiniment — la porte publique est fermée aujourd'hui, donc personne ne
 * l'a vu, mais le jour où elle s'ouvre le pipeline serait mort à l'arrivée.
 *
 * INVARIANTS PRÉSERVÉS À L'IDENTIQUE
 *   • double kill switch : OSINT_RETAIL_PROCESSING_ENABLED != "true" → rien
 *     n'est traité, les lignes restent QUEUED ;
 *   • budget vision re-vérifié AVANT chaque appel ;
 *   • trustTier forcé anonymous_retail (le cerveau interdit alors toute
 *     auto-assertion KOL↔token) ;
 *   • toutes les écritures restent shadow / non publiques.
 */

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

export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 20;
const PROMPT_VERSION = "vision_v1";

export type BatchOutcome =
  | { ok: false; code: "processing_disabled"; detail: string }
  | { ok: false; code: "migration_not_applied"; detail: string }
  | {
      ok: true;
      requested: number;
      found: number;
      processed: number;
      stoppedForBudget: boolean;
      budgetUsd: number;
      estSpendTodayUsd: number;
      results: Array<{ id: string; status: string; reason?: string }>;
    };

/** Préflight EvidenceSnapshot.extractionMethod (le cerveau écrit la preuve shadow). */
async function preflightEvidence(): Promise<string | null> {
  const cols = (await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'EvidenceSnapshot' AND column_name IN ('extractionMethod','extractionConfidence')`,
  )) as Array<{ column_name: string }>;
  if (cols.length < 2)
    return "EvidenceSnapshot.extractionMethod/extractionConfidence missing — apply MIGRATION_osint_vision_ingest_v1.sql.";
  return null;
}

function isVisionMedia(x: string | null): x is VisionMediaType {
  return x === "image/png" || x === "image/jpeg" || x === "image/gif" || x === "image/webp";
}

export function clampLimit(raw: unknown): number {
  return Math.max(1, Math.min(MAX_LIMIT, Number(raw) || DEFAULT_LIMIT));
}

export async function runProcessQueueBatch(limit: number): Promise<BatchOutcome> {
  if (!isRetailProcessingEnabled()) {
    return {
      ok: false,
      code: "processing_disabled",
      detail: "OSINT_RETAIL_PROCESSING_ENABLED is false — queue left untouched.",
    };
  }

  const pf = (await preflightRetail()) ?? (await preflightEvidence());
  if (pf) return { ok: false, code: "migration_not_applied", detail: pf };

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

    // Verrou optimiste : ne traite que si la ligne est encore prenable
    // (QUEUED, ou ERROR_RETRYABLE dont les tentatives ne sont pas épuisées).
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

  return {
    ok: true,
    requested: limit,
    found: queued.length,
    processed: processed.length,
    stoppedForBudget,
    budgetUsd: budget,
    estSpendTodayUsd: Math.round(spendToday * 100) / 100,
    results: processed,
  };
}
