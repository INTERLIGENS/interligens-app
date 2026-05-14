/**
 * REFLEX V1 — /api/reflex/:id/proof-pack — STUB
 *
 * The proof-pack adapter (Puppeteer template + R2 archive + SHA-256
 * anchor) lands in Commit 10 of the V1 plan. Until then this endpoint
 * returns 501 so callers learn the surface exists but cannot rely on it.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_IMPLEMENTED_BODY = {
  error: "proof_pack_not_implemented",
  detail: "Proof pack generation arrives in Commit 10 of REFLEX V1.",
  availableIn: "commit-10",
};

export async function POST() {
  return NextResponse.json(NOT_IMPLEMENTED_BODY, { status: 501 });
}

export async function GET() {
  return NextResponse.json(NOT_IMPLEMENTED_BODY, { status: 501 });
}
