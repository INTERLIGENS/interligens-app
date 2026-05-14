/**
 * REFLEX V1 — GET /api/reflex/:id
 *
 * Two visibility tiers — "Reveal the architecture, never the recipe.":
 *
 *  - FULL view : the row's mode is SHADOW AND the caller carries a
 *    valid investigator session cookie (validated against the DB via
 *    isValidSessionToken). Includes the complete signalsManifest, full
 *    signalsHash, mode, enginesVersion, latencyMs, and the resolved
 *    input (including the raw string the user typed).
 *
 *  - REDACTED summary : every other case (mode=PUBLIC, or no session,
 *    or invalid session). Carries only the verdict-level fields the
 *    user explicitly asked for: id, createdAt, verdict, reason in both
 *    locales, action in both locales, confidence + score, and an
 *    8-char signalsHash prefix for sharing/debugging. No manifest, no
 *    per-signal payload, no input — those could let an adversary
 *    reverse-engineer the decision thresholds.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromReq,
  isValidSessionToken,
} from "@/lib/security/investigatorAuth";
import { findById } from "@/lib/reflex/persistence";
import type { ReflexAnalysisResult } from "@/lib/reflex/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fullView(row: ReflexAnalysisResult) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    verdict: row.verdict,
    verdictReasonEn: row.verdictReasonEn,
    verdictReasonFr: row.verdictReasonFr,
    actionEn: row.actionEn,
    actionFr: row.actionFr,
    confidence: row.confidence,
    confidenceScore: row.confidenceScore,
    input: {
      type: row.input.type,
      chain: row.input.chain ?? null,
      address: row.input.address ?? null,
      handle: row.input.handle ?? null,
      url: row.input.url ?? null,
      raw: row.input.raw,
    },
    signalsHash: row.signalsHash,
    signalsManifest: row.signalsManifest,
    mode: row.mode,
    enginesVersion: row.enginesVersion,
    latencyMs: row.latencyMs,
  };
}

function redactedView(row: ReflexAnalysisResult) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    verdict: row.verdict,
    verdictReasonEn: row.verdictReasonEn,
    verdictReasonFr: row.verdictReasonFr,
    actionEn: row.actionEn,
    actionFr: row.actionFr,
    confidence: row.confidence,
    confidenceScore: row.confidenceScore,
    signalsHashShort: row.signalsHash.slice(0, 8),
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const row = await findById(id);
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Visibility gate. Only SHADOW + valid investigator session unlocks the
  // full manifest. Any other combination (PUBLIC row, no cookie, invalid
  // cookie) collapses to the redacted summary — fail-closed.
  const token = getSessionTokenFromReq(req);
  const hasValidSession = token ? await isValidSessionToken(token) : false;
  const showFull = row.mode === "SHADOW" && hasValidSession;

  return NextResponse.json(showFull ? fullView(row) : redactedView(row));
}
