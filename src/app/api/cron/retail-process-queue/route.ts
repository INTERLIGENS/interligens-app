/**
 * src/app/api/cron/retail-process-queue/route.ts
 *
 * Déclencheur automatique de la file retail (vision asynchrone).
 *
 * POURQUOI CETTE ROUTE EXISTE
 * Le traitement retail n'avait qu'un seul point d'entrée — la route admin — et
 * personne ne l'appelait : ni cron, ni bouton d'UI, aucun appelant hors test.
 * La porte publique étant fermée (OSINT_RETAIL_SUBMIT_ENABLED absent,
 * OsintSubmission = 0 ligne), rien ne l'a jamais révélé. Le jour où la porte
 * s'ouvre, chaque soumission serait restée QUEUED indéfiniment : le pipeline
 * aurait été mort à l'arrivée, et la panne se serait vue en premier par des
 * utilisateurs, pas par nous.
 *
 * TROIS PORTES, TOUTES FERMÉES PAR DÉFAUT, ET AUCUNE OUVERTE ICI
 *   1. CRON_SECRET — sinon 401 ;
 *   2. OSINT_RETAIL_PROCESSING_ENABLED — sinon 403, file laissée intacte ;
 *   3. budget vision journalier — re-vérifié avant chaque appel.
 * Câbler n'est pas armer : cette route rend le traitement possible, elle ne
 * décide pas de le lancer.
 *
 * CADENCE : quotidienne (plan Vercel Hobby). Le plafond par run reste celui de
 * la route admin (MAX_LIMIT = 20 images) : le budget vision, lui, est de toute
 * façon la borne dure.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runProcessQueueBatch, clampLimit } from "@/lib/osint/retail/runProcessQueueBatch";
import { envInt } from "@/lib/config/envNumber";
import { prodWriteGuardResponse } from "@/lib/ops/prodWriteGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Un appel vision dure ~23 s (mesure Sprint C1). 10 images = ~230 s, sous les
 * 300 s de Vercel avec marge. Le budget vision plafonne de toute façon plus tôt
 * dans la plupart des cas.
 */
const DEFAULT_CRON_LIMIT = 10;

// Gate cron FAIL-CLOSED en temps constant, aligné sur les autres crons du repo.
function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Barrière d'écriture production. Un Preview porte le même CRON_SECRET et
  // la même DATABASE_URL que la Production : l'authentification ci-dessus ne
  // distingue pas les deux. Voir docs/PREVIEW_PROD_ISOLATION.md.
  const blockedByProdGuard = prodWriteGuardResponse("/api/cron/retail-process-queue");
  if (blockedByProdGuard) return blockedByProdGuard;

  const outcome = await runProcessQueueBatch(
    clampLimit(envInt("OSINT_RETAIL_CRON_LIMIT", DEFAULT_CRON_LIMIT)),
  );

  // Kill switch fermé ou migration absente : 200 avec le motif, pas une erreur.
  // Un cron qui répond 403/412 tous les jours pollue le monitoring alors que
  // l'état est nominal et voulu.
  if (!outcome.ok) {
    return NextResponse.json({ ok: true, skipped: outcome.code, detail: outcome.detail });
  }

  const { ok: _ok, ...rest } = outcome;
  return NextResponse.json({ ok: true, ...rest });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return GET(req);
}
