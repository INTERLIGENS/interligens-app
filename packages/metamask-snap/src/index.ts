import type { OnTransactionHandler } from "@metamask/snaps-sdk";
import { heading, panel, text, divider } from "@metamask/snaps-sdk";
import type { ScoreLiteResponse, SwapVerdict } from "./types";

const API_BASE = "https://interligens.com";

async function fetchVerdict(address: string): Promise<SwapVerdict> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/score-lite?address=${address}`, {
      headers: { "User-Agent": "INTERLIGENS-MetaMask-Snap/0.1" },
    });
    if (!res.ok) return "GREEN";
    const data = (await res.json()) as ScoreLiteResponse;
    const v = data.verdict;
    if (v === "RED" || v === "ORANGE" || v === "GREEN") return v;
    return "GREEN";
  } catch {
    return "GREEN";
  }
}

function buildPanel(verdict: SwapVerdict, toAddress: string) {
  const short = toAddress.slice(0, 8) + "…" + toAddress.slice(-6);
  if (verdict === "RED") {
    return panel([
      heading("⛔ HIGH RISK — INTERLIGENS"),
      text(`Recipient **${short}** is flagged **RED** by INTERLIGENS forensic analysis.`),
      divider(),
      text("This address has confirmed scam / rug indicators. **Do not proceed.**"),
    ]);
  }
  if (verdict === "ORANGE") {
    return panel([
      heading("⚠️ CAUTION — INTERLIGENS"),
      text(`Recipient **${short}** has elevated risk (ORANGE).`),
      divider(),
      text("Proceed with caution. Verify the recipient before signing."),
    ]);
  }
  return panel([
    heading("✅ CLEAR — INTERLIGENS"),
    text(`Recipient **${short}** has no known risk flags.`),
  ]);
}

export const onTransaction: OnTransactionHandler = async ({ transaction }) => {
  const to = (transaction as { to?: string }).to;
  if (!to) return { content: panel([text("No recipient address.")]) };

  const verdict = await fetchVerdict(to);
  return { content: buildPanel(verdict, to), severity: verdict === "RED" ? "critical" : verdict === "ORANGE" ? "warning" : undefined };
};
