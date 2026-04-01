import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorSession } from "@/lib/security/investigatorAuth";

export async function GET(req: NextRequest) {
  const deny = await requireInvestigatorSession(req);
  if (deny) return deny;

  try {
    const internal = await fetch(new URL("/api/v1/kol?limit=100", req.nextUrl.origin));
    const data = await internal.json();
    const all = data.results ?? data.profiles ?? [];

    // Filter published-only: require at least 1 evidence or 1 case
    const published = all.filter(
      (k: { evidenceCount?: number; caseCount?: number }) =>
        (k.evidenceCount ?? 0) > 0 || (k.caseCount ?? 0) > 0,
    );

    return NextResponse.json({ kols: published });
  } catch {
    return NextResponse.json({ kols: [] });
  }
}
