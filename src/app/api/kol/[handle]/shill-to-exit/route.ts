/**
 * GET /api/kol/[handle]/shill-to-exit
 *
 * Public endpoint. Returns the shill-to-exit signals for a given KOL handle.
 * Rate-limited at the scan preset level (20/min/IP). 1h in-memory cache.
 * Fallback: { signals: [], fallback: true } on any error — never throws.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import { detectShillToExit } from "@/lib/shill-to-exit/detector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ handle: string }> };

// In-memory cache, per lambda. 1 h TTL. Best-effort, never the primary defense.
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; body: unknown }>();

function cacheGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.body;
}

function cacheSet(key: string, body: unknown): void {
  cache.set(key, { at: Date.now(), body });
}

export async function GET(req: NextRequest, { params }: RouteCtx) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  const { handle: rawHandle } = await params;
  const handle = (rawHandle ?? "").replace(/^@+/, "").trim();
  if (!handle) {
    return NextResponse.json(
      { signals: [], fallback: true, error: "missing_handle" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const cached = cacheGet(handle);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  try {
    const signals = await detectShillToExit(handle);
    const body = {
      handle,
      signals,
      fallback: false,
      generatedAt: new Date().toISOString(),
    };
    cacheSet(handle, body);
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    console.error("[shill-to-exit] route error", err);
    return NextResponse.json(
      { handle, signals: [], fallback: true },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
