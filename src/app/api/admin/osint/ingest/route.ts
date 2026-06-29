/**
 * src/app/api/admin/osint/ingest/route.ts
 *
 * OSINT Vision Ingest V1 — EXTRACT (dry-run). Admin-only.
 *
 * POST one screenshot (base64) -> Anthropic vision -> seed-format PLAN JSON.
 * THIS ROUTE NEVER WRITES TO THE DATABASE. It returns the plan + confidence +
 * uncertain[] for human review. Commit is a separate, explicit step.
 *
 * Body: {
 *   imageBase64: string,          // raw base64 OR a data: URL
 *   mimeType?: string,            // image/png|jpeg|gif|webp (else detected)
 *   kolHandle?: string,           // optional hint
 *   capturedAt?: string,          // optional ISO capture time (file mtime)
 *   fileName?: string             // optional, for provenance
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { callVision, type VisionMediaType } from "@/lib/osint/vision/callVision";
import { buildPlan } from "@/lib/osint/vision/buildPlan";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

const MAGIC: Array<{ sig: number[]; type: VisionMediaType }> = [
  { sig: [0x89, 0x50, 0x4e, 0x47], type: "image/png" },
  { sig: [0xff, 0xd8, 0xff], type: "image/jpeg" },
  { sig: [0x47, 0x49, 0x46, 0x38], type: "image/gif" },
];

function detectMediaType(buf: Buffer, declared?: string): VisionMediaType | null {
  // WEBP: RIFF....WEBP
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  for (const m of MAGIC) {
    if (m.sig.every((b, i) => buf[i] === b)) return m.type;
  }
  const d = (declared ?? "").toLowerCase();
  if (d === "image/png" || d === "image/jpeg" || d === "image/gif" || d === "image/webp") {
    return d as VisionMediaType;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawImage = body.imageBase64;
  if (typeof rawImage !== "string" || !rawImage) {
    return NextResponse.json({ error: "missing_image", detail: "imageBase64 required" }, { status: 400 });
  }

  // accept data URLs and pull the declared mime from them
  let b64 = rawImage;
  let dataUrlMime: string | undefined;
  const m = rawImage.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) {
    dataUrlMime = m[1];
    b64 = m[2];
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return NextResponse.json({ error: "bad_base64" }, { status: 400 });
  }
  if (buf.length === 0) {
    return NextResponse.json({ error: "empty_image" }, { status: 400 });
  }
  if (buf.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "image_too_large", detail: "max 10MB" }, { status: 413 });
  }

  const mediaType = detectMediaType(buf, (body.mimeType as string) ?? dataUrlMime);
  if (!mediaType) {
    return NextResponse.json(
      { error: "unsupported_media_type", detail: "png/jpeg/gif/webp only" },
      { status: 415 },
    );
  }

  // REAL sha256 of the actual file bytes
  const sha256 = createHash("sha256").update(buf).digest("hex");

  const kolHandleHint = typeof body.kolHandle === "string" ? body.kolHandle : null;
  const capturedAt = typeof body.capturedAt === "string" ? body.capturedAt : null;
  const fileName = typeof body.fileName === "string" && body.fileName
    ? body.fileName
    : `vision_upload_${sha256.slice(0, 12)}.${mediaType.split("/")[1]}`;

  // ── Vision call ──
  let vision;
  try {
    vision = await callVision(buf.toString("base64"), mediaType, kolHandleHint);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "VISION_NOT_JSON") {
      return NextResponse.json({ error: "vision_unparseable", detail: "model did not return JSON" }, { status: 422 });
    }
    console.error("[osint/ingest] vision error:", err);
    return NextResponse.json({ error: "vision_unavailable" }, { status: 502 });
  }

  const plan = buildPlan({ vision, sha256, bytes: buf.length, fileName, kolHandleHint, capturedAt });

  // DRY-RUN: nothing is written. Return the plan for human review.
  return NextResponse.json({
    ok: true,
    mode: "dry_run",
    note: "No database write. Review, correct if needed, then POST to /api/admin/osint/commit.",
    sha256,
    mediaType,
    bytes: buf.length,
    plan,
  });
}
