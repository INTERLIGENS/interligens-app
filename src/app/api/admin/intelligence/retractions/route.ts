import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { getRetractions, rejectRetraction, type RetractionStatus } from "@/lib/intelligence/retractionEngine";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = req.nextUrl;
  const handle = searchParams.get("handle") ?? undefined;
  const status = (searchParams.get("status") ?? undefined) as RetractionStatus | undefined;

  try {
    const records = await getRetractions(handle, status);
    return NextResponse.json(records);
  } catch (err) {
    console.error("[retractions] GET failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  try {
    const body = await req.json() as { id: string; action: "reject" };
    if (!body.id || body.action !== "reject") {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await rejectRetraction(body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[retractions] PATCH failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
