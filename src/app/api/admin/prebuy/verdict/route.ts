/**
 * PRE-BUY GUARD — admin-only verdict API (shadow mode).
 *
 *   GET /api/admin/prebuy/verdict?tokenMint=<mint>&chain=<chain>&handle=<kol?>
 *
 * Returns the fused pre-buy verdict (REFLEX + shill correlation + KOL risk).
 * No public exposure: guarded by requireAdminApi (x-admin-token). Additive,
 * read-only against existing tables.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { ForbiddenWordError } from "@/lib/reflex/forbidden-words";
import { getPreBuyVerdict } from "@/lib/prebuy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const sp = new URL(req.url).searchParams;
  const tokenMint = (sp.get("tokenMint") ?? "").trim();
  const chain = (sp.get("chain") ?? "solana").trim();
  const handle = sp.get("handle");

  if (!tokenMint) {
    return NextResponse.json(
      { error: "tokenMint is required" },
      { status: 400 },
    );
  }

  try {
    const verdict = await getPreBuyVerdict({ tokenMint, chain, handle });
    return NextResponse.json(verdict);
  } catch (err) {
    if (err instanceof ForbiddenWordError) {
      // A banned phrase leaked into a verdict reason — never serve it.
      return NextResponse.json(
        { error: "verdict wording failed safety lint", detail: err.message },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        error: "pre-buy verdict failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
