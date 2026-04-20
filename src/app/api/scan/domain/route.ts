import { NextRequest, NextResponse } from "next/server";
import {
  scanDomainForCloning,
  LEGITIMATE_DOMAINS,
} from "@/lib/security/domainCloning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/scan/domain?url=<string>
 *
 * Returns a JSON verdict on whether `url` is a clone of a legitimate
 * DEX / frontend domain. Pure function over the input + the shipped
 * `LEGITIMATE_DOMAINS` list — no network, no DB.
 *
 * Query-string flags:
 *   - ?mock=domain-red    → returns a RED clone example
 *   - ?mock=domain-green  → returns a GREEN legitimate example
 *
 * The endpoint is public. Rate limits are handled upstream by the
 * middleware edge layer.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mock = sp.get("mock");

  if (mock === "domain-red") {
    return NextResponse.json(
      scanDomainForCloning("https://pumpfun.cc/token/abc"),
      { status: 200 },
    );
  }
  if (mock === "domain-green") {
    return NextResponse.json(
      scanDomainForCloning("https://pump.fun/board"),
      { status: 200 },
    );
  }

  const url = sp.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "url query parameter required" },
      { status: 400 },
    );
  }

  const result = scanDomainForCloning(url);
  return NextResponse.json(
    {
      ...result,
      checkedAgainst: LEGITIMATE_DOMAINS,
    },
    { status: 200 },
  );
}
