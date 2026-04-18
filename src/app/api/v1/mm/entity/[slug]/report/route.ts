// ─── GET /api/v1/mm/entity/[slug]/report ─────────────────────────────────
// Returns the MM forensic PDF for an entity. Auth via X-Api-Token matching
// ADMIN_TOKEN or MM_API_TOKEN. Admins may request drafts via
// ?allowDraft=1 — regular API tokens only get PUBLISHED / CHALLENGED
// entities.
//
// Cache-through: the generator itself reads the 24 h R2 cache, so repeat
// calls on the same day hit R2 instead of Puppeteer.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import {
  generateMmReport,
  MmReportError,
} from "@/lib/mm/reporting/pdfReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authLevel(req: NextRequest): "admin" | "api" | "none" {
  const token = req.headers.get("x-api-token") ?? "";
  if (!token) return "none";
  const received = Buffer.from(token, "utf8");
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken) {
    const buf = Buffer.from(adminToken, "utf8");
    if (buf.length === received.length && timingSafeEqual(received, buf)) {
      return "admin";
    }
  }
  const apiToken = process.env.MM_API_TOKEN;
  if (apiToken) {
    const buf = Buffer.from(apiToken, "utf8");
    if (buf.length === received.length && timingSafeEqual(received, buf)) {
      return "api";
    }
  }
  return "none";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "slug_required" }, { status: 400 });
  }

  const level = authLevel(req);
  const url = new URL(req.url);
  const rawAllowDraft = url.searchParams.get("allowDraft") === "1";
  const allowDraft = rawAllowDraft && level === "admin";
  const bypassCache = url.searchParams.get("bypassCache") === "1" && level === "admin";

  // Unauthenticated callers are only allowed to download reports for entities
  // that have a PUBLIC workflow (PUBLISHED or CHALLENGED). Rate-limited.
  // Token callers (admin / MM_API_TOKEN) always pass — and only admins can
  // toggle allowDraft / bypassCache via query params.
  if (level === "none") {
    const entity = await prisma.mmEntity.findUnique({
      where: { slug },
      select: { workflow: true },
    });
    if (!entity) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const isPublic =
      entity.workflow === "PUBLISHED" || entity.workflow === "CHALLENGED";
    if (!isPublic) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.pdf);
    if (!rl.allowed) return rateLimitResponse(rl);
  }

  try {
    const result = await generateMmReport(slug, {
      allowDraft,
      bypassCache,
    });
    return new NextResponse(result.pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="mm-report-${slug}.pdf"`,
        "Cache-Control": "private, max-age=0",
        "X-MM-Report-Source": result.source,
        ...(result.cacheKey ? { "X-MM-Report-Cache-Key": result.cacheKey } : {}),
      },
    });
  } catch (err) {
    if (err instanceof MmReportError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status },
      );
    }
    console.error("[mm/report] generation failed", err);
    return NextResponse.json(
      { error: "generation_failed" },
      { status: 500 },
    );
  }
}
