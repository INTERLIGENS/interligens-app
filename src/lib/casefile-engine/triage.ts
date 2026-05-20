/**
 * Casefile Engine V1 — operational triage.
 *
 * V1 rule: the automated triage never returns category C. C is reserved for
 * human counsel review and is set out-of-band on the draft, never by this
 * function. The closest signal we surface is the additive flag
 * `potentialCivilReviewFlag`, which marks that a counsel may want to assess
 * civil-recovery viability outside the automated triage — it is NOT an
 * INTERLIGENS recommendation.
 *
 * Cluster flag is also additive: it never replaces the primary triage.
 */

export interface TriageResult {
  // V1: never 'C' in primary. C does not appear in automated output.
  primary: "A" | "B" | "E";
  primaryDescription: string;
  potentialCivilReviewFlag: boolean;
  potentialCivilReviewDescription?: string;
  clusterFlag: boolean;
  clusterFlagDescription?: string;
}

export interface TriageInput {
  cexTouchpointDetected?: unknown;
  obfuscationBreakpointCandidate?: boolean;
  amountEur?: number | null;
}

export function computeTriage(
  draft: TriageInput,
  similarReportsCount = 0,
): TriageResult {
  const cexes = Array.isArray(draft.cexTouchpointDetected)
    ? draft.cexTouchpointDetected
    : [];
  const hasCEXTouchpoint = cexes.length > 0;
  const hasObfuscation = Boolean(draft.obfuscationBreakpointCandidate);
  const amount = draft.amountEur ?? 0;

  let primary: TriageResult["primary"] = "E";
  let primaryDescription = "E — Documentation only, no immediate operational route";

  if (!hasCEXTouchpoint && hasObfuscation) {
    primary = "A";
    primaryDescription = "A — Police report documentation candidate";
  } else if (hasCEXTouchpoint && amount < 5000) {
    primary = "B";
    primaryDescription = "B — Exchange escalation candidate (low-value)";
  } else if (hasCEXTouchpoint && amount >= 5000) {
    primary = "B";
    primaryDescription = "B — Exchange escalation candidate";
  }

  // Additive flag (NOT a category). Never assigns C automatically.
  const potentialCivilReviewFlag = hasCEXTouchpoint && amount >= 5000;
  const potentialCivilReviewDescription = potentialCivilReviewFlag
    ? "Counsel may assess civil review outside automated triage. Not an INTERLIGENS recommendation."
    : undefined;

  const clusterFlag = similarReportsCount >= 2;
  const clusterFlagDescription = clusterFlag
    ? `Similar-reports cluster detected (${similarReportsCount}) — collective review flag (additive). Counsel review required.`
    : undefined;

  return {
    primary,
    primaryDescription,
    potentialCivilReviewFlag,
    potentialCivilReviewDescription,
    clusterFlag,
    clusterFlagDescription,
  };
}
