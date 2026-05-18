/**
 * REFLEX V1 — coordination adapter.
 *
 * Wraps getCoordinationSignalsForProfile from src/lib/coordination. Only
 * runs when the resolved input is an X handle (the Coordinated Shill
 * Cluster and adjacent signals are profile-centric in V1).
 *
 * Per spec, a coordination signal with overall strength ≥ moderate is a
 * standalone WAIT trigger. The verdict layer consumes the strongest signal
 * for that branch and uses the remaining (weaker) signals for the
 * convergence-count rule.
 */
import {
  getCoordinationSignalsForProfile,
  type CoordinationContext,
  type SignalStrength,
} from "@/lib/coordination/coordinationSignals";
import type {
  ReflexEngineOutput,
  ReflexResolvedInput,
  ReflexSignal,
  ReflexSignalSeverity,
} from "../types";

function mapStrength(s: SignalStrength): ReflexSignalSeverity {
  if (s === "strong") return "STRONG";
  if (s === "moderate") return "MODERATE";
  return "WEAK";
}

function strengthConfidence(s: SignalStrength | null): number {
  if (s === "strong") return 0.85;
  if (s === "moderate") return 0.65;
  if (s === "weak") return 0.4;
  return 0;
}

export async function runCoordination(
  input: ReflexResolvedInput,
): Promise<ReflexEngineOutput<CoordinationContext>> {
  const start = Date.now();
  const ms = () => Date.now() - start;

  if (input.type !== "X_HANDLE" || !input.handle) {
    return { engine: "coordination", ran: false, ms: ms(), signals: [] };
  }

  try {
    const ctx = await getCoordinationSignalsForProfile(input.handle);
    const confNum = strengthConfidence(ctx.overallStrength);

    const signals: ReflexSignal[] = ctx.signals.map((s) => ({
      source: "coordination" as const,
      code: `coordination.${s.type}`,
      severity: mapStrength(s.strength),
      confidence: confNum,
      stopTrigger: false,
      payload: {
        type: s.type,
        strength: s.strength,
        labelEn: s.labelEn,
        labelFr: s.labelFr,
        reasonSummary: s.reasonSummary,
        supportingCount: s.supportingCount,
        supportingFlags: s.supportingFlags,
      },
    }));

    return {
      engine: "coordination",
      ran: true,
      ms: ms(),
      signals,
      raw: ctx,
    };
  } catch (e) {
    return {
      engine: "coordination",
      ran: false,
      ms: ms(),
      signals: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
