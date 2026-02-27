import { NextRequest, NextResponse } from "next/server";

type Tier = "green" | "orange" | "red";

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}
function tierFrom(score: number): Tier {
  if (score >= 70) return "red";
  if (score >= 35) return "orange";
  return "green";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  const deep = (searchParams.get("deep") || "false") === "true";

  if (!address) return NextResponse.json({ error: "missing address" }, { status: 400 });

  // Demo-stable response (no external API key needed)
  let score = 45;
  if (deep) score += 10;
  score = clamp(score);

  const tier = tierFrom(score);

  return NextResponse.json({
    chain: "tron",
    address,
    score,
    tier,
    proofs: [
      { label: "TRON signal", value: "TRON scan connected (demo mode)", level: tier },
      { label: "TRON signal", value: "Upgrade later to TronGrid for live data", level: tier },
      { label: "TRON signal", value: deep ? "Deep scan: stronger evidence" : "Run Deep Scan for stronger evidence", level: tier },
    ],
    rawSummary: { deep, mode: "demo-stable" },
  });
}
