/**
 * src/lib/osint/observability/loadDashboard.ts
 *
 * SPRINT B — Chargement READ-ONLY des métriques OSINT. Lit OsintSubmission et
 * délègue le calcul au cœur PUR computeDashboard. DÉFENSIF : si OsintSubmission
 * n'existe pas encore (table additive non appliquée), renvoie un tableau vide →
 * le dashboard affiche honnêtement « en attente de données réelles ».
 *
 * Le backlog de revue (file standard) est aussi exposé tel que mesuré côté
 * KolTokenLink/SignalIntake, indépendant de OsintSubmission, pour rester utile
 * tant que le pipeline vision n'écrit pas encore en réel.
 */

import { prisma } from "@/lib/prisma";
import { computeDashboard, type SubmissionLite, type DashboardMetrics } from "./computeDashboard";

export interface DashboardView {
  metrics: DashboardMetrics;
  /** false si la table OsintSubmission n'existe pas encore. */
  submissionSourceLive: boolean;
  /** backlog legacy (sources bridge), toujours mesurable. */
  legacyBacklog: { links: number; signals: number };
  generatedAt: string;
}

async function tableExists(name: string): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
    name,
  )) as unknown[];
  return rows.length > 0;
}

export async function loadDashboard(nowIso?: string): Promise<DashboardView> {
  const now = nowIso ?? new Date().toISOString();
  const submissionSourceLive = await tableExists("OsintSubmission");

  let rows: SubmissionLite[] = [];
  if (submissionSourceLive) {
    const raw = (await prisma.$queryRawUnsafe(
      `SELECT status, "pendingReason", "decisionReasons",
              ("rawVisionPass2" IS NOT NULL) AS "twoPass",
              "ingestedAt", "updatedAt",
              status IN ('AUTO_COMMITTED_SHADOW','RESOLVED_BY_REVIEW','REJECTED_BY_REVIEW') AS "isProcessed"
         FROM "OsintSubmission"`,
    )) as Array<Record<string, unknown>>;
    rows = raw.map((r) => ({
      status: String(r.status),
      pendingReason: (r.pendingReason as string) ?? null,
      visionPasses: r.twoPass ? 2 : 1,
      ingestedAt: r.ingestedAt ? new Date(r.ingestedAt as string).toISOString() : now,
      processedAt: r.isProcessed && r.updatedAt ? new Date(r.updatedAt as string).toISOString() : null,
      decisionReasons: Array.isArray(r.decisionReasons) ? (r.decisionReasons as unknown[]).map(String) : [],
    }));
  }

  const links = (await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "KolTokenLink" WHERE "reviewStatus" = 'pending_review' AND visibility <> 'public'`,
  )) as Array<{ n: number }>;
  const signals = (await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "SignalIntake" WHERE status = 'needs_resolution'`,
  )) as Array<{ n: number }>;

  return {
    metrics: computeDashboard(rows, now),
    submissionSourceLive,
    legacyBacklog: { links: links[0]?.n ?? 0, signals: signals[0]?.n ?? 0 },
    generatedAt: now,
  };
}
