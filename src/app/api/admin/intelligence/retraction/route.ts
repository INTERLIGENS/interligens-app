import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import {
  applyRetraction,
  validateRetractionInput,
  type RetractionInput,
} from "@/lib/intelligence/retractionEngine";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: Partial<RetractionInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const validation = validateRetractionInput(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "validation failed", details: validation.errors }, { status: 400 });
  }

  try {
    const record = await applyRetraction(body as RetractionInput);
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error("[retraction] POST failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
