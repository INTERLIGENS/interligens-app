/**
 * Comms draft generator.
 *
 * For any `SecurityIncident`, produce three candidate drafts the admin can
 * edit + approve + publish:
 *   - `x`              (280-char format, factual, no emojis, no drama)
 *   - `public_status`  (long-form status page / blog entry)
 *   - `internal`       (note circulated internally / to board)
 *
 * Tone is always `factual` by default. Output is pure — no LLM call — so the
 * admin always sees predictable copy they can then edit or regenerate. If a
 * future V2 wires an LLM (Anthropic), the function signature stays stable:
 * swap the body templates behind a flag.
 */

export type CommsChannel =
  | "x"
  | "internal"
  | "public_status"
  | "investor"
  | "legal";

export type CommsTone = "neutral" | "defensive" | "factual" | "hardline";

export interface DraftInput {
  incident: {
    title: string;
    summaryShort: string;
    incidentType: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    detectedAt: Date;
    vendorName?: string | null;
    sourceUrl?: string | null;
  };
  exposure: {
    exposureLevel:
      | "none"
      | "unlikely"
      | "possible"
      | "probable"
      | "confirmed";
    affectedSummary: string;
    rotatedKeys?: boolean;
    reviewedAccess?: boolean;
    reviewedLogs?: boolean;
  };
}

export interface Draft {
  channel: CommsChannel;
  tone: CommsTone;
  title?: string;
  body: string;
}

const FORMAT_DATE = (d: Date) =>
  d.toISOString().slice(0, 10); // YYYY-MM-DD

function statusBlurb(level: DraftInput["exposure"]["exposureLevel"]): string {
  switch (level) {
    case "confirmed":
      return "Exposure confirmed.";
    case "probable":
      return "Exposure considered probable pending review.";
    case "possible":
      return "Exposure considered possible. Mitigations applied.";
    case "unlikely":
      return "Exposure considered unlikely based on current evidence.";
    case "none":
      return "No exposure identified.";
  }
}

function mitigationLine(e: DraftInput["exposure"]): string {
  const parts: string[] = [];
  if (e.rotatedKeys) parts.push("credentials rotated");
  if (e.reviewedAccess) parts.push("access reviewed");
  if (e.reviewedLogs) parts.push("access logs inspected");
  if (parts.length === 0) return "Review in progress.";
  return (
    parts.slice(0, -1).join(", ") +
    (parts.length > 1 ? ", and " : "") +
    parts[parts.length - 1] +
    "."
  );
}

/** Short (≤ 280-char) factual draft for X. */
export function buildXDraft(input: DraftInput): Draft {
  const date = FORMAT_DATE(input.incident.detectedAt);
  const vendor = input.incident.vendorName ?? "our upstream vendor";
  const status = statusBlurb(input.exposure.exposureLevel);
  const mitig = mitigationLine(input.exposure);

  // Aim for the ≤ 280 mark. Factual, no emojis, no exclamations.
  const body = `INTERLIGENS — ${date}: ${input.incident.title} (${vendor}).\n${status} ${mitig}\nMore: https://app.interligens.com/admin/security`;

  return {
    channel: "x",
    tone: "factual",
    body: body.slice(0, 280),
  };
}

/** Long-form public statement (blog / status page). */
export function buildPublicStatementDraft(input: DraftInput): Draft {
  const date = FORMAT_DATE(input.incident.detectedAt);
  const vendor = input.incident.vendorName ?? "an upstream vendor";
  const sourceLink = input.incident.sourceUrl
    ? `Original vendor disclosure: ${input.incident.sourceUrl}.`
    : "";
  const actionsApplied = [
    input.exposure.rotatedKeys && "rotated every credential tied to the affected vendor",
    input.exposure.reviewedAccess && "audited collaborators and access tokens",
    input.exposure.reviewedLogs && "inspected the last 30 days of access / audit / billing logs",
  ]
    .filter((x): x is string => typeof x === "string");

  const actionsBlock =
    actionsApplied.length === 0
      ? "Mitigation steps are currently in progress and will be updated as they complete."
      : `On our side we have ${actionsApplied.join(", and ")}.`;

  const body = [
    `On ${date} we became aware of an incident at ${vendor}: ${input.incident.title}.`,
    "",
    input.incident.summaryShort,
    "",
    `Assessment for INTERLIGENS: ${statusBlurb(input.exposure.exposureLevel)} ${input.exposure.affectedSummary}`,
    "",
    actionsBlock,
    "",
    sourceLink,
    "",
    "We will update this statement as more information becomes available. Questions: admin@interligens.com.",
  ]
    .filter((line) => line !== "")
    .join("\n\n");

  return {
    channel: "public_status",
    tone: "factual",
    title: `${input.incident.title} — INTERLIGENS assessment`,
    body,
  };
}

/** Internal / board-facing note. */
export function buildInternalNoteDraft(input: DraftInput): Draft {
  const date = FORMAT_DATE(input.incident.detectedAt);
  const vendor = input.incident.vendorName ?? "upstream vendor (unmapped)";
  const sev = input.incident.severity.toUpperCase();

  const bullets: string[] = [];
  bullets.push(`· Type: ${input.incident.incidentType}`);
  bullets.push(`· Severity: ${sev}`);
  bullets.push(`· Vendor: ${vendor}`);
  bullets.push(`· Detected: ${date}`);
  bullets.push(`· Exposure (INTERLIGENS): ${input.exposure.exposureLevel}`);
  if (input.incident.sourceUrl) {
    bullets.push(`· Source: ${input.incident.sourceUrl}`);
  }

  const body = [
    `SECURITY — internal note — ${date}`,
    "",
    input.incident.title,
    "",
    input.incident.summaryShort,
    "",
    bullets.join("\n"),
    "",
    "Surface:",
    input.exposure.affectedSummary,
    "",
    "Mitigation status:",
    mitigationLine(input.exposure),
    "",
    "Full runbook + action checklist: https://app.interligens.com/admin/security",
  ].join("\n");

  return {
    channel: "internal",
    tone: "factual",
    title: `[SEC-${date}] ${input.incident.title}`,
    body,
  };
}

/** Generate the full V1 triad (X + public + internal). */
export function buildDraftSet(input: DraftInput): Draft[] {
  return [
    buildXDraft(input),
    buildPublicStatementDraft(input),
    buildInternalNoteDraft(input),
  ];
}
