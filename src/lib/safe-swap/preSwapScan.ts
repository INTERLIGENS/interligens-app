import { computeVerdict } from "@/lib/publicScore/computeVerdict";
import type { PreSwapScanResult, SwapVerdict } from "./types";

export async function preSwapScan(
  fromAddress: string,
  toAddress: string,
): Promise<PreSwapScanResult> {
  let fromVerdict: SwapVerdict = "GREEN";
  let toVerdict: SwapVerdict = "GREEN";

  try {
    [fromVerdict, toVerdict] = await Promise.all([
      computeVerdict(fromAddress),
      computeVerdict(toAddress),
    ]);
  } catch {
    return { fromVerdict: "GREEN", toVerdict: "GREEN", blocked: false };
  }

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
