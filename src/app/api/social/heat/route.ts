import { NextResponse } from "next/server";

type Chain = "SOL" | "ETH";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function isEth(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}
function isSol(a: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const chain = (url.searchParams.get("chain") || "").toUpperCase() as Chain;
    const address = (url.searchParams.get("address") || "").trim();

    if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });
    if (chain !== "SOL" && chain !== "ETH") return NextResponse.json({ error: "Invalid chain" }, { status: 400 });
    if (chain === "ETH" && !isEth(address)) return NextResponse.json({ error: "Invalid ETH address" }, { status: 400 });
    if (chain === "SOL" && !isSol(address)) return NextResponse.json({ error: "Invalid SOL address" }, { status: 400 });

    const origin = url.origin;

    // Reuse existing scan endpoints (single source of truth)
    const scanUrl =
      chain === "SOL"
        ? `${origin}/api/wallet/scan?address=${encodeURIComponent(address)}&deep=false`
        : `${origin}/api/scan/eth?address=${encodeURIComponent(address)}&deep=false`;

    const r = await fetch(scanUrl, { cache: "no-store" });
    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return NextResponse.json(
        { error: "Social heat failed", detail: data?.detail || data?.error || `Scan error ${r.status}` },
        { status: r.status }
      );
    }

    // --- Heuristics (non-mock): derive “social risk” proxies from on-chain signals
    // SOL signals
    const solScore = Number(data?.risk?.score ?? data?.score ?? 0) || 0;
    const solUnknown = Number(data?.programsSummary?.unknownCount ?? data?.unknownProgramsCount ?? 0) || 0;
    const solTx = Number(data?.summary?.txCount ?? data?.txCount ?? 0) || 0;

    // ETH signals
    const ethScore = Number(data?.score ?? 0) || 0;
    const approvalsUnlimited = Number(data?.approvalsSummary?.unlimited ?? 0) || 0;
    const approvalsTotal = Number(data?.approvalsSummary?.total ?? 0) || 0;
    const counterparties = Array.isArray(data?.counterparties) ? data.counterparties.length : 0;

    let heat: "Low" | "Medium" | "High" = "Low";
    let botScore = 20;

    if (chain === "SOL") {
      // base from score + unknown programs + low history
      const base =
        solScore * 0.7 +
        clamp(solUnknown, 0, 15) * 4 +
        (solTx < 5 ? 15 : 0);

      botScore = clamp(Math.round(base), 0, 100);
      heat = botScore >= 70 ? "High" : botScore >= 40 ? "Medium" : "Low";
    } else {
      const base =
        ethScore * 0.6 +
        clamp(approvalsUnlimited, 0, 6) * 10 +
        (approvalsTotal > 20 ? 10 : approvalsTotal > 8 ? 6 : 0) +
        (counterparties > 20 ? 10 : counterparties > 10 ? 6 : 0);

      botScore = clamp(Math.round(base), 0, 100);
      heat = botScore >= 70 ? "High" : botScore >= 40 ? "Medium" : "Low";
    }

    const promoterRisk: "GREEN" | "ORANGE" | "RED" = heat === "High" ? "RED" : heat === "Medium" ? "ORANGE" : "GREEN";

    // Top calls/promoters = placeholder for V3 (needs OSINT sources)
    const topCalls: { source: string; time: string; link: string }[] = [];

    const explanation =
      chain === "SOL"
        ? [
            solUnknown > 0 ? `${solUnknown} unknown programs detected` : "No unknown programs detected",
            solTx < 5 ? "Very low history (burner-like)" : `History: ${solTx} tx`,
            `On-chain risk score: ${solScore}`,
          ]
        : [
            approvalsUnlimited > 0 ? `${approvalsUnlimited} unlimited approvals` : "No unlimited approvals detected",
            approvalsTotal > 0 ? `${approvalsTotal} approvals total` : "No approvals summary",
            counterparties > 0 ? `${counterparties} counterparties analyzed` : "No counterparties list",
          ];

    return NextResponse.json({
      ok: true,
      chain,
      address,
      heat,
      botScore,
      promoterRisk,
      topCalls,
      explanation,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Social heat crashed", detail: String(e?.message || e) }, { status: 500 });
  }
}
