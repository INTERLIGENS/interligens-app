import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { NextRequest, NextResponse } from "next/server";

import { vaultLookup } from "@/lib/vault/vaultLookup";
import { checkScanLimit } from "@/lib/vault/scanRateLimit";
import { auditScanLookup } from "@/lib/vault/auditScan";

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
  const _rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(req));

  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  const deep = (searchParams.get("deep") || "false") === "true";

  if (!address) return NextResponse.json({ error: "missing address" }, { status: 400 });

  // Demo-stable response (no external API key needed)
  let score = 45;
  if (deep) score += 10;
  score = clamp(score);

  const tier = tierFrom(score);


  let intelVault = { match: false, categories: [] as string[], explainAvailable: false };
  try { const { vaultLookup } = await import("@/lib/vault/vaultLookup"); const _vr = await vaultLookup("tron", address); intelVault = { ..._vr, explainAvailable: _vr.match }; } catch {}
  return NextResponse.json({
    chain: "tron",
    address, intelVault,
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
