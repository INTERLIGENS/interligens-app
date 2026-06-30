/**
 * src/lib/osint/review/prismaReviewStore.ts
 *
 * SPRINT B — Implémentation prisma/SQL-brut de ReviewStore. Toutes les écritures
 * sont SHADOW : aucune ne pose isPublic=true, visibility='public',
 * reviewStatus='approved_public' ni publishStatus='published'.
 *
 * OsintSubmission & OsintReviewAudit sont des tables additives non encore
 * appliquées (cf. MIGRATION_osint_submission_v1.sql / MIGRATION_osint_review_
 * audit_v1.sql) — les routes font un préflight 412 avant d'utiliser ce store.
 */

import { prisma } from "@/lib/prisma";
import { SubmissionStatus } from "../contracts";
import {
  ReviewItemType,
  type ReviewStore,
  type ReviewItemRef,
  type ReviewItemState,
  type ReviewAuditRecord,
  type ReviewStamp,
} from "./reviewContracts";

export function buildPrismaReviewStore(): ReviewStore {
  return {
    async getItem(ref: ReviewItemRef): Promise<ReviewItemState | null> {
      if (ref.type === ReviewItemType.SUBMISSION) {
        const rows = (await prisma.$queryRawUnsafe(
          `SELECT s.id, s.status, s."pendingReason", s."trustTier",
                  e."kolHandle" AS "kolHandle", e."tokenSymbol" AS "tokenSymbol", e."isPublic" AS "isPublic"
             FROM "OsintSubmission" s
             LEFT JOIN "EvidenceSnapshot" e ON e."sha256" = s."imageSha256"
            WHERE s.id = $1 LIMIT 1`,
          ref.id,
        )) as Array<Record<string, unknown>>;
        const r = rows[0];
        if (!r) return null;
        return {
          ref, status: String(r.status), visibility: null,
          isPublic: (r.isPublic as boolean) ?? null,
          kolHandle: (r.kolHandle as string) ?? null,
          tokenSymbol: (r.tokenSymbol as string) ?? null,
          contractAddress: null, chain: null,
        };
      }
      if (ref.type === ReviewItemType.LINK) {
        const rows = (await prisma.$queryRawUnsafe(
          `SELECT id, "reviewStatus", visibility, "kolHandle", "tokenSymbol", "contractAddress", chain
             FROM "KolTokenLink" WHERE id = $1 LIMIT 1`,
          ref.id,
        )) as Array<Record<string, unknown>>;
        const r = rows[0];
        if (!r) return null;
        return {
          ref, status: String(r.reviewStatus), visibility: (r.visibility as string) ?? null,
          isPublic: null,
          kolHandle: (r.kolHandle as string) ?? null,
          tokenSymbol: (r.tokenSymbol as string) ?? null,
          contractAddress: (r.contractAddress as string) ?? null,
          chain: (r.chain as string) ?? null,
        };
      }
      // SIGNAL
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT id, status, "kolHandle", "detectedSymbols", "detectedAddresses", "canonicalChain"
           FROM "SignalIntake" WHERE id = $1 LIMIT 1`,
        ref.id,
      )) as Array<Record<string, unknown>>;
      const r = rows[0];
      if (!r) return null;
      const symbols = Array.isArray(r.detectedSymbols) ? (r.detectedSymbols as string[]) : [];
      const addrs = Array.isArray(r.detectedAddresses) ? (r.detectedAddresses as string[]) : [];
      return {
        ref, status: String(r.status), visibility: null, isPublic: null,
        kolHandle: (r.kolHandle as string) ?? null,
        tokenSymbol: symbols[0] ?? null,
        contractAddress: addrs[0] ?? null,
        chain: (r.canonicalChain as string) ?? null,
      };
    },

    async setSubmissionStatus(id: string, status: SubmissionStatus, review: ReviewStamp): Promise<void> {
      await prisma.$executeRawUnsafe(
        `UPDATE "OsintSubmission" SET status = $2, "updatedAt" = now() WHERE id = $1`,
        id, status,
      );
      void review; // OsintSubmission n'a pas de colonnes reviewedBy/At/Note — la trace vit dans l'audit.
    },

    async setSignalStatus(id, status, review): Promise<void> {
      await prisma.$executeRawUnsafe(
        `UPDATE "SignalIntake"
            SET status = $2, "reviewedBy" = $3, "reviewedAt" = $4::timestamptz, "reviewNote" = $5, "updatedAt" = now()
          WHERE id = $1`,
        id, status, review.reviewedBy, review.reviewedAt, review.reviewNote,
      );
    },

    async setLinkReviewStatus(id, reviewStatus, review): Promise<void> {
      // visibility N'EST PAS touchée : un lien résolu reste 'draft' (shadow).
      await prisma.$executeRawUnsafe(
        `UPDATE "KolTokenLink"
            SET "reviewStatus" = $2, "reviewedBy" = $3, "reviewedAt" = $4::timestamptz, "reviewNote" = $5
          WHERE id = $1`,
        id, reviewStatus, review.reviewedBy, review.reviewedAt, review.reviewNote,
      );
    },

    async writeAudit(audit: ReviewAuditRecord): Promise<void> {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "OsintReviewAudit"
            ("id","itemType","itemId","action","actor","reason","beforeJson","afterJson","createdAt")
         VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::timestamptz)`,
        audit.itemType, audit.itemId, audit.action, audit.actor, audit.reason,
        JSON.stringify(audit.before ?? null), JSON.stringify(audit.after ?? null), audit.createdAt,
      );
    },

    async isEscalated(ref: ReviewItemRef): Promise<boolean> {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT 1 FROM "OsintReviewAudit" WHERE "itemId" = $1 AND action = 'ESCALATE' LIMIT 1`,
        ref.id,
      )) as unknown[];
      return rows.length > 0;
    },
  };
}
