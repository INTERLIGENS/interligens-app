/**
 * src/lib/osint/observability/computeDashboard.ts
 *
 * SPRINT B — Cœur PUR de l'observabilité OSINT (zéro IO, testable sur mock).
 * Prend la liste brute des soumissions (+ contexte file de revue) et calcule les
 * métriques du plan v2. Aucune donnée inventée : si la liste est vide, tout est
 * à 0 et `hasData=false` (l'UI affiche « en attente de données réelles »).
 *
 * Coût vision : on réutilise le pattern de coût X API (nb d'unités × coût
 * unitaire). Une soumission = 1 passe vision si rawVisionPass2 est absent, 2
 * passes sinon (LOCK 1 double-lecture). VISION_COST_PER_PASS_USD est une ESTIME
 * (sonnet-4-5, ~1 screenshot + sortie courte) — configurable, pas une mesure.
 */

import { SubmissionStatus, PendingReason } from "../contracts";

/** Estime du coût d'UNE passe vision (image + sortie courte), claude-sonnet-4-5. */
export const VISION_COST_PER_PASS_USD = 0.017;

/** Vue minimale d'une soumission pour le calcul (injectée). */
export interface SubmissionLite {
  status: string;             // SubmissionStatus (string brute)
  pendingReason: string | null;
  /** nombre de passes vision effectivement exécutées (1 simple, 2 double-lecture). */
  visionPasses: number;
  ingestedAt: string;         // ISO 8601 UTC
  /** instant de traitement final (resolved/rejected/committed), si connu. */
  processedAt: string | null;
  /** trace décision : sert à compter les erreurs Helius / retryable. */
  decisionReasons: string[];
}

export interface RateBucket {
  count: number;
  /** pourcentage 0-100, arrondi à 1 décimale. */
  pct: number;
}

export interface DashboardMetrics {
  hasData: boolean;
  totalSubmissions: number;
  /** volume par jour calendaire UTC (YYYY-MM-DD → count), trié décroissant. */
  perDay: Array<{ day: string; count: number }>;
  /** taux par issue de pipeline. */
  rates: {
    autoCommit: RateBucket;
    pending: RateBucket;
    rejected: RateBucket;
    duplicate: RateBucket;
    error: RateBucket;
  };
  /** raisons de pending dominantes, triées décroissant. */
  topPendingReasons: Array<{ reason: string; count: number }>;
  vision: {
    totalPasses: number;
    costPerPassUsd: number;
    estimatedCostUsd: number;
  };
  helius: {
    /** checks indisponibles (unavailable) — non bloquants mais à surveiller. */
    unavailable: number;
    /** mints introuvables (not_found) — CA factices. */
    notFound: number;
    /** soumissions en ERROR_RETRYABLE. */
    retryable: number;
    /** soumissions en ERROR_FINAL. */
    finalErrors: number;
  };
  backlog: {
    /** items PENDING_REVIEW en attente. */
    pending: number;
    /** âge du plus ancien pending, en heures (null si aucun). */
    oldestAgeHours: number | null;
  };
  /** temps moyen de traitement (ingest → processed), en heures (null si aucun). */
  avgProcessingHours: number | null;
}

function rate(count: number, total: number): RateBucket {
  return { count, pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 };
}

function dayKey(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

const KNOWN_PENDING_REASONS = new Set<string>(Object.values(PendingReason));

export function computeDashboard(rows: SubmissionLite[], nowIso: string): DashboardMetrics {
  const total = rows.length;
  const nowMs = Date.parse(nowIso);

  // ── volume par jour ─────────────────────────────────────────────────────────
  const dayMap = new Map<string, number>();
  for (const r of rows) {
    const d = dayKey(r.ingestedAt);
    if (d) dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  }
  const perDay = [...dayMap.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));

  // ── taux par issue ──────────────────────────────────────────────────────────
  const is = (s: string) => rows.filter((r) => r.status === s).length;
  const autoCommit = is(SubmissionStatus.AUTO_COMMITTED_SHADOW);
  const pending = is(SubmissionStatus.PENDING_REVIEW);
  const rejected =
    is(SubmissionStatus.REJECTED_BY_REVIEW) + is(SubmissionStatus.PRECHECK_REJECTED);
  const duplicate = is(SubmissionStatus.DUPLICATE);
  const error = is(SubmissionStatus.ERROR_RETRYABLE) + is(SubmissionStatus.ERROR_FINAL);

  // ── top pending reasons ──────────────────────────────────────────────────────
  const prMap = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== SubmissionStatus.PENDING_REVIEW) continue;
    const reason = r.pendingReason && KNOWN_PENDING_REASONS.has(r.pendingReason) ? r.pendingReason : "UNSPECIFIED";
    prMap.set(reason, (prMap.get(reason) ?? 0) + 1);
  }
  const topPendingReasons = [...prMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // ── coût vision ───────────────────────────────────────────────────────────────
  const totalPasses = rows.reduce((a, r) => a + (Number.isFinite(r.visionPasses) ? r.visionPasses : 0), 0);
  const estimatedCostUsd = Math.round(totalPasses * VISION_COST_PER_PASS_USD * 100) / 100;

  // ── erreurs Helius / retryable ─────────────────────────────────────────────────
  const countReason = (needle: string) =>
    rows.filter((r) => r.decisionReasons.some((x) => x.toLowerCase().includes(needle))).length;
  const helius = {
    unavailable: countReason("indisponible") + countReason("unavailable"),
    notFound: countReason("introuvable") + countReason("not_found") + countReason("not found"),
    retryable: is(SubmissionStatus.ERROR_RETRYABLE),
    finalErrors: is(SubmissionStatus.ERROR_FINAL),
  };

  // ── backlog ────────────────────────────────────────────────────────────────────
  let oldestPendingMs: number | null = null;
  for (const r of rows) {
    if (r.status !== SubmissionStatus.PENDING_REVIEW) continue;
    const t = Date.parse(r.ingestedAt);
    if (Number.isNaN(t)) continue;
    if (oldestPendingMs === null || t < oldestPendingMs) oldestPendingMs = t;
  }
  const oldestAgeHours =
    oldestPendingMs !== null && !Number.isNaN(nowMs)
      ? Math.round(((nowMs - oldestPendingMs) / 3_600_000) * 10) / 10
      : null;

  // ── temps moyen de traitement ───────────────────────────────────────────────────
  const durations: number[] = [];
  for (const r of rows) {
    if (!r.processedAt) continue;
    const a = Date.parse(r.ingestedAt);
    const b = Date.parse(r.processedAt);
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) continue;
    durations.push(b - a);
  }
  const avgProcessingHours =
    durations.length > 0
      ? Math.round((durations.reduce((x, y) => x + y, 0) / durations.length / 3_600_000) * 10) / 10
      : null;

  return {
    hasData: total > 0,
    totalSubmissions: total,
    perDay,
    rates: {
      autoCommit: rate(autoCommit, total),
      pending: rate(pending, total),
      rejected: rate(rejected, total),
      duplicate: rate(duplicate, total),
      error: rate(error, total),
    },
    topPendingReasons,
    vision: { totalPasses, costPerPassUsd: VISION_COST_PER_PASS_USD, estimatedCostUsd },
    helius,
    backlog: { pending, oldestAgeHours },
    avgProcessingHours,
  };
}
