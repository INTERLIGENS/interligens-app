/**
 * src/app/api/admin/osint/review/_shared.ts
 *
 * SPRINT B — Mutualise le préflight + le parse pour les 3 routes de review.
 * Préflight 412 : OsintReviewAudit est une table additive non encore appliquée
 * (MIGRATION_osint_review_audit_v1.sql). Sans elle, aucune action ne peut écrire
 * son audit → on refuse plutôt que d'agir sans traçabilité.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReviewItemType, type ReviewItemRef } from "@/lib/osint/review";

export async function auditTableReady(): Promise<string | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'OsintReviewAudit' LIMIT 1`,
  )) as unknown[];
  if (!rows.length) {
    return "OsintReviewAudit table missing — apply MIGRATION_osint_review_audit_v1.sql first.";
  }
  return null;
}

export function parseRef(body: { type?: unknown; id?: unknown }): ReviewItemRef | null {
  const t = body.type;
  const id = body.id;
  if (typeof id !== "string" || !id) return null;
  if (t === ReviewItemType.SUBMISSION || t === ReviewItemType.LINK || t === ReviewItemType.SIGNAL) {
    return { type: t, id };
  }
  return null;
}

/** Mappe un échec de handler vers un code HTTP. */
export function failStatus(error: string | undefined): number {
  if (!error) return 422;
  if (error.includes("not found") && error.includes("item")) return 404;
  return 422; // refus métier (CA factice, check indisponible, raison manquante…)
}

export function badRequest(msg: string): NextResponse {
  return NextResponse.json({ error: msg }, { status: 400 });
}
