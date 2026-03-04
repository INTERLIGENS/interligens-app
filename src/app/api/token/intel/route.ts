import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { NextResponse } from "next/server";

type Chain = "SOL" | "ETH";

function isEth(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}
function isSol(a: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
}

export async function GET(req: Request) {
  const _rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(req));

  try {
    const url = new URL(req.url);
    const chain = (url.searchParams.get("chain") || "").toUpperCase() as Chain;
    const address = (url.searchParams.get("address") || "").trim();

    if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });
    if (chain !== "SOL" && chain !== "ETH") return NextResponse.json({ error: "Invalid chain" }, { status: 400 });
    if (chain === "ETH" && !isEth(address)) return NextResponse.json({ error: "Invalid ETH address" }, { status: 400 });
    if (chain === "SOL" && !isSol(address)) return NextResponse.json({ error: "Invalid SOL address" }, { status: 400 });

    const origin = url.origin;

    // Reuse existing scan endpoints
    const scanUrl =
      chain === "SOL"
        ? `${origin}/api/wallet/scan?address=${encodeURIComponent(address)}&deep=false`
        : `${origin}/api/scan/eth?address=${encodeURIComponent(address)}&deep=false`;

    const r = await fetch(scanUrl, { cache: "no-store" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(
        { error: "Token intel failed", detail: data?.detail || data?.error || `Scan error ${r.status}` },
        { status: r.status }
      );
    }

    // --- Minimal non-mock token intel from what we already have
    if (chain === "ETH") {
      const approvalsUnlimited = Number(data?.approvalsSummary?.unlimited ?? 0) || 0;
      const approvalsTotal = Number(data?.approvalsSummary?.total ?? 0) || 0;
      const tokens = Array.isArray(data?.tokens) ? data.tokens : [];
      const tokenCount = tokens.length;

      const authorities: string[] = [];
      if (approvalsUnlimited > 0) authorities.push("Unlimited approvals present");
      if (approvalsTotal > 15) authorities.push("High approval surface");
      if (tokenCount === 0) authorities.push("No ERC20 transfers observed");

      // Liquidity proxy (wallet-side): if many unlimited approvals -> “Unlocked risk”
      const liquidity = approvalsUnlimited > 0 ? "Unlocked" : approvalsTotal > 8 ? "Low" : "Locked";

      // Concentration proxy: not true holders, but “asset diversity”
      const concentration = tokenCount >= 20 ? "Diversified assets (20+ tokens)" : tokenCount >= 5 ? "Moderate asset diversity" : "Concentrated (few tokens)";

      const anomaly =
        approvalsUnlimited > 0 ? "Unlimited approvals increase drain risk" : approvalsTotal > 20 ? "High approval surface (many contracts)" : null;

      return NextResponse.json({
        ok: true,
        chain,
        address,
        concentration,
        liquidity,
        authorities,
        anomaly,
        note: "V2 minimal: derived from wallet scan data. Holder concentration/liquidity lock requires token-specific endpoints (V2.5/V3).",
      });
    }

    // SOL
    const unknown = Number(data?.programsSummary?.unknownCount ?? data?.unknownProgramsCount ?? 0) || 0;
    const tx = Number(data?.summary?.txCount ?? data?.txCount ?? 0) || 0;

    const authorities: string[] = [];
    if (unknown > 0) authorities.push("Unknown programs interacted");
    if (tx < 5) authorities.push("Very low activity (burner-like)");

    const liquidity = unknown > 3 ? "Unlocked" : unknown > 0 ? "Low" : "Locked";
    const concentration = tx < 10 ? "Sparse history (limited signal)" : "Normal history (more signal)";

    const anomaly = unknown > 0 ? "Unverified programs may indicate risky dApps" : null;

    return NextResponse.json({
      ok: true,
      chain,
      address,
      concentration,
      liquidity,
      authorities,
      anomaly,
      note: "V2 minimal: Solana token authorities/liquidity need token-mint level endpoints (next sprint).",
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Token intel crashed", detail: String(e?.message || e) }, { status: 500 });
  }
}
