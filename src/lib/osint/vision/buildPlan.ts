/**
 * src/lib/osint/vision/buildPlan.ts
 *
 * Pure transform: VisionOutput -> OSINT seed-format plan (the exact shape of
 * exports/seed_plan_*.json) + a confidence block + uncertain[]. No I/O, no DB,
 * fully unit-testable. This is where the code-side anti-invention guards run:
 *   - validateCA rejects any CA the model let through -> PENDING:<TICKER>
 *   - contractAddressCertain=false -> PENDING (double gate)
 *   - chain derived from a VALID address format (authoritative)
 *   - one EvidenceSnapshot per file (sha256), N links (1 per distinct cashtag)
 */

import { validateCA, pendingFor, isPending } from "./validateCA";
import type { VisionOutput } from "./visionPrompt";

export interface BuildPlanInput {
  vision: VisionOutput;
  sha256: string;
  bytes: number;
  /** original upload filename, for localFilePath provenance (no disk write). */
  fileName: string;
  /** caller-supplied handle hint; image value wins when present. */
  kolHandleHint?: string | null;
  /** ISO capture time if known (file mtime), else null -> null + note. */
  capturedAt?: string | null;
  /** session id; default derived from handle. */
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
  // vision-specific blocks (extra keys; committer ignores them)
  confidence: {
    kolHandle: string;
    perTokenSummary: Array<{ tokenSymbol: string | null; ca: string; chain: string; chainSrc: string }>;
  };
  uncertain: string[];
}

const TZ = "Asia/Makassar (UTC+08:00)";

function sanitizeHandle(h: string | null | undefined): string | null {
  if (!h) return null;
  const clean = h.replace(/^@/, "").trim().toLowerCase();
  return /^[a-z0-9_]{1,50}$/.test(clean) ? clean : null;
}

function sanitizeTicker(t: string | null | undefined): string | null {
  if (!t) return null;
  const clean = t.replace(/^\$/, "").trim();
  return clean ? clean : null;
}

export function buildPlan(input: BuildPlanInput): OsintPlan {
  const { vision, sha256, bytes, fileName } = input;
  const warnings: string[] = [];
  const uncertain: string[] = [...(vision.uncertain ?? [])];

  // ── Handle: image-read wins, fall back to hint, else UNKNOWN placeholder ──
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

  // ── Tokens -> links (1 per distinct cashtag), with code-side CA guard ──
  const links: OsintLink[] = [];
  const newTickers: string[] = [];
  const seenTicker = new Set<string>();
  const perTokenSummary: OsintPlan["confidence"]["perTokenSummary"] = [];

  for (const tk of vision.tokens ?? []) {
    const ticker = sanitizeTicker(tk.tokenSymbol);
    const dedupKey = (ticker ?? "NULL").toUpperCase();
    if (seenTicker.has(dedupKey)) continue; // same cashtag twice -> one link
    seenTicker.add(dedupKey);

    // CODE-SIDE GUARD: never trust the model. CA passes only if it is BOTH
    // marked certain AND strictly well-formed. Anything else -> PENDING.
    let contractAddress: string;
    let chain = (tk.chain ?? "unknown").toLowerCase();
    const check = validateCA(tk.contractAddress);

    if (tk.contractAddressCertain === true && check.valid) {
      contractAddress = (tk.contractAddress as string).trim();
      // address format is authoritative for chain
      if (check.inferredChain && chain !== check.inferredChain) {
        warnings.push(`CHAIN_DERIVED: token ${ticker ?? "?"} chain set to ${check.inferredChain} from CA format (model said "${chain}").`);
        chain = check.inferredChain;
      } else if (chain === "unknown" && check.inferredChain) {
        chain = check.inferredChain;
      }
    } else {
      contractAddress = pendingFor(ticker);
      if (tk.contractAddress && !check.valid) {
        warnings.push(`CA_REJECTED: token ${ticker ?? "?"} CA "${String(tk.contractAddress).slice(0, 12)}…" failed strict validation (${check.reason}) -> ${contractAddress}.`);
        uncertain.push(`contractAddress(${ticker ?? "?"})`);
      } else if (tk.contractAddress && check.valid && tk.contractAddressCertain !== true) {
        warnings.push(`CA_UNCERTAIN: token ${ticker ?? "?"} CA well-formed but model not certain -> ${contractAddress}.`);
        uncertain.push(`contractAddress(${ticker ?? "?"})`);
      }
    }

    if (chain === "unknown") {
      warnings.push(`CHAIN_UNKNOWN: token ${ticker ?? "?"} chain ambiguous — left "unknown", no mint merge.`);
    }
    if (!ticker) {
      warnings.push("TICKER_NULL: an illegible cashtag was kept as tokenSymbol=null.");
      uncertain.push("tokenSymbol(null)");
    } else {
      newTickers.push(ticker);
    }

    const perfNote = tk.perf ? ` perf="${tk.perf}".` : "";
    links.push({
      kolHandle,
      contractAddress,
      chain,
      tokenSymbol: ticker,
      role: "promoter",
      documentationStatus: "partial",
      attributionNote: `Vision-auto extraction (shadow). snapshotType=${vision.snapshotType}. session ${sessionId}.`,
      note: `vision_auto; caCertain=${tk.contractAddressCertain === true && check.valid}; tickerConf=${tk.tokenSymbolConfidence}; chainConf=${tk.chainConfidence}.${perfNote}`,
    });
    perTokenSummary.push({
      tokenSymbol: ticker,
      ca: isPending(contractAddress) ? "PENDING" : "resolved",
      chain,
      chainSrc: check.valid ? "ca_format" : "model_or_unknown",
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
    notes: `extractionMethod=vision_auto; tickers=[${tickerList}]; handleConf=${vision.kolHandleConfidence}; readWithCertainty=${(vision.readWithCertainty ?? []).join(" | ") || "none"}; modelNotes=${vision.notes ?? "none"}`,
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
    multi_ticker_schema: "1 EvidenceSnapshot/file (sha256); N KolTokenLink (1 per distinct cashtag). Vision-auto, shadow mode.",
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
