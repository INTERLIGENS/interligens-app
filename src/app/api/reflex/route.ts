/**
 * REFLEX V1 — POST /api/reflex
 *
 * Accepts a user input + locale + requested mode, runs the deterministic
 * REFLEX pipeline, and returns the verdict in the requested locale.
 *
 * Mode handling: requested mode is forwarded to runReflex, which calls
 * effectiveMode() under the hood. Even if the caller posts mode="PUBLIC"
 * while REFLEX_PUBLIC_ENABLED is unset/false, the persisted row lands as
 * SHADOW. See persistence.ts.
 *
 * Lint guard: assertClean inside decide() throws ForbiddenWordError if
 * any user-facing string contains a banned token. The handler maps that
 * to a 500 "lint_leak" response and logs the matches — we never serve a
 * verdict that would expose forbidden vocabulary.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import { MAX_INPUT_LENGTH } from "@/lib/reflex/constants";
import { ForbiddenWordError } from "@/lib/reflex/forbidden-words";
import { classify } from "@/lib/reflex/inputRouter";
import { runReflex } from "@/lib/reflex/orchestrator";
import { buildTigerInputForReflex } from "@/lib/scan/buildTigerInput";
import type { OffChainInput } from "@/lib/off-chain-credibility/engine";
import type {
  ReflexEnrichmentBundle,
} from "@/lib/reflex/orchestrator";
import type {
  ReflexAnalysisResult,
  ReflexLocale,
  ReflexMode,
} from "@/lib/reflex/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostReflexBody {
  input?: string;
  locale?: string;
  mode?: string;
}

function parseLocale(s: string | undefined): ReflexLocale {
  return s === "fr" ? "fr" : "en";
}

function parseMode(s: string | undefined): ReflexMode {
  return s === "PUBLIC" ? "PUBLIC" : "SHADOW";
}

function localizedResponse(
  result: ReflexAnalysisResult,
  locale: ReflexLocale,
) {
  return {
    id: result.id,
    createdAt: result.createdAt.toISOString(),
    verdict: result.verdict,
    verdictReason:
      locale === "fr" ? result.verdictReasonFr : result.verdictReasonEn,
    action: locale === "fr" ? result.actionFr : result.actionEn,
    confidence: result.confidence,
    confidenceScore: result.confidenceScore,
    input: {
      type: result.input.type,
      chain: result.input.chain ?? null,
      address: result.input.address ?? null,
      handle: result.input.handle ?? null,
      url: result.input.url ?? null,
    },
    signalsHashShort: result.signalsHash.slice(0, 8),
    mode: result.mode,
    enginesVersion: result.enginesVersion,
    latencyMs: result.latencyMs,
  };
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  let body: PostReflexBody;
  try {
    body = (await req.json()) as PostReflexBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const inputRaw = typeof body.input === "string" ? body.input.trim() : "";
  if (!inputRaw) {
    return NextResponse.json({ error: "missing_input" }, { status: 400 });
  }
  if (inputRaw.length > MAX_INPUT_LENGTH) {
    return NextResponse.json(
      { error: "input_too_long", limit: MAX_INPUT_LENGTH },
      { status: 400 },
    );
  }

  const locale = parseLocale(body.locale);
  const mode = parseMode(body.mode);

  // Build the enrichment bundle from the resolved input. This is the
  // boundary between the route layer (which knows about HTTP) and the
  // orchestrator (which doesn't). Failures here downgrade gracefully:
  // REFLEX still produces a verdict from the DB-backed engines.
  const resolved = classify(inputRaw);
  const enrichment: ReflexEnrichmentBundle = {};

  try {
    const tigerBuild = await buildTigerInputForReflex(resolved);
    if (tigerBuild.tigerInput) {
      enrichment.tigerInput = tigerBuild.tigerInput;
    }
  } catch (e) {
    console.warn(
      "[api/reflex] buildTigerInput failed — continuing without TigerScore",
      e,
    );
  }

  // Off-chain enrichment: V1 just hands the URL/handle to the engine;
  // OffChain itself does the fetching with its own 24h cache.
  if (resolved.type === "URL" && resolved.url) {
    const offChainInput: OffChainInput = { websiteUrl: resolved.url };
    enrichment.offChainInput = offChainInput;
  } else if (resolved.type === "X_HANDLE" && resolved.handle) {
    const offChainInput: OffChainInput = { twitterHandle: resolved.handle };
    enrichment.offChainInput = offChainInput;
  }
  // narrativeText: deferred until a URL/X fetcher exists (post-V1).

  try {
    const result = await runReflex(inputRaw, mode, {
      locale,
      enrichment,
    });
    return NextResponse.json(localizedResponse(result, locale));
  } catch (e) {
    if (e instanceof ForbiddenWordError) {
      console.error(
        "[api/reflex] FORBIDDEN-WORDS LEAK — refusing to serve",
        { source: e.source, matches: e.matches },
      );
      return NextResponse.json(
        { error: "lint_leak", source: e.source },
        { status: 500 },
      );
    }
    console.error("[api/reflex] Internal error:", e);
    return NextResponse.json(
      {
        error: "internal",
        detail: (e instanceof Error ? e.message : String(e)).slice(0, 200),
      },
      { status: 500 },
    );
  }
}
