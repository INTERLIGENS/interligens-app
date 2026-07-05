/**
 * src/lib/osint/vision/buildPlan.ts
 *
 * Pure assembler: (VisionOutput + resolved tokens) -> OSINT seed-format plan
 * (the exact shape of exports/seed_plan_*.json) + confidence + uncertain[].
 *
 * CA RESOLUTION NO LONGER HAPPENS HERE. It is decided by the three locks in
 * resolveTokens.ts and passed in as `resolutions`. buildPlan only lays out the
 * plan and surfaces each CA's resolutionPath/warnings for audit. This is why
 * the vision's contractAddressCertain can never, by construction, write a CA.
 */

import { isPending } from "./validateCA";
import type { VisionOutput } from "./visionPrompt";
import type { TokenResolution } from "./resolveTokens";

export interface BuildPlanInput {
  vision: VisionOutput;
  resolutions: TokenResolution[];
  sha256: string;
  bytes: number;
  fileName: string;
  kolHandleHint?: string | null;
  capturedAt?: string | null;
  sessionId?: string | null;
}

export interface OsintLink {
  kolHandle: string;
  contractAddress: string;
  chain: string;
  tokenSymbol: string | null;
  role: string;
  documentationStatus: string;
  attributionNote: string;
  note: string;
  resolutionPath: string;   // audit (extra key; the committer persists it inside `note`)
}

export interface OsintEvidence {
  kolHandle: string;
  tokenSymbol: string | null;
  tokenMatch: string;
  capturedAt: string | null;
  timezoneAssumption: string;
  sessionId: string;
  localFilePath: string;
  localFilePathCurrent: string;
  sha256: string;
  bytes: number;
  sourceUrl: string | null;
  relationType: string;
  relationKey: string;
  snapshotType: string;
  chainHint: string;
  title: string;
  caption: string;
  sourceLabel: string;
  reviewStatus: string;
  isPublic: boolean;
  displayOrder: number;
  notes: string;
}

export interface OsintPlan {
  session: string;
  kolHandle: string;
  capturedDate: string | null;
  timezoneAssumption: string;
  extractionMethod: "vision_auto";
  counts: Record<string, unknown>;
  new_tickers_discovered: string[];
  multi_ticker_schema: string;
  warnings: string[];
  evidences: OsintEvidence[];
  negatives: unknown[];
  kolProfileToCreate: {
    handle: string;
    platform: string;
    displayName: string;
    evidenceStatus: string;
    internalNote: string;
    publishable: false;
    publishStatus: "draft";
  };
  kolTokenLinksToCreate: OsintLink[];
  kolWalletsToCreate: unknown[];
  kolAliasesToCreate: unknown[];
  confidence: {
    kolHandle: string;
    perTokenSummary: Array<{
      tokenSymbol: string | null;
      ca: "resolved" | "PENDING";
      chain: string;
      zone: string;
      resolutionPath: string;
      caReads: [string | null, string | null];
      onChainSymbol: string | null;
    }>;
  };
  uncertain: string[];
}

const TZ = "Asia/Makassar (UTC+08:00)";

function sanitizeHandle(h: string | null | undefined): string | null {
  if (!h) return null;
  const clean = h.replace(/^@/, "").trim().toLowerCase();
  return /^[a-z0-9_]{1,50}$/.test(clean) ? clean : null;
}

export function buildPlan(input: BuildPlanInput): OsintPlan {
  const { vision, resolutions, sha256, bytes, fileName } = input;
  const warnings: string[] = [];
  const uncertain: string[] = [...(vision.uncertain ?? [])];

  // ── Handle ──
  const imgHandle = sanitizeHandle(vision.kolHandle);
  const hintHandle = sanitizeHandle(input.kolHandleHint);
  const kolHandle = imgHandle ?? hintHandle ?? "unknown_handle";
  if (!imgHandle && hintHandle) warnings.push("HANDLE_FROM_HINT: handle not legible in image, used caller hint.");
  if (!imgHandle && !hintHandle) {
    warnings.push("HANDLE_UNREADABLE: no legible handle in image and no hint — placeholder 'unknown_handle', DO NOT COMMIT as-is.");
    uncertain.push("kolHandle");
  }

  const sessionId = input.sessionId ?? `vision_${kolHandle}_${sha256.slice(0, 8)}`;
  const capturedAt = input.capturedAt ?? null;
  if (!capturedAt) warnings.push("CAPTURED_AT_NULL: capture time unknown at ingest — set from file mtime (UTC+8) before commit; never inferred from tweet content.");

  // ── Links from the three-lock resolutions ──
  const links: OsintLink[] = [];
  const newTickers: string[] = [];
  const perTokenSummary: OsintPlan["confidence"]["perTokenSummary"] = [];

  for (const r of resolutions) {
    warnings.push(...r.warnings);
    if (!r.resolved) uncertain.push(`contractAddress(${r.tokenSymbol ?? "?"})`);
    if (r.tokenSymbol) newTickers.push(r.tokenSymbol);

    links.push({
      kolHandle,
      contractAddress: r.contractAddress,
      chain: r.chain,
      tokenSymbol: r.tokenSymbol,
      role: "promoter",
      documentationStatus: "partial",
      attributionNote: `Vision-auto extraction (shadow). snapshotType=${vision.snapshotType}. session ${sessionId}.`,
      note: `vision_auto; zone=${r.zone}; resolutionPath=${r.resolutionPath}; caCertainHint=${r.audit.caCertainHint}; onChainSymbol=${r.audit.onChainSymbol ?? "n/a"}.`,
      resolutionPath: r.resolutionPath,
    });
    perTokenSummary.push({
      tokenSymbol: r.tokenSymbol,
      ca: isPending(r.contractAddress) ? "PENDING" : "resolved",
      chain: r.chain,
      zone: r.zone,
      resolutionPath: r.resolutionPath,
      caReads: r.audit.caReads,
      onChainSymbol: r.audit.onChainSymbol,
    });
  }

  // ── Evidence: exactly one per file (sha256) ──
  const primaryTicker = links.find((l) => l.tokenSymbol)?.tokenSymbol ?? null;
  const relationKey = `${kolHandle}:${primaryTicker ?? "UNKNOWN"}`;
  const tickerList = links.map((l) => l.tokenSymbol ?? "null").join(", ");
  const evidence: OsintEvidence = {
    kolHandle,
    tokenSymbol: primaryTicker,
    tokenMatch: "NEW_TOKEN",
    capturedAt,
    timezoneAssumption: TZ,
    sessionId,
    localFilePath: fileName,
    localFilePathCurrent: fileName,
    sha256,
    bytes,
    sourceUrl: null,
    relationType: "kol_token",
    relationKey,
    snapshotType: vision.snapshotType ?? "other",
    chainHint: links.find((l) => l.chain !== "unknown")?.chain ?? "unknown",
    title: `${kolHandle} × ${primaryTicker ? "$" + primaryTicker : "(multi/unknown)"} — vision OSINT evidence`,
    caption: `Vision-auto extracted screenshot (shadow, unpublished). sha256 ${sha256.slice(0, 12)}…`,
    sourceLabel: "Vision auto-ingest — OSINT screenshot",
    reviewStatus: "pending",
    isPublic: false,
    displayOrder: 1,
    notes: `extractionMethod=vision_auto; tickers=[${tickerList}]; handleConf=${vision.kolHandleConfidence}; visionPasses=${vision.diagnostics?.passes ?? "n/a"}; readWithCertainty=${(vision.readWithCertainty ?? []).join(" | ") || "none"}; modelNotes=${vision.notes ?? "none"}`,
  };

  return {
    session: sessionId,
    kolHandle,
    capturedDate: capturedAt ? capturedAt.slice(0, 10) : null,
    timezoneAssumption: TZ,
    extractionMethod: "vision_auto",
    counts: {
      nb_evidences: 1,
      nb_distinct_token_links: links.length,
      nb_links_real_ca: links.filter((l) => !isPending(l.contractAddress)).length,
      nb_links_pending: links.filter((l) => isPending(l.contractAddress)).length,
      nb_new_token_tickers: newTickers.length,
    },
    new_tickers_discovered: newTickers,
    multi_ticker_schema: "1 EvidenceSnapshot/file (sha256); N KolTokenLink (1 per distinct cashtag). 3-lock CA resolution, shadow mode.",
    warnings,
    evidences: [evidence],
    negatives: [],
    kolProfileToCreate: {
      handle: kolHandle,
      platform: "x",
      displayName: kolHandle,
      evidenceStatus: "partial",
      internalNote: `Auto-created from VISION OSINT ingest (session ${sessionId}). Shadow mode — NOT for publish.`,
      publishable: false,
      publishStatus: "draft",
    },
    kolTokenLinksToCreate: links,
    kolWalletsToCreate: [],
    kolAliasesToCreate: [],
    confidence: { kolHandle: vision.kolHandleConfidence, perTokenSummary },
    uncertain: [...new Set(uncertain)],
  };
}
