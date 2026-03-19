/**
 * src/lib/surveillance/signals/windowClassifier.ts
 * Classifie la fenêtre temporelle entre post et vente
 */

export type WindowBucket = "BLATANT" | "PROBABLE" | "POSSIBLE" | null;

export interface WindowResult {
  bucket: WindowBucket;
  windowMinutes: number;
  severity: "danger" | "warn" | "info" | null;
  confidence: "high" | "medium" | "low" | null;
}

export function classifyWindow(t0: Date, t1: Date): WindowResult {
  const diffMs = t1.getTime() - t0.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  // Vente AVANT le post — pas un signal
  if (diffMin < 0) return { bucket: null, windowMinutes: diffMin, severity: null, confidence: null };

  // BLATANT : 15min → 2h
  if (diffMin >= 15 && diffMin <= 120) {
    return { bucket: "BLATANT", windowMinutes: diffMin, severity: "danger", confidence: "high" };
  }

  // PROBABLE : 2h → 24h
  if (diffMin > 120 && diffMin <= 1440) {
    return { bucket: "PROBABLE", windowMinutes: diffMin, severity: "warn", confidence: "medium" };
  }

  // POSSIBLE : 1j → 7j
  if (diffMin > 1440 && diffMin <= 10080) {
    return { bucket: "POSSIBLE", windowMinutes: diffMin, severity: "info", confidence: "low" };
  }

  return { bucket: null, windowMinutes: diffMin, severity: null, confidence: null };
}
