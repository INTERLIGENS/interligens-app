// src/lib/wallet-connect/preConnectScan.ts
// Calls /api/v1/score before allowing wallet connect.

import type { ScanBeforeConnectResult, WalletVerdictTier } from "./types";

interface ScoreApiResponse {
  tier?: string;
  score?: number;
  riskScore?: number;
}

export async function scanBeforeConnect(
  address: string,
  baseUrl = ""
): Promise<ScanBeforeConnectResult> {
  const url = `${baseUrl}/api/v1/score?mint=${encodeURIComponent(address)}&_t=${Date.now()}`;

  let tier: WalletVerdictTier = "GREEN";
  let score = 0;

  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data: ScoreApiResponse = await res.json();
      score = data.score ?? data.riskScore ?? 0;
      const raw = (data.tier ?? "").toUpperCase();
      if (raw === "RED" || score >= 70)    tier = "RED";
      else if (raw === "ORANGE" || score >= 40) tier = "ORANGE";
      else                                      tier = "GREEN";
    }
  } catch {
    // Fail-open: if score API unreachable, allow connection with no warning
    return { allow: true, warning: null, tier: "GREEN", score: 0, address };
  }

  if (tier === "RED") {
    return { allow: false, warning: "HIGH RISK", tier, score, address };
  }
  if (tier === "ORANGE") {
    return { allow: true, warning: "CAUTION", tier, score, address };
  }
  return { allow: true, warning: null, tier, score, address };
}
