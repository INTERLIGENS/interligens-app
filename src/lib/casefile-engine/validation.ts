/**
 * Casefile Engine V1 — runtime validation (PII sandbox lock).
 *
 * V1 is synthetic-demo only. Any other data classification is rejected.
 * Exhibits flagged `contains-pii` are auto-converted to
 * `synthetic-pii-placeholder` and the change is reported back to the caller.
 *
 * Admin-only, feature-flagged by FEATURE_CASEFILE_ENGINE_V1.
 */

export interface CasefileDraftLike {
  dataClassification?: string;
  exhibits?: Array<{ exhibitId?: string; redactionStatus?: string } & Record<string, unknown>>;
  [key: string]: unknown;
}

export interface SandboxResult {
  ok: boolean;
  corrections: string[];
}

export function enforceSandboxRules(draft: CasefileDraftLike): SandboxResult {
  const corrections: string[] = [];

  // V1 lock: only synthetic-demo accepted.
  if (draft.dataClassification && draft.dataClassification !== "synthetic-demo") {
    return {
      ok: false,
      corrections: [
        `dataClassification "${draft.dataClassification}" not allowed in V1 (synthetic-demo only)`,
      ],
    };
  }

  // Auto-convert contains-pii → synthetic-pii-placeholder in synthetic-demo mode.
  if (draft.dataClassification === "synthetic-demo") {
    for (const ex of draft.exhibits ?? []) {
      if (ex.redactionStatus === "contains-pii") {
        ex.redactionStatus = "synthetic-pii-placeholder";
        corrections.push(
          `exhibit ${ex.exhibitId ?? "<unknown>"}: contains-pii auto-converted to synthetic-pii-placeholder`,
        );
      }
    }
  }

  return { ok: true, corrections };
}
