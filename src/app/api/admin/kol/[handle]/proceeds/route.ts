import { NextRequest, NextResponse } from "next/server";
import { computeProceedsForHandle } from "@/lib/kol/proceeds";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  // Basic auth — same pattern as other admin routes
  const authHeader = req.headers.get("authorization") ?? "";
  const expectedUser = process.env.ADMIN_BASIC_USER ?? "";
  const expectedPass = process.env.ADMIN_BASIC_PASS ?? "";
  const expected = "Basic " + Buffer.from(`${expectedUser}:${expectedPass}`).toString("base64");
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await computeProceedsForHandle(handle);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    handle,
    totalProceedsUsd: result.totalProceedsUsd,
    eventCount: result.eventCount,
    computedAt: new Date().toISOString(),
  });
}
