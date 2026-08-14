/**
 * src/app/api/admin/osint/retail/process-queue/route.ts
 *
 * SPRINT C1 — POST /api/admin/osint/retail/process-queue (ADMIN, async vision).
 *
 * Déclenchement MANUEL de la file retail. Le déclenchement AUTOMATIQUE vit
 * désormais dans /api/cron/retail-process-queue ; les deux appellent la même
 * fonction (runProcessQueueBatch), de sorte qu'il n'existe qu'une seule
 * implémentation des invariants — kill switch, budget vision, trustTier forcé.
 *
 * Historique : cette route a longtemps été le SEUL point d'entrée, sans cron ni
 * bouton d'UI. Une soumission acceptée serait donc restée QUEUED indéfiniment.
 *
 * INVARIANTS (portés par runProcessQueueBatch) : OSINT_RETAIL_PROCESSING_ENABLED
 * fermé par défaut ; budget vision journalier re-vérifié avant chaque appel ;
 * trustTier forcé anonymous_retail ; toutes les écritures shadow / non publiques.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { runProcessQueueBatch, clampLimit } from "@/lib/osint/retail/runProcessQueueBatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdminApi(req);
  if (denied) return denied;

  let body: { limit?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const outcome = await runProcessQueueBatch(clampLimit(body.limit));

  if (!outcome.ok) {
    const status = outcome.code === "processing_disabled" ? 403 : 412;
    return NextResponse.json({ error: outcome.code, detail: outcome.detail }, { status });
  }

  const { ok: _ok, ...rest } = outcome;
  return NextResponse.json({ ok: true, ...rest });
}
