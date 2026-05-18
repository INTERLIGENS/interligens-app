/**
 * REFLEX V1 — admin calibration page copy.
 *
 * Every user-facing string in /admin/reflex/calibration is exported from
 * here, so the CI gate in admin-copy.test.ts can lint the full surface
 * with assertClean() and prove no banned token leaks into the admin UI.
 *
 * Admin-only — EN only (no FR variants). The forbidden-words list is
 * applied verbatim regardless.
 */

export const ADMIN_COPY = {
  pageTitle: "REFLEX — calibration dashboard",
  pageSubtitle:
    "Aggregated metrics for shadow-phase calibration. Refresh manually.",

  windowFilter: {
    label: "Window",
    h24: "24h",
    d7: "7 days",
    d30: "30 days",
  },

  alerts: {
    overfiring:
      "REFLEX may be overfiring — global STOP rate exceeds 30%. Review the verdict matrix calibration.",
    underfiring:
      "REFLEX may be underfiring — global STOP rate below 5%. Investigate whether convergence thresholds are too strict.",
    slow:
      "Performance degradation — latency p95 exceeds 5 seconds.",
  },

  sections: {
    overview: "Overview",
    verdictDistribution: "Verdict distribution",
    dailyStopRate: "Daily STOP rate",
    inputType: "Input type breakdown",
    latency: "Latency",
    topNarratives: "Top narrative scripts triggered",
    topHandles: "Top X handles analyzed",
    modeBreakdown: "Mode breakdown",
    last50: "Last 50 analyses",
  },

  empty: {
    noAnalyses:
      "No analyses yet in this window. Once REFLEX shadow traffic arrives, metrics will populate here.",
    noNarratives:
      "No narrative script matches in this window.",
    noHandles:
      "No X handles analyzed in this window.",
  },

  labels: {
    total: "Total",
    stopRate: "STOP rate",
    verdictStop: "STOP",
    verdictWait: "WAIT",
    verdictVerify: "VERIFY",
    verdictNoSignal: "NO_CRITICAL_SIGNAL",
    p50: "p50",
    p95: "p95",
    p99: "p99",
    shadow: "SHADOW",
    public: "PUBLIC",
    flagAsFp: "Flag as false positive",
    unflagFp: "Unflag",
    flaggedFp: "Flagged as FP",
    detail: "View detail",
    id: "ID",
    createdAt: "Created",
    confidence: "Confidence",
    latencyMs: "Latency (ms)",
    inputType: "Input type",
    verdict: "Verdict",
  },

  detailPlaceholder:
    "Detail view ships with the investigator UI (next commit). For now, the ID is shown for cross-reference with the database.",
} as const;
