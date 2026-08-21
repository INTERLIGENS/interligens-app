/**
 * GET /api/cron/reaper
 *
 * Cron Vercel quotidien — clôture les batches d'ingestion restés « running ».
 * Auth : Bearer ${CRON_SECRET}.
 *
 * POURQUOI UN CRON DÉDIÉ, ET PAS UN APPEL EN TÊTE D'`ingestSource()`
 * -----------------------------------------------------------------
 * Décision GPT/fondateur du 2026-08-21. Le reaper surveille le pipeline
 * d'ingestion ; le câbler DANS ce pipeline le ferait mourir avec lui.
 * Or c'est précisément quand l'ingestion tombe en panne que les zombies
 * s'accumulent — un reaper inline serait absent au seul moment où il compte.
 * Il ne doit pas dépendre de ce qu'il surveille.
 *
 * Conséquence assumée : cette route est le SEUL déclencheur du reaper. Si le
 * cron lui-même cesse de tourner, plus rien ne fauche — mais le watchdog
 * (`watcher-health.mjs`) continue de compter les `running` > 1 h et d'alerter.
 *
 * CE QU'IL ÉCRIT
 * --------------
 * Un UPDATE ciblé sur chaque ligne zombie (gardé par `status = 'running'`,
 * donc idempotent) et un INSERT dans `intel_audit_log` par fermeture.
 * AUCUNE suppression de ligne historique, jamais.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { reapZombieBatches } from "@/lib/intelligence/reaper";
import { prodWriteGuardResponse } from "@/lib/ops/prodWriteGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 60 s suffit très largement : le reaper lit une poignée de lignes `running`
 * (10 au pire mesuré) et fait 2 écritures par ligne. Il n'itère JAMAIS sur le
 * jeu de données ingéré — c'est ce qui tue l'ingestion elle-même à 300 s.
 */
export const maxDuration = 60;

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

/**
 * `?dryRun=1` — inspecter sans écrire. Le défaut de la ROUTE est d'écrire
 * (c'est un cron, il est là pour faucher) ; le défaut de la FONCTION reste le
 * dry-run, d'où le `dryRun: false` explicite ci-dessous.
 */
async function handle(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Barrière d'écriture production. Un Preview porte le même CRON_SECRET et
  // la même DATABASE_URL que la Production : l'authentification ci-dessus ne
  // distingue pas les deux. Voir docs/PREVIEW_PROD_ISOLATION.md.
  const blockedByProdGuard = prodWriteGuardResponse("/api/cron/reaper");
  if (blockedByProdGuard) return blockedByProdGuard;

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const report = await reapZombieBatches({ dryRun });
    return NextResponse.json({
      ok: true,
      dryRun: report.dryRun,
      ttlSeconds: report.ttlSeconds,
      scanned: report.scanned,
      reaped: report.reaped,
      alreadyClosed: report.alreadyClosed.length,
      batches: report.verdicts.map((v) => ({
        batchId: v.batchId,
        sourceSlug: v.sourceSlug,
        stuckSeconds: v.ageSeconds,
        status: v.status,
        writesProven: v.evidence.length > 0,
        evidence: v.evidence,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

// POST — déclenchement manuel / CLI, même authentification.
export async function POST(req: NextRequest) {
  return handle(req);
}
