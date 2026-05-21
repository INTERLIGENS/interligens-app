/**
 * Casefile Engine V1 — feature-flag gate helpers.
 *
 * Two surfaces:
 *   1. assertCasefileEngineEnabled() — for server components / page routes;
 *      calls Next's notFound() so the route is indistinguishable from an
 *      unknown URL when the flag is off.
 *   2. featureDisabledApiResponse() — for API route handlers; returns a 404
 *      JSON response matching the prompt's `{ error: 'feature_disabled' }`
 *      shape.
 */

import { notFound } from "next/navigation";
import { NextResponse } from "next/server";

import { FEATURE_FLAGS } from "@/lib/featureFlags";

export function isCasefileEngineEnabled(): boolean {
  return FEATURE_FLAGS.CASEFILE_ENGINE_V1;
}

export function assertCasefileEngineEnabled(): void {
  if (!isCasefileEngineEnabled()) {
    notFound();
  }
}

export function featureDisabledApiResponse(): NextResponse {
  return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
}
