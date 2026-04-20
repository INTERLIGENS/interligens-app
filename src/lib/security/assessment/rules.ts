/**
 * Exposure assessment engine.
 *
 * Given a `SecurityIncident` + the vendor it belongs to, produce an
 * `SecurityExposureAssessment` payload:
 *   exposureLevel    — none | unlikely | possible | probable | confirmed
 *   affectedSurface  — JSON describing which INTERLIGENS surfaces are at risk
 *   requires*        — four boolean flags for the on-call runbook
 *   actionChecklist  — ordered list of concrete steps for the analyst
 *
 * Pure function — no DB calls, no network. Deterministic on (incident,
 * vendor). Tested in assessment/rules.test.ts.
 */

export type ExposureLevel =
  | "none"
  | "unlikely"
  | "possible"
  | "probable"
  | "confirmed";

export type IncidentType =
  | "outage"
  | "security_incident"
  | "breach"
  | "unauthorized_access"
  | "supply_chain"
  | "malware"
  | "secret_leak"
  | "dependency_cve"
  | "phishing"
  | "account_takeover"
  | "data_exposure"
  | "ddos"
  | "abuse"
  | "intimidation"
  | "internal_suspicion"
  | "other";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface AssessmentInput {
  incidentType: IncidentType;
  severity: Severity;
  vendorSlug?: string;
  /** Already-known facts: when the analyst has corroborated a specific flag. */
  confirmedExposure?: boolean;
  /** Whether INTERLIGENS stores data / secrets with this vendor. */
  vendorIsLive?: boolean;
}

export interface ChecklistItem {
  key: string;
  label: string;
  priority: "p1" | "p2" | "p3" | "p4";
}

export interface AssessmentOutput {
  exposureLevel: ExposureLevel;
  affectedSurface: {
    assetTypes: string[];
    summary: string;
  };
  requiresKeyRotation: boolean;
  requiresAccessReview: boolean;
  requiresInfraLogReview: boolean;
  requiresPublicStatement: boolean;
  actionChecklist: ChecklistItem[];
}

/** Severity → baseline exposure (before vendor / incident-type refinement). */
function severityBaseline(sev: Severity): ExposureLevel {
  switch (sev) {
    case "critical":
      return "probable";
    case "high":
      return "possible";
    case "medium":
      return "unlikely";
    case "low":
    case "info":
      return "none";
  }
}

/**
 * Per-vendor surface definition. Keep slugs in sync with
 * `src/lib/security/vendors/registry.ts`.
 */
const VENDOR_SURFACE: Record<
  string,
  { assetTypes: string[]; summary: string; critical: boolean }
> = {
  vercel: {
    assetTypes: ["vercel_project", "api_integration"],
    summary:
      "Every deploy + every env var (all API keys, admin tokens, DB URL) lives in Vercel. Blast radius = everything.",
    critical: true,
  },
  cloudflare: {
    assetTypes: ["cloudflare_zone"],
    summary: "DNS, CDN, WAF, Zero Trust, TLS cert.",
    critical: true,
  },
  "cloudflare-r2": {
    assetTypes: ["r2_bucket"],
    summary: "Encrypted PDF + RAW docs storage. Signed URLs.",
    critical: true,
  },
  neon: {
    assetTypes: ["neon_project"],
    summary:
      "Production DB (investigator data, KOL profiles, audit logs, all Prisma state).",
    critical: true,
  },
  github: {
    assetTypes: ["github_repo"],
    summary: "Codebase, Actions, secrets for CI.",
    critical: true,
  },
  npm: {
    assetTypes: ["api_integration"],
    summary: "Package supply chain. Affects every deploy that installs deps.",
    critical: true,
  },
  prisma: {
    assetTypes: ["api_integration"],
    summary: "ORM runtime + client generator.",
    critical: false,
  },
  nextjs: {
    assetTypes: ["api_integration"],
    summary: "Framework runtime. Affects every page + API route.",
    critical: true,
  },
  resend: {
    assetTypes: ["email_provider"],
    summary: "Transactional email. Affects beta welcome + weekly digest + KOL alerts.",
    critical: false,
  },
  helius: {
    assetTypes: ["api_integration"],
    summary: "Solana RPC + enhanced APIs.",
    critical: false,
  },
  etherscan: {
    assetTypes: ["api_integration"],
    summary: "Multi-chain EVM scanner for block/tx/log queries.",
    critical: false,
  },
  anthropic: {
    assetTypes: ["api_integration"],
    summary: "LLM for case assistant.",
    critical: false,
  },
  "x-twitter": {
    assetTypes: ["x_account", "api_integration"],
    summary: "KOL shill detection + watcher v2.",
    critical: false,
  },
  upstash: {
    assetTypes: ["api_integration"],
    summary: "Redis cache + rate-limit store (currently inactive).",
    critical: false,
  },
};

/**
 * Does this incident type imply a secret / token potentially ended up in
 * attacker hands? If so, rotate keys.
 */
function incidentTypeLeaksSecrets(type: IncidentType): boolean {
  return (
    type === "breach" ||
    type === "unauthorized_access" ||
    type === "secret_leak" ||
    type === "account_takeover" ||
    type === "supply_chain"
  );
}

/** Does it imply human access to the control plane? */
function incidentTypeAccessReview(type: IncidentType): boolean {
  return (
    type === "breach" ||
    type === "unauthorized_access" ||
    type === "account_takeover" ||
    type === "phishing"
  );
}

/** Does it imply we should review infra logs (audit / access / billing)? */
function incidentTypeInfraLogReview(type: IncidentType): boolean {
  return (
    type === "breach" ||
    type === "unauthorized_access" ||
    type === "data_exposure" ||
    type === "account_takeover" ||
    type === "supply_chain"
  );
}

/** Does it warrant a public statement if exposure is probable or worse? */
function incidentTypePublicStatement(
  type: IncidentType,
  level: ExposureLevel,
): boolean {
  const qualifyingLevel = level === "probable" || level === "confirmed";
  if (!qualifyingLevel) return false;
  return (
    type === "breach" ||
    type === "unauthorized_access" ||
    type === "data_exposure" ||
    type === "account_takeover"
  );
}

export function assessExposure(input: AssessmentInput): AssessmentOutput {
  // ── 1. Start from severity baseline ──────────────────────────────
  let level: ExposureLevel = severityBaseline(input.severity);

  // ── 2. Bump for critical-blast-radius vendors ────────────────────
  const vendor = input.vendorSlug
    ? VENDOR_SURFACE[input.vendorSlug]
    : undefined;
  if (vendor?.critical && level === "unlikely") level = "possible";
  if (vendor?.critical && level === "possible" && input.severity === "high") {
    level = "probable";
  }

  // ── 3. Bump further for incident types that imply secret access ──
  if (incidentTypeLeaksSecrets(input.incidentType)) {
    if (level === "none") level = "unlikely";
    else if (level === "unlikely") level = "possible";
    // If critical vendor + secret-leak type + high/critical severity,
    // assume at least "probable" unless analyst confirms otherwise.
    if (
      vendor?.critical &&
      (input.severity === "high" || input.severity === "critical") &&
      level === "possible"
    ) {
      level = "probable";
    }
  }

  // ── 4. Mark unused vendor as unlikely regardless of severity ─────
  if (input.vendorIsLive === false) {
    // Pick the lower of current level vs "unlikely".
    const order: ExposureLevel[] = [
      "none",
      "unlikely",
      "possible",
      "probable",
      "confirmed",
    ];
    if (order.indexOf(level) > order.indexOf("unlikely")) level = "unlikely";
  }

  // ── 5. Confirmed overrides everything ────────────────────────────
  if (input.confirmedExposure) level = "confirmed";

  // ── 6. Compute action flags ──────────────────────────────────────
  const requiresKeyRotation =
    incidentTypeLeaksSecrets(input.incidentType) &&
    (level === "possible" || level === "probable" || level === "confirmed");
  const requiresAccessReview =
    incidentTypeAccessReview(input.incidentType) && level !== "none";
  const requiresInfraLogReview =
    incidentTypeInfraLogReview(input.incidentType) &&
    (level === "possible" || level === "probable" || level === "confirmed");
  const requiresPublicStatement = incidentTypePublicStatement(
    input.incidentType,
    level,
  );

  // ── 7. Build action checklist ────────────────────────────────────
  const checklist: ChecklistItem[] = [];
  if (requiresKeyRotation) {
    checklist.push({
      key: "rotate_vendor_keys",
      label: `Rotate every API key / credential tied to ${
        input.vendorSlug ?? "the affected vendor"
      }`,
      priority: "p1",
    });
  }
  if (requiresAccessReview) {
    checklist.push({
      key: "review_collaborators",
      label:
        "Audit collaborators / teams / OAuth apps on the vendor dashboard; revoke anything unexpected",
      priority: "p1",
    });
  }
  if (requiresInfraLogReview) {
    checklist.push({
      key: "review_access_logs",
      label:
        "Pull 30 days of access / audit / billing logs from the vendor and grep for unknown actors",
      priority: "p1",
    });
  }
  if (input.incidentType === "supply_chain") {
    checklist.push({
      key: "lockfile_diff",
      label:
        "Diff pnpm-lock.yaml against the last known-good commit; verify every package version against npm audit",
      priority: "p1",
    });
  }
  if (input.incidentType === "dependency_cve") {
    checklist.push({
      key: "cve_check_deps",
      label:
        "Cross-check vulnerable versions listed in the CVE against package.json and the deployed build",
      priority: "p2",
    });
  }
  if (requiresPublicStatement) {
    checklist.push({
      key: "draft_public_statement",
      label:
        "Generate a draft public statement via /admin/security; review with legal before publishing",
      priority: "p2",
    });
  }
  // Always-on final step for probable+ exposure.
  if (level === "probable" || level === "confirmed") {
    checklist.push({
      key: "redeploy_and_invalidate_sessions",
      label:
        "After rotation, redeploy production and invalidate all admin + investigator sessions",
      priority: "p1",
    });
  }

  return {
    exposureLevel: level,
    affectedSurface: {
      assetTypes: vendor?.assetTypes ?? [],
      summary:
        vendor?.summary ??
        "Vendor not mapped in registry. Analyst should inventory exposure manually.",
    },
    requiresKeyRotation,
    requiresAccessReview,
    requiresInfraLogReview,
    requiresPublicStatement,
    actionChecklist: checklist,
  };
}
