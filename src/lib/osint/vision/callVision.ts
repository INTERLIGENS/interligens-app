/**
 * src/lib/osint/vision/callVision.ts
 *
 * Vision call + LOCK 1 (double-read consensus).
 *
 * The model's self-reported `contractAddressCertain` proved UNRELIABLE: on the
 * TOES capture it returned a CA wrong by 2 characters and still flagged it
 * certain=true. So we never trust a single pass. callVision runs TWO independent
 * passes (low temperature) and cross-checks them character by character:
 *   - contractAddress agrees only if both passes return the EXACT same string.
 *   - tokenSymbol agrees only if both passes return the same (normalized) ticker.
 * Any disagreement -> the field is forced to null and recorded in diagnostics.
 * A failed/timed-out second pass is treated as a disagreement (CA -> null).
 *
 * Isolated module so route tests can vi.mock("@/lib/osint/vision/callVision").
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  VISION_SYSTEM_PROMPT,
  VISION_MODEL,
  VISION_MAX_TOKENS,
  VISION_TEMPERATURE,
  buildVisionUserText,
  type VisionOutput,
  type VisionToken,
  type VisionDiagnostics,
  type TokenConsensusDiagnostic,
} from "./visionPrompt";

export type VisionMediaType =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/** Strip ```json fences / stray prose and parse the first JSON object. */
export function parseVisionJson(raw: string): VisionOutput {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!s.startsWith("{")) {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw Object.assign(new Error("Vision output is not JSON"), { code: "VISION_NOT_JSON" });
    }
    s = s.slice(start, end + 1);
  }
  return JSON.parse(s) as VisionOutput;
}

/** A single vision pass (one API round-trip). */
export async function visionPass(
  base64Data: string,
  mediaType: VisionMediaType,
  kolHandleHint: string | null,
): Promise<VisionOutput> {
  const message = await client().messages.create({
    model: VISION_MODEL,
    max_tokens: VISION_MAX_TOKENS,
    temperature: VISION_TEMPERATURE,
    system: VISION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          { type: "text", text: buildVisionUserText(kolHandleHint) },
        ],
      },
    ],
  });
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseVisionJson(text);
}

function normTicker(t: string | null | undefined): string | null {
  if (!t) return null;
  const c = t.replace(/^\$/, "").trim().toUpperCase();
  return c || null;
}

/**
 * LOCK 1 core (pure, unit-testable). Merge two passes into a consensus
 * VisionOutput. Disagreement on a field => that field becomes null.
 * If `b` is null (second pass failed), every CA is treated as a disagreement
 * (forced null) while the ticker from pass A is kept so PENDING:<TICKER> stays
 * meaningful. Tokens are aligned by position.
 */
export function mergeConsensus(
  a: VisionOutput,
  b: VisionOutput | null,
  secondPassError: string | null,
): VisionOutput {
  const aTokens = a.tokens ?? [];
  const bTokens = b?.tokens ?? [];
  const n = Math.max(aTokens.length, bTokens.length);

  const mergedTokens: VisionToken[] = [];
  const diagTokens: TokenConsensusDiagnostic[] = [];

  for (let i = 0; i < n; i++) {
    const ta = aTokens[i];
    const tb = bTokens[i];

    const caA = (ta?.contractAddress ?? null) ? String(ta!.contractAddress).trim() : null;
    const caB = (tb?.contractAddress ?? null) ? String(tb!.contractAddress).trim() : null;
    const caAgree = b !== null && caA !== null && caB !== null && caA === caB;

    const tickerNA = normTicker(ta?.tokenSymbol);
    const tickerNB = normTicker(tb?.tokenSymbol);
    // ticker "agrees" if both passes present and normalize equal.
    const tickerAgree = b !== null && tickerNA !== null && tickerNB !== null && tickerNA === tickerNB;

    // On a failed 2nd pass we keep pass-A's ticker (label for PENDING) but still
    // null the CA. On a real divergence we null the ticker per the hard rule.
    const mergedTicker = b === null ? (ta?.tokenSymbol ?? null) : tickerAgree ? (ta?.tokenSymbol ?? null) : null;

    mergedTokens.push({
      tokenSymbol: mergedTicker,
      tokenSymbolConfidence: ta?.tokenSymbolConfidence ?? "low",
      contractAddress: caAgree ? caA : null,        // consensus CA or null
      contractAddressConfidence: ta?.contractAddressConfidence ?? "low",
      contractAddressCertain: false,                // never authoritative anymore
      chain: ta?.chain ?? "unknown",
      chainConfidence: ta?.chainConfidence ?? "low",
      perf: ta?.perf ?? null,
    });

    diagTokens.push({
      tokenSymbol: mergedTicker,
      tickerReads: [ta?.tokenSymbol ?? null, tb?.tokenSymbol ?? null],
      tickerAgree,
      caReads: [caA, caB],
      caAgree,
      caCertainHint: !!(ta?.contractAddressCertain) || !!(tb?.contractAddressCertain),
    });
  }

  const diagnostics: VisionDiagnostics = {
    passes: b === null ? 1 : 2,
    secondPassError,
    handleReads: [a.kolHandle ?? null, b?.kolHandle ?? null],
    tokenCountReads: [aTokens.length, bTokens.length],
    tokens: diagTokens,
  };

  return {
    kolHandle: a.kolHandle ?? null,
    kolHandleConfidence: a.kolHandleConfidence ?? "low",
    snapshotType: a.snapshotType ?? "other",
    tokens: mergedTokens,
    readWithCertainty: a.readWithCertainty ?? [],
    uncertain: a.uncertain ?? [],
    notes: a.notes ?? null,
    diagnostics,
  };
}

/**
 * Public entry: run two passes, merge by consensus, return the merged output
 * with diagnostics. A failed second pass is non-fatal — it degrades to a
 * disagreement (CAs nulled), never resolves.
 */
export async function callVision(
  base64Data: string,
  mediaType: VisionMediaType,
  kolHandleHint: string | null,
): Promise<VisionOutput> {
  const passA = await visionPass(base64Data, mediaType, kolHandleHint); // first pass — its failure IS fatal
  let passB: VisionOutput | null = null;
  let secondPassError: string | null = null;
  try {
    passB = await visionPass(base64Data, mediaType, kolHandleHint);
  } catch (err) {
    secondPassError = (err as Error)?.message ?? "second_pass_failed";
  }
  return mergeConsensus(passA, passB, secondPassError);
}
