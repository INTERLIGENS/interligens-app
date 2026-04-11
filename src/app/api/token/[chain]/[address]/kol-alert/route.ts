import { NextRequest, NextResponse } from "next/server";
import { buildKolAlert } from "@/lib/kol/alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const ipBucket = new Map<string, { count: number; windowStart: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const b = ipBucket.get(ip);
  if (!b || now - b.windowStart > WINDOW_MS) {
    ipBucket.set(ip, { count: 1, windowStart: now });
    return true;
  }
  b.count += 1;
  return b.count <= MAX_PER_WINDOW;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chain: string; address: string }> }
) {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { chain: chainRaw, address } = await params;
  if (!chainRaw || !address) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const payload = await buildKolAlert(chainRaw, address);
  return NextResponse.json(payload);
}
