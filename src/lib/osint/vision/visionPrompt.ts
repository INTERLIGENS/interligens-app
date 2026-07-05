/**
 * src/lib/osint/vision/visionPrompt.ts
 *
 * OSINT Vision Ingest V1 — strict system prompt + the typed shape the model
 * must return. The prompt enforces anti-invention rules; the TYPES + downstream
 * code (validateCA, buildPlan) enforce them a second time, in code.
 */

export type Confidence = "high" | "medium" | "low";
export type VisionChain = "solana" | "ethereum" | "unknown";
export type VisionSnapshotType =
  | "osint_x_search"
  | "osint_perf_card"
  | "osint_text_call"
  | "osint_profile"
  | "other";

/**
 * ClaimZone — WHERE in the screenshot a token/CA was read. The vision extracts
 * EVERY legible token, not just the post's subject; the zone records the layout
 * region so downstream decision can weight the second-plan (sidebar/reply/embedded)
 * differently from the primary subject.
 *
 *  primary   the token that is the SUBJECT of the tweet body / main call
 *  sidebar   side columns, "relevant people", bios, trending rails
 *  embedded  screenshots/charts embedded as an image inside the post
 *  reply     replies / comments below the main post
 */
export type ClaimZone = "primary" | "sidebar" | "embedded" | "reply";
/** Second-plan zones are low priority; only the post's subject is high. */
export type ClaimPriority = "high" | "low";

/** Normalize a raw/absent zone. Absent or unknown ⇒ "primary" (the subject) so
 *  legacy single-token vision output behaves EXACTLY as before this change. */
export function normZone(zone: string | null | undefined): ClaimZone {
  return zone === "sidebar" || zone === "embedded" || zone === "reply"
    ? zone
    : "primary";
}

/** Priority derives from zone — single source of truth. Only "primary" is high. */
export function zoneToPriority(zone: string | null | undefined): ClaimPriority {
  return normZone(zone) === "primary" ? "high" : "low";
}

export interface VisionToken {
  tokenSymbol: string | null;        // cashtag WITHOUT the $, or null if illegible
  tokenSymbolConfidence: Confidence;
  contractAddress: string | null;    // EXACT only if 100% legible, else null
  contractAddressConfidence: Confidence;
  contractAddressCertain: boolean;   // true ONLY if every character is unambiguous
  chain: VisionChain;
  chainConfidence: Confidence;
  perf: string | null;               // e.g. "12x", "called at $400K mcap" — only if visible
  zone?: ClaimZone;                  // WHERE it was read (default "primary" if absent). See normZone.
}

export interface VisionOutput {
  kolHandle: string | null;          // WITHOUT @, or null if not legible in the image
  kolHandleConfidence: Confidence;
  snapshotType: VisionSnapshotType;
  tokens: VisionToken[];
  readWithCertainty: string[];       // human list of what was read with certainty
  uncertain: string[];               // human list of what was NOT certain
  notes: string | null;              // free-text observations, no invention
  // Populated by callVision after the lock-1 double-read consensus merge.
  diagnostics?: VisionDiagnostics;
}

export const VISION_MODEL = "claude-sonnet-4-5";
export const VISION_MAX_TOKENS = 1500;
// Low temperature for both consensus passes — we want the model's most
// deterministic read, then we cross-check the two passes character by character.
export const VISION_TEMPERATURE = 0;

/**
 * The strict extraction system prompt. Hard rules mirror the manual-OSINT
 * anti-invention discipline visible in exports/seed_plan_*.json.
 */
export const VISION_SYSTEM_PROMPT = `You are an OSINT screenshot extractor for INTERLIGENS, a crypto anti-scam intelligence platform. You read ONE screenshot (an X/Twitter search page, a tweet, a "perf card", or a token call) and extract structured facts. You are a forensic reader, not an analyst. You NEVER guess, complete, infer, or invent. Missing/illegible = null. That is always correct; a wrong guess is a serious error.

OUTPUT: Return ONLY one JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "kolHandle": string | null,
  "kolHandleConfidence": "high" | "medium" | "low",
  "snapshotType": "osint_x_search" | "osint_perf_card" | "osint_text_call" | "osint_profile" | "other",
  "tokens": [
    {
      "tokenSymbol": string | null,
      "tokenSymbolConfidence": "high" | "medium" | "low",
      "contractAddress": string | null,
      "contractAddressConfidence": "high" | "medium" | "low",
      "contractAddressCertain": boolean,
      "chain": "solana" | "ethereum" | "unknown",
      "chainConfidence": "high" | "medium" | "low",
      "perf": string | null,
      "zone": "primary" | "sidebar" | "embedded" | "reply"
    }
  ],
  "readWithCertainty": [ string ],
  "uncertain": [ string ],
  "notes": string | null
}

HARD RULES — non-negotiable:
1. CONTRACT ADDRESS. Only write a contractAddress if you can read EVERY character with 100% certainty. The slightest doubt on a single character (0/O, I/l/1, base58 tail clipped by the screenshot edge, blur, overlap) → contractAddress = null AND contractAddressCertain = false. NEVER complete a truncated address. NEVER guess a character. A Solana CA is ~32-44 base58 chars; an EVM CA is 0x + 40 hex. If you only see a fragment, return null.
2. contractAddressCertain = true ONLY when contractAddress is non-null AND every character is unambiguous. If false, contractAddress MUST be null.
3. TICKER. If a cashtag/ticker is illegible, tokenSymbol = null. Strip the leading "$". Do not normalize spelling. Do not merge "$SMOTHER" and "$MOTHER" — report exactly what is written for each distinct cashtag.
4. CHAIN. If the chain is not explicit and cannot be read from an address you are 100% sure of, chain = "unknown". Never assume Solana just because it is a memecoin. Never merge two different mints/tokens into one entry.
5. PERF. Extract "Nx", "called at X mcap", "aped $X" ONLY if literally visible. Otherwise perf = null. Never compute or estimate.
6. HANDLE. Read kolHandle from the image (search bar "from:xxx", profile @handle). Strip "@". If not legible, null. If a handle hint is provided by the user, you may use it to disambiguate but the image is authoritative.
7. EXTRACT EVERYTHING, TAG THE ZONE. Extract EVERY legible token/cashtag/CA anywhere in the image, not only the post's subject. Return one entry per DISTINCT cashtag. For EACH entry set "zone" to WHERE you read it:
   - "primary"  : the token that is the SUBJECT of the tweet body / main call.
   - "sidebar"  : side columns, "relevant people"/"who to follow", bios, trending rails.
   - "embedded" : a screenshot/chart embedded as an image inside the post.
   - "reply"    : replies / comments below the main post.
   A cashtag mentioned in a bio with no contract address is STILL extracted (zone="sidebar", contractAddress=null) — never dropped, never inflated. When unsure which zone, prefer "primary" only for the clear subject; otherwise the most specific of sidebar/embedded/reply. The SAME anti-invention rules (1-6) apply to every zone equally: a sidebar CA is held to the identical 100%-legibility bar as a primary CA.
8. MULTI-TICKER. Do not deduplicate different tickers; do deduplicate the exact same cashtag seen twice in the same zone. The same cashtag appearing in two different zones may be reported once with the more authoritative zone (primary > embedded > reply > sidebar).
9. DATES / YEARS. Do NOT extract or invent capture dates or years. Timestamps are handled outside the model. Put any visible relative time ("2h", "Jun 18") in notes only, never as a year.
10. CONFIDENCE + AUDIT. For every field give a confidence level. List in "readWithCertainty" what you are sure of and in "uncertain" everything ambiguous. When in doubt, downgrade.

Return the JSON object only.`;

/** Build the user-turn text accompanying the image. */
export function buildVisionUserText(kolHandleHint: string | null): string {
  const hint = kolHandleHint
    ? `Handle hint (use only to disambiguate; the image is authoritative): @${kolHandleHint.replace(/^@/, "")}.`
    : "No handle hint provided — read it from the image if legible, else null.";
  return `Extract the structured OSINT facts from this single screenshot. ${hint} Apply every hard rule. Return ONLY the JSON object.`;
}


// ─── Lock 1 (double-read consensus) diagnostics ──────────────────────────────
// callVision runs TWO independent passes and cross-checks them. The result is a
// merged VisionOutput where any field the two passes DISAGREE on is forced to
// null, plus this diagnostics block recording both raw reads for audit. The
// model's self-reported contractAddressCertain is downgraded to a logged HINT
// only (caCertainHint) — it is NEVER an authority for resolution.
export interface TokenConsensusDiagnostic {
  tokenSymbol: string | null;                 // merged (agreed) ticker, else null
  tickerReads: [string | null, string | null];
  tickerAgree: boolean;
  caReads: [string | null, string | null];
  caAgree: boolean;
  caCertainHint: boolean;                      // OR of both passes' self-reported certainty (logged only)
}

export interface VisionDiagnostics {
  passes: number;                              // 1 or 2
  secondPassError: string | null;              // non-null if the 2nd pass failed -> treat as disagreement
  handleReads: [string | null, string | null];
  tokenCountReads: [number, number];
  tokens: TokenConsensusDiagnostic[];
}
