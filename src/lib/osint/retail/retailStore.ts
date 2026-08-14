/**
 * src/lib/osint/retail/retailStore.ts
 *
 * SPRINT C1 — Persistance retail (prisma + SQL brut). Toutes les écritures sont
 * SHADOW / privées : jamais isPublic=true, jamais visibility='public', l'original
 * jamais en base. Lit/écrit la table additive OsintSubmission + colonnes retail
 * (MIGRATION_osint_retail_gate_v1.sql). Si les colonnes n'existent pas → preflight
 * renvoie une erreur et la route répond "submissions closed (storage)".
 *
 * Contient aussi le STORE DE TRAITEMENT (SubmissionStore) du processeur async :
 * il réutilise le cerveau A (processSubmission) mais, au lieu d'INSÉRER une
 * nouvelle ligne, il MET À JOUR la ligne retail déjà créée à l'ingestion.
 */

import { randomUUID, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { SubmissionStatus, SourceTrustTier } from "../contracts";
import type { SubmissionStatus as SubmissionStatusT } from "../contracts";
import type { SubmissionStore } from "../decision";
import { VISION_COST_PER_PASS_USD } from "../observability/computeDashboard";
import { VISION_PASSES_PER_IMAGE } from "./retailConfig";
import { DEFAULT_RETAIL_PRIVACY_STATUS } from "./privacy";

export const RETAIL_EXTRACTION_METHOD = "vision_retail_auto";

/**
 * Nombre maximum de passages vision par soumission.
 *
 * ERROR_RETRYABLE était posé par process-queue sur toute erreur non-JSON
 * (timeout, 429, coupure réseau) mais listQueuedRetail ne relisait que QUEUED :
 * aucune reprise n'existait. Le statut annonçait une reprise que rien
 * n'implémentait — une erreur transitoire était en fait définitive.
 *
 * La reprise est bornée : sans plafond, une image qui fait systématiquement
 * échouer la vision serait re-soumise à chaque passage du cron et brûlerait le
 * budget vision quotidien en boucle.
 */
export const MAX_PROCESSING_ATTEMPTS = 3;
export const RETAIL_SOURCE_TYPE = "osint_retail_screenshot";

/** Statuts qui consomment (ou ont consommé) de la vision — pour le calcul budget. */
const VISION_CONSUMING_STATUSES: SubmissionStatusT[] = [
  SubmissionStatus.QUEUED,
  SubmissionStatus.PROCESSING,
  SubmissionStatus.AUTO_COMMITTED_SHADOW,
  SubmissionStatus.PENDING_REVIEW,
  SubmissionStatus.RESOLVED_BY_REVIEW,
];

/** Coût estimé d'UNE image traitée en vision (2 passes). */
export const VISION_COST_PER_IMAGE_USD = VISION_PASSES_PER_IMAGE * VISION_COST_PER_PASS_USD;

export interface RetailRowInput {
  batchId: string;
  status: SubmissionStatusT;
  imageSha256: string;          // sha256 de l'ORIGINAL
  perceptualHash: string | null;
  normalizedSha256: string | null;
  normalizedBytes: number | null;
  normalizedMediaType: string | null;
  normalizedImageB64: string | null;  // version vision (récupération async)
  originalBytes: number;
  rawImageStored: boolean;
  rawImageRef: string | null;
  privacyStatus: string;
  submitter: string;            // IP-hash
  width: number | null;
  height: number | null;
  imageIndex: number;
  imageCount: number;
  tweetUrl: string | null;
  contextNote: string | null;
  turnstileVerified: boolean | null;
  precheckReason: string | null;
  modelVersion: string;
  promptVersion: string;
  ingestedAt: string;           // ISO
}

export interface BatchStatusRow {
  status: string;
  imageIndex: number | null;
  precheckReason: string | null;
  privacyStatus: string;
  ingestedAt: string;
}

export interface QueuedRetailRow {
  id: string;
  batchId: string | null;
  imageSha256: string;
  perceptualHash: string | null;
  normalizedImageB64: string | null;
  normalizedMediaType: string | null;
  submitter: string;
  tweetUrl: string | null;
  contextNote: string | null;
  ingestedAt: string;
}

function startOfUtcDayIso(nowIso: string): string {
  const d = new Date(Date.parse(nowIso));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString();
}

/**
 * Vérifie que la table OsintSubmission ET les colonnes retail existent. Renvoie un
 * message d'erreur si une pièce manque (porte non provisionnée), sinon null.
 */
export async function preflightRetail(): Promise<string | null> {
  const tbl = (await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'OsintSubmission'`,
  )) as Array<{ table_name: string }>;
  if (!tbl.length) return "OsintSubmission table missing — apply MIGRATION_osint_submission_v1.sql.";

  const cols = (await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'OsintSubmission'
        AND column_name IN ('batchId','privacyStatus','normalizedImageB64','extractionMethod','precheckReason')`,
  )) as Array<{ column_name: string }>;
  if (cols.length < 5) return "OsintSubmission retail columns missing — apply MIGRATION_osint_retail_gate_v1.sql.";

  // La reprise bornée s'appuie sur ce compteur. Sans lui, listQueuedRetail
  // rejouerait ERROR_RETRYABLE sans limite : on refuse de traiter plutôt que de
  // boucler sur le budget vision.
  const att = (await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'OsintSubmission' AND column_name = 'processingAttempts'`,
  )) as Array<{ column_name: string }>;
  if (!att.length) return "OsintSubmission.processingAttempts missing — apply MIGRATION_osint_retail_retry_v1.sql.";
  return null;
}

/** Nb de soumissions (batchs distincts) d'une IP-hash sur les dernières 24 h. */
export async function countSubmitsByIpSince(ipHash: string, sinceIso: string): Promise<number> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT count(DISTINCT "batchId")::int AS n
       FROM "OsintSubmission"
      WHERE "submitter" = $1 AND "ingestedAt" >= $2::timestamptz`,
    ipHash,
    sinceIso,
  )) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

/** Lookup dédup par sha256 de l'original. */
export async function findByOriginalSha256(
  sha256: string,
): Promise<{ id: string; status: string; batchId: string | null } | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, status, "batchId" FROM "OsintSubmission" WHERE "imageSha256" = $1 LIMIT 1`,
    sha256,
  )) as Array<{ id: string; status: string; batchId: string | null }>;
  return rows[0] ?? null;
}

/** Dépense vision estimée depuis le début du jour UTC (USD). */
export async function estimatedVisionSpendTodayUsd(nowIso: string): Promise<number> {
  const since = startOfUtcDayIso(nowIso);
  const statuses = VISION_CONSUMING_STATUSES.map((s) => `'${s}'`).join(",");
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n
       FROM "OsintSubmission"
      WHERE "extractionMethod" = $1
        AND "ingestedAt" >= $2::timestamptz
        AND status IN (${statuses})`,
    RETAIL_EXTRACTION_METHOD,
    since,
  )) as Array<{ n: number }>;
  const images = rows[0]?.n ?? 0;
  return Math.round(images * VISION_COST_PER_IMAGE_USD * 100) / 100;
}

/** Insère UNE ligne image retail. Renvoie l'id. */
export async function insertRetailRow(input: RetailRowInput): Promise<{ id: string }> {
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "OsintSubmission"
        ("id","status","imageSha256","perceptualHash","promptVersion","modelVersion",
         "sourceType","trustTier","submitter","decisionReasons","claimsCount",
         "ingestedAt","createdAt","updatedAt",
         "batchId","privacyStatus","originalBytes","rawImageStored","rawImageRef",
         "normalizedSha256","normalizedBytes","normalizedMediaType","normalizedImageB64",
         "extractionMethod","tweetUrl","contextNote","imageIndex","imageCount",
         "width","height","turnstileVerified","precheckReason")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::timestamptz,now(),now(),
             $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)`,
    id,
    input.status,
    input.imageSha256,
    input.perceptualHash,
    input.promptVersion,
    input.modelVersion,
    RETAIL_SOURCE_TYPE,
    SourceTrustTier.ANONYMOUS_RETAIL,
    input.submitter,
    JSON.stringify([]),
    0,
    input.ingestedAt,
    input.batchId,
    input.privacyStatus,
    input.originalBytes,
    input.rawImageStored,
    input.rawImageRef,
    input.normalizedSha256,
    input.normalizedBytes,
    input.normalizedMediaType,
    input.normalizedImageB64,
    RETAIL_EXTRACTION_METHOD,
    input.tweetUrl,
    input.contextNote,
    input.imageIndex,
    input.imageCount,
    input.width,
    input.height,
    input.turnstileVerified,
    input.precheckReason,
  );
  return { id };
}

/** Lignes d'un batch (status endpoint — statut seul, AUCUNE donnée sensible). */
export async function getBatchStatusRows(batchId: string): Promise<BatchStatusRow[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT status, "imageIndex", "precheckReason", "privacyStatus", "ingestedAt"
       FROM "OsintSubmission" WHERE "batchId" = $1 ORDER BY "imageIndex" ASC`,
    batchId,
  )) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    status: String(r.status),
    imageIndex: r.imageIndex === null || r.imageIndex === undefined ? null : Number(r.imageIndex),
    precheckReason: (r.precheckReason as string) ?? null,
    privacyStatus: String(r.privacyStatus ?? DEFAULT_RETAIL_PRIVACY_STATUS),
    ingestedAt: r.ingestedAt ? new Date(r.ingestedAt as string).toISOString() : "",
  }));
}

/** Lignes QUEUED retail à traiter (processeur async), plus anciennes d'abord. */
export async function listQueuedRetail(limit: number): Promise<QueuedRetailRow[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, "batchId", "imageSha256", "perceptualHash", "normalizedImageB64",
            "normalizedMediaType", "submitter", "tweetUrl", "contextNote", "ingestedAt"
       FROM "OsintSubmission"
      WHERE "extractionMethod" = $2
        AND (
          status = $1
          OR (status = $4 AND COALESCE("processingAttempts", 0) < $5)
        )
      ORDER BY "ingestedAt" ASC
      LIMIT $3`,
    SubmissionStatus.QUEUED,
    RETAIL_EXTRACTION_METHOD,
    limit,
    SubmissionStatus.ERROR_RETRYABLE,
    MAX_PROCESSING_ATTEMPTS,
  )) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    batchId: (r.batchId as string) ?? null,
    imageSha256: String(r.imageSha256),
    perceptualHash: (r.perceptualHash as string) ?? null,
    normalizedImageB64: (r.normalizedImageB64 as string) ?? null,
    normalizedMediaType: (r.normalizedMediaType as string) ?? null,
    submitter: String(r.submitter ?? ""),
    tweetUrl: (r.tweetUrl as string) ?? null,
    contextNote: (r.contextNote as string) ?? null,
    ingestedAt: r.ingestedAt ? new Date(r.ingestedAt as string).toISOString() : "",
  }));
}

/** Passe une ligne en PROCESSING (verrou optimiste : uniquement si encore QUEUED). */
export async function markProcessing(id: string): Promise<boolean> {
  // Le compteur est incrémenté À LA PRISE DU VERROU, pas à l'erreur : un
  // processus qui meurt en plein appel vision a bel et bien consommé une
  // tentative. L'incrémenter côté markError ne compterait que les échecs
  // proprement remontés, et une boucle de crash resterait infinie.
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "OsintSubmission"
        SET status = $1,
            "processingAttempts" = COALESCE("processingAttempts", 0) + 1,
            "updatedAt" = now()
      WHERE id = $2
        AND (
          status = $3
          OR (status = $4 AND COALESCE("processingAttempts", 0) < $5)
        )`,
    SubmissionStatus.PROCESSING,
    id,
    SubmissionStatus.QUEUED,
    SubmissionStatus.ERROR_RETRYABLE,
    MAX_PROCESSING_ATTEMPTS,
  );
  return Number(n) > 0;
}

/**
 * Marque une ligne en erreur (retryable/final) avec une raison.
 *
 * Une demande de ERROR_RETRYABLE sur une ligne dont les tentatives sont
 * épuisées est enregistrée en ERROR_FINAL : le statut doit dire ce qui va
 * réellement se passer. Laisser « retryable » sur une ligne que plus rien ne
 * reprendra reproduirait exactement le défaut qu'on corrige ici.
 */
export async function markError(id: string, status: SubmissionStatusT, reason: string): Promise<void> {
  const exhausted =
    status === SubmissionStatus.ERROR_RETRYABLE
      ? `CASE WHEN COALESCE("processingAttempts", 0) >= ${MAX_PROCESSING_ATTEMPTS}
              THEN '${SubmissionStatus.ERROR_FINAL}' ELSE $1 END`
      : `$1`;
  await prisma.$executeRawUnsafe(
    `UPDATE "OsintSubmission"
        SET status = ${exhausted}, "decisionReasons" = $2::jsonb, "updatedAt" = now()
      WHERE id = $3`,
    status,
    JSON.stringify([reason]),
    id,
  );
}

/**
 * Store de TRAITEMENT pour le processeur async : implémente SubmissionStore, mais
 * insertSubmission MET À JOUR la ligne retail `rowId` (créée à l'ingestion) au lieu
 * d'en insérer une nouvelle. findByImageSha256 renvoie null (la dédup a déjà eu
 * lieu à l'ingestion ; cette ligne EST la soumission). Evidence/link writes :
 * shadow, jamais publics (miroir de la route admin/process).
 */
export function buildRetailProcessingStore(rowId: string): SubmissionStore {
  return {
    async findByImageSha256() {
      return null; // dédup déjà faite à l'ingestion ; ne pas s'auto-détecter en doublon.
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
        trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
        verified: r.status === "AUTO_COMMITTED_SHADOW" || r.status === "RESOLVED_BY_REVIEW",
        ingestedAt: new Date(r.ingestedAt).toISOString(),
      }));
    },

    async insertEvidenceShadow(input) {
      const id = randomUUID();
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
        `${input.kolHandle ?? "unknown"} × ${input.tokenSymbol ? "$" + input.tokenSymbol : "(multi)"} — retail vision OSINT`,
        "Retail vision-auto shadow evidence (unpublished, never_public_raw original).",
        input.reviewStatus,
        input.kolHandle,
        input.tokenSymbol,
        input.imageSha256,
        input.extractionMethod,
        input.notes,
      )) as Array<{ id: string }>;
      const snapshotId = rows[0]?.id ?? id;

      // Chaîne de preuve (CC-OFFLINE-56) : lie l'EvidenceItem créé à la réception
      // (même sha256) au snapshot shadow. Best-effort, idempotent, jamais bloquant.
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "EvidenceLink" ("id","evidenceItemId","linkType","externalId","externalUrl","corroborationLevel","createdAt")
           SELECT gen_random_uuid()::text, ei."id", 'MANUAL', $2, NULL, 'NONE', now()
             FROM "EvidenceItem" ei
            WHERE ei."sha256" = $1
              AND NOT EXISTS (
                SELECT 1 FROM "EvidenceLink" el
                 WHERE el."evidenceItemId" = ei."id" AND el."linkType" = 'MANUAL' AND el."externalId" = $2)`,
          input.imageSha256,
          snapshotId,
        );
      } catch (e) {
        console.error("[retailStore] lien evidence-chain non créé (non bloquant):", e instanceof Error ? e.message : e);
      }
      return { id: snapshotId };
    },

    async upsertLinkDraft(input) {
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
        update: {},
        create: {
          kolHandle: input.kolHandle,
          contractAddress: input.contractAddress,
          chain: input.chain,
          tokenSymbol: input.tokenSymbol,
          role: "promoter",
          visibility: "draft",
          reviewStatus: input.reviewStatus,
          createdByBridge: true,
          note: input.note,
        } as never,
      });
      return { id: (link as { id: string }).id };
    },

    async insertSubmission(input) {
      // MET À JOUR la ligne retail existante (pas d'insertion d'une 2e ligne).
      await prisma.$executeRawUnsafe(
        `UPDATE "OsintSubmission"
            SET status = $1,
                "rawVisionPass1" = $2::jsonb,
                "rawVisionPass2" = $3::jsonb,
                "decisionReasons" = $4::jsonb,
                "claimsCount" = $5,
                "evidenceSnapshotId" = $6,
                "updatedAt" = now()
          WHERE id = $7`,
        input.status,
        JSON.stringify(input.rawVisionPass1 ?? null),
        JSON.stringify(input.rawVisionPass2 ?? null),
        JSON.stringify(input.decisionReasons ?? []),
        input.claimsCount,
        input.evidenceSnapshotId,
        rowId,
      );
      return { id: rowId };
    },
  };
}

/** Petit util partagé : sha256 hex d'un buffer. */
export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
