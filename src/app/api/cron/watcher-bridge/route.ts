/**
 * src/app/api/cron/watcher-bridge/route.ts
 *
 * Déclencheur automatique du Watcher Bridge (promotion des SocialPostCandidate
 * en KolTokenLink DRAFT + SignalIntake).
 *
 * POURQUOI CETTE ROUTE EXISTE
 * Le module vivait depuis Sprint 4 avec, en tête de
 * promoteWatcherSignalsToDraft.ts, la mention « Not wired into the cron ». Il
 * n'a jamais eu de déclencheur : les 6 seuls runs de son histoire sont une
 * session manuelle des 28-29 juin 2026. Pendant ce temps le watcher-v2 (cron
 * quotidien, X API facturée) a continué d'empiler des candidats que personne ne
 * consommait. Collecte payante sans consommateur : c'est ce que cette route
 * ferme.
 *
 * CE QU'ELLE NE FAIT PAS
 * Elle n'arme rien toute seule. runBridgeJob reste derrière son kill switch
 * WATCHER_BRIDGE_ENABLED (défaut false) : tant qu'il n'est pas posé, chaque
 * passage écrit une ligne JobRunLog status='disabled' — visible dans l'audit,
 * jamais un skip silencieux. Câbler et armer sont deux gestes distincts, et
 * armer est une décision humaine.
 *
 * PLAFOND PAR KOL
 * Le rattrapage du 2026-08-14 (150 candidats) a produit 44 drafts dont 42 pour
 * un seul handle. Sans plafond, un KOL bavard noie la file de revue admin et
 * les autres signaux deviennent invisibles. WATCHER_BRIDGE_MAX_PER_KOL borne
 * donc chaque run ; le reste du backlog sort aux runs suivants.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { PrismaClient } from "@prisma/client";
import { runBridgeJob } from "@/lib/watcher-bridge/runBridgeJob";
import { envInt } from "@/lib/config/envNumber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Budget de candidats par run. Mesure du 2026-08-14 : 150 candidats en 66,6 s,
 * soit ~444 ms/candidat. 150 tient donc dans 300 s avec une marge de 4x, même
 * si DexScreener ralentit. Au-delà, le run serait tronqué par Vercel au milieu
 * d'un candidat.
 */
const DEFAULT_LIMIT = 150;

/** Drafts maximum par KOL et par run (anti-saturation de la file de revue). */
const DEFAULT_MAX_PER_KOL = 10;

// Gate cron FAIL-CLOSED, aligné sur les autres crons du repo. CRON_SECRET
// absente ou vide → 401, jamais un secret attendu qui vaut "Bearer undefined".
// Comparaison en temps constant.
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

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = envInt("WATCHER_BRIDGE_LIMIT", DEFAULT_LIMIT);
  const maxPerKol = envInt("WATCHER_BRIDGE_MAX_PER_KOL", DEFAULT_MAX_PER_KOL);

  const prisma = new PrismaClient();
  try {
    const r = await runBridgeJob(prisma, { limit, maxPerKol });
    return NextResponse.json({
      ok: true,
      status: r.status,
      dryRun: r.dryRun,
      jobRunLogId: r.jobRunLogId,
      reason: r.reason,
      summary: r.summary
        ? {
            selected: r.summary.selected,
            processed: r.summary.processed,
            createdDraftLinks: r.summary.createdDraftLinks,
            createdEvidenceSnapshots: r.summary.createdEvidenceSnapshots,
            ambiguous: r.summary.ambiguous,
            noKolProfileSkipped: r.summary.noKolProfileSkipped,
            kolCapSkipped: r.summary.kolCapSkipped,
            errors: r.summary.errors,
            apiCallsDexScreener: r.summary.apiCallsDexScreener,
            apiCallsHelius: r.summary.apiCallsHelius,
            durationMs: r.summary.durationMs,
          }
        : null,
    });
  } catch (err) {
    console.error("[cron/watcher-bridge] error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
