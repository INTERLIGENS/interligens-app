import type { PreSwapScanResult, SwapVerdict } from "./types";

async function scanToken(address: string, baseUrl = ""): Promise<SwapVerdict> {
  try {
    const url = `${baseUrl}/api/v1/score?mint=${encodeURIComponent(address)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return "GREEN";
    const data = await res.json();
    const verdict: string = data.verdict ?? "GREEN";
    if (verdict === "RED" || verdict === "ORANGE" || verdict === "GREEN") {
      return verdict as SwapVerdict;
    }
    return "GREEN";
  } catch {
    return "GREEN";
  }
}

export async function preSwapScan(
  fromAddress: string,
  toAddress: string,
  baseUrl = "",
): Promise<PreSwapScanResult> {
  const [fromVerdict, toVerdict] = await Promise.all([
    scanToken(fromAddress, baseUrl),
    scanToken(toAddress, baseUrl),
  ]);

  if (fromVerdict === "RED" || toVerdict === "RED") {
    const which = fromVerdict === "RED" ? "source token" : "destination token";
    return {
      fromVerdict,
      toVerdict,
      blocked: true,
      blockReason: `${which} is flagged RED — swap blocked`,
    };
  }

  if (fromVerdict === "ORANGE" || toVerdict === "ORANGE") {
    const which = fromVerdict === "ORANGE" ? "source token" : "destination token";
    return {
      fromVerdict,
      toVerdict,
      blocked: false,
      warning: `${which} has elevated risk (ORANGE) — proceed with caution`,
    };
  }

  return { fromVerdict, toVerdict, blocked: false };
}
