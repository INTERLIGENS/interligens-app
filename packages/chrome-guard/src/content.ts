import { fetchVerdict, type Verdict } from "./api";

const SOL_MINT_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const EVM_ADDR_RE = /0x[0-9a-fA-F]{40}/g;

function extractAddressFromUrl(): string | null {
  const url = window.location.href;
  const evmMatch = url.match(EVM_ADDR_RE);
  if (evmMatch) return evmMatch[0];
  const params = new URLSearchParams(window.location.search);
  const inputMint = params.get("inputMint") ?? params.get("outputMint") ?? params.get("mint");
  if (inputMint && inputMint.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) return inputMint;
  const pathParts = window.location.pathname.split("/");
  for (const part of pathParts) {
    if (part.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) return part;
  }
  return null;
}

function injectBadge(verdict: Verdict, address: string) {
  const existing = document.getElementById("interligens-guard-badge");
  if (existing) existing.remove();

  const colors: Record<Verdict, { bg: string; text: string; label: string }> = {
    RED: { bg: "#FF3B5C", text: "#FFFFFF", label: "HIGH RISK" },
    ORANGE: { bg: "#FF6B00", text: "#FFFFFF", label: "CAUTION" },
    GREEN: { bg: "#00FF94", text: "#000000", label: "CLEAR" },
  };
  const c = colors[verdict];
  const short = address.slice(0, 6) + "…" + address.slice(-4);

  const badge = document.createElement("div");
  badge.id = "interligens-guard-badge";
  badge.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 999999;
    background: ${c.bg}; color: ${c.text};
    font-family: 'Courier New', monospace; font-size: 11px; font-weight: 900;
    padding: 8px 14px; border-radius: 4px; letter-spacing: 0.1em;
    box-shadow: 0 2px 12px rgba(0,0,0,0.5); cursor: default;
    display: flex; flex-direction: column; gap: 2px;
  `;
  badge.innerHTML = `
    <span style="font-size:9px;opacity:0.8;">INTERLIGENS GUARD</span>
    <span>${c.label} — ${short}</span>
  `;
  document.body.appendChild(badge);

  if (verdict === "GREEN") {
    setTimeout(() => badge.remove(), 4000);
  }
}

async function main() {
  const address = extractAddressFromUrl();
  if (!address) return;
  const verdict = await fetchVerdict(address);
  injectBadge(verdict, address);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
