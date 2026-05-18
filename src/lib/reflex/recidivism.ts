/**
 * REFLEX V1 — recidivism check.
 *
 * Counts distinct caseIds linked to a KOL handle via the KolCase table.
 * The spec's STOP-convergence rule needs recidivist=true (≥
 * RECIDIVIST_MIN_PRIOR_CASES, default 2) combined with ≥
 * STOP_CONVERGENCE_MIN_CRITICAL_DRIVERS CRITICAL on-chain signals and a
 * global confidence ≥ STOP_CONVERGENCE_CONFIDENCE_THRESHOLD.
 *
 * V1: live Prisma query, no cache. The signal is exposed with
 * stopTrigger=false — only the verdict layer combines it with other
 * signals to satisfy the convergence rule.
 */
import { prisma } from "@/lib/prisma";
import { RECIDIVIST_MIN_PRIOR_CASES } from "./constants";
import type {
  ReflexEngineOutput,
  ReflexResolvedInput,
  ReflexSignal,
} from "./types";

export type RecidivismResult = {
  recidivist: boolean;
  priorCaseCount: number;
  caseIds: string[];
};

export async function runRecidivism(
  input: ReflexResolvedInput,
): Promise<ReflexEngineOutput<RecidivismResult>> {
  const start = Date.now();
  const ms = () => Date.now() - start;

  if (input.type !== "X_HANDLE" || !input.handle) {
    return { engine: "recidivism", ran: false, ms: ms(), signals: [] };
  }

  try {
    const cases = await prisma.kolCase.findMany({
      where: { kolHandle: { equals: input.handle, mode: "insensitive" } },
      select: { caseId: true },
    });
    const caseIds = Array.from(new Set(cases.map((c) => c.caseId)));
    const priorCaseCount = caseIds.length;
    const recidivist = priorCaseCount >= RECIDIVIST_MIN_PRIOR_CASES;
    const result: RecidivismResult = { recidivist, priorCaseCount, caseIds };

    const signals: ReflexSignal[] = [];
    if (priorCaseCount > 0) {
      signals.push({
        source: "recidivism",
        code: recidivist ? "recidivism.recidivist" : "recidivism.prior_case",
        severity: recidivist ? "STRONG" : "MODERATE",
        confidence: recidivist ? 0.9 : 0.7,
        stopTrigger: false,
        payload: { ...result },
      });
    }

    return {
      engine: "recidivism",
      ran: true,
      ms: ms(),
      signals,
      raw: result,
    };
  } catch (e) {
    return {
      engine: "recidivism",
      ran: false,
      ms: ms(),
      signals: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
