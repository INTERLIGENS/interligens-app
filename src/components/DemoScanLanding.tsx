"use client";

function normalizeSolToFlat(raw: any) {
  if (!raw) return raw;
  const score = raw?.score ?? raw?.risk?.score;
  const tier  = raw?.tier  ?? raw?.risk?.tier;
  const txCount = raw?.txCount ?? raw?.summary?.txCount;
  return { ...raw, score, tier, txCount };
}


function normalizeSol(raw: any) {
  if (!raw) return raw;
  // SOL backend often returns: { ok: true, risk: { score, tier }, ... }
  if (raw.risk && (raw.score == null)) raw.score = raw.risk?.score;
  if (raw.risk && (raw.tier == null)) raw.tier = raw.risk?.tier;
  return raw;
}

import React, { useState } from "react";

type Tier = "GREEN" | "ORANGE" | "RED";
type Chain = "SOL" | "ETH";

const TIER_COLOR: Record<Tier, string> = { GREEN: "#22c55e", ORANGE: "#F85B05", RED: "#ef4444" };
const TIER_BG: Record<Tier, string> = { GREEN: "rgba(34,197,94,0.12)", ORANGE: "rgba(248,91,5,0.12)", RED: "rgba(239,68,68,0.12)" };
const RISK_LABEL: Record<string, string> = { g: "CLEAN", o: "CAUTION", r: "RISKY" };
const RISK_COLOR: Record<string, string> = { g: "#4ade80", o: "#fbbf24", r: "#f87171" };
const RISK_BG: Record<string, string> = { g: "rgba(34,197,94,0.1)", o: "rgba(245,158,11,0.1)", r: "rgba(239,68,68,0.1)" };

const MOCKS: Record<string, any> = {
  green: {
    chain: "SOL", addr: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    score: 12, tier: "GREEN",
    headline: "Low risk — wallet appears clean",
    sub: "No known scam associations, healthy transaction patterns, diversified legitimate holdings.",
    drivers: [
      { icon: "✓", type: "pos", signal: "Clean transaction history", detail: "847 txs, no interaction with flagged contracts or mixers", weight: "−2 pts", wt: "low" },
      { icon: "✓", type: "pos", signal: "Diversified legitimate holdings", detail: "Portfolio spread across major protocols: SOL, USDC, staked assets", weight: "−5 pts", wt: "low" },
      { icon: "◐", type: "warn", signal: "Minor: Low wallet age", detail: "Account created 34 days ago — slight uncertainty premium", weight: "+9 pts", wt: "med" },
    ],
    holdings: [
      { sym: "SOL", val: "$2,840", risk: "g" }, { sym: "USDC", val: "$12,000", risk: "g" },
      { sym: "JUP", val: "$430", risk: "g" }, { sym: "WIF", val: "$118", risk: "o" },
    ],
    action: { icon: "✅", title: "Safe to interact", desc: "No significant risk signals detected. Apply standard due diligence for large transactions." },
    warnings: [],
  },
  orange: {
    chain: "ETH", addr: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    score: 58, tier: "ORANGE",
    headline: "Suspicious patterns detected",
    sub: "Multiple risk signals identified. Proceed with caution — verification recommended.",
    drivers: [
      { icon: "⚠", type: "neg", signal: "KOL pump coordination", detail: "Wallet interacted with 14 known KOL-linked pump addresses within 72h", weight: "+24 pts", wt: "high" },
      { icon: "⚠", type: "neg", signal: "Bundled token distributions", detail: "Coordinated airdrops across 7 wallets suggesting insider allocation", weight: "+18 pts", wt: "high" },
      { icon: "◐", type: "warn", signal: "Partial mixer exposure", detail: "2 transactions routed via Tornado Cash-adjacent protocol (1 hop)", weight: "+12 pts", wt: "med" },
    ],
    holdings: [
      { sym: "ETH", val: "$8,200", risk: "g" }, { sym: "USDT", val: "$4,500", risk: "g" },
      { sym: "PEPE2", val: "$3,100", risk: "r" }, { sym: "XYZ", val: "$800", risk: "r" },
    ],
    action: { icon: "⚠️", title: "Verify before transacting", desc: "Do not send funds without verifying the counterparty identity." },
    warnings: ["Token PEPE2: launched 6 days ago, 94% supply held by 3 wallets", "Token XYZ: unverified ownership transfer function in contract"],
  },
  red: {
    chain: "SOL", addr: "DrFtxPb9qLvGNqgrZVm5bFh8c8qSLvxXjE2wDzY7KkMN",
    score: 89, tier: "RED",
    headline: "High-risk — scam indicators found",
    sub: "This wallet matches known scammer profiles. Multiple on-chain evidence points to rug-pull coordination.",
    drivers: [
      { icon: "⚠", type: "neg", signal: "Dev-withdrawal stealth path", detail: "$240K extracted via proxy wallet 3 min after liquidity lock expiry", weight: "+32 pts", wt: "high" },
      { icon: "⚠", type: "neg", signal: "Multi-wallet sybil cluster", detail: "Controls 23 shadow wallets used to simulate organic buying pressure", weight: "+28 pts", wt: "high" },
      { icon: "⚠", type: "neg", signal: "Threat intelligence match", detail: "Address matches IL-THREAT-0041 and IL-THREAT-0089 in investigator network", weight: "+15 pts", wt: "high" },
    ],
    holdings: [
      { sym: "SOL", val: "$310", risk: "g" }, { sym: "RUGX", val: "$0", risk: "r" }, { sym: "PUMP99", val: "$12", risk: "r" },
    ],
    action: { icon: "🚨", title: "AVOID — Do not interact", desc: "Linked to confirmed rug-pull operations. Block all incoming requests." },
    warnings: [
      "INTERLIGENS threat file IL-THREAT-0041 — confirmed rug operator (2025-11-14)",
      "INTERLIGENS threat file IL-THREAT-0089 — cross-chain migration pattern",
      "Wallet drained $1.2M across 3 launches in 90 days",
    ],
  },
};

function normalizeTier(raw: any): Tier {
  const t = String(raw?.tier ?? raw?.risk?.tier ?? raw?.risk_tier ?? "GREEN").toUpperCase();
  return (t === "GREEN" || t === "ORANGE" || t === "RED") ? t as Tier : "GREEN";
}

function normalizeResult(raw: any, fallbackChain: Chain, fallbackAddr: string): any {
  if (!raw) return null;
  const tier = normalizeTier(raw);
  const score = Math.min(100, Math.max(0, Number(raw.score ?? raw.risk?.score ?? raw.risk_score ?? 0)));
  const headlines: Record<Tier, string> = {
    GREEN: "Low risk — wallet appears clean",
    ORANGE: "Suspicious patterns detected",
    RED: "High-risk — scam indicators found",
  };
  const subs: Record<Tier, string> = {
    GREEN: "No significant risk patterns detected.",
    ORANGE: "Proceed with caution — verification recommended.",
    RED: "Multiple on-chain evidence points to malicious activity.",
  };
  const actions: Record<Tier, { icon: string; title: string; desc: string }> = {
    GREEN: { icon: "✅", title: "Safe to interact", desc: "No significant risk signals. Apply standard due diligence." },
    ORANGE: { icon: "⚠️", title: "Verify before transacting", desc: "Do not send funds without verifying the counterparty." },
    RED: { icon: "🚨", title: "AVOID — Do not interact", desc: "Linked to high-risk activity. Block all incoming requests." },
  };
  // Build drivers from SOL or ETH API format
  const drivers: any[] = [];
  const riskDrivers = Array.isArray(raw.risk?.drivers) ? raw.risk.drivers : [];
  const programs = Array.isArray(raw.programs) ? raw.programs : [];
  
  riskDrivers.forEach((d: any) => {
    drivers.push({ icon: "◐", type: "warn", signal: String(d.signal ?? d.label ?? d.reason ?? d), detail: String(d.detail ?? d.description ?? ""), weight: String(d.weight ?? ""), wt: "med" });
  });
  
  programs.filter((p: any) => p.risk === "high").slice(0, 3).forEach((p: any) => {
    drivers.push({ icon: "⚠", type: "neg", signal: "Unknown program: " + String(p.name ?? p.id), detail: String(p.count ?? 0) + " interactions", weight: "+8 pts", wt: "high" });
  });
  
  const rawProofs = Array.isArray(raw.proofs) ? raw.proofs : Array.isArray(raw.reasons) ? raw.reasons : [];
  rawProofs.forEach((d: any) => {
    drivers.push({ icon: "◐", type: "warn", signal: String(typeof d === "string" ? d : (d.signal ?? d.label ?? d)), detail: "", weight: "", wt: "med" });
  });

  if (drivers.length === 0) drivers.push({ icon: "✓", type: "pos", signal: "Scan complete — no major risk signals", detail: "", weight: "", wt: "low" });

  const rawHoldings: any[] = Array.isArray(raw.holdings) ? raw.holdings : Array.isArray(raw.tokens) ? raw.tokens : [];
  const holdings = rawHoldings.slice(0, 6).map((h: any) => ({
    sym: String(h.sym ?? h.symbol ?? h.name ?? "TOKEN"),
    val: String(h.val ?? h.value ?? h.usd ?? "—"),
    risk: h.risk ?? "o",
  }));
  return {
    chain: raw.chain ?? fallbackChain,
    addr: raw.addr ?? raw.address ?? fallbackAddr,
    score, tier,
    headline: raw.headline ?? headlines[tier],
    sub: raw.sub ?? raw.summary ?? subs[tier],
    drivers, holdings,
    action: (raw.action && raw.action.title) ? raw.action : actions[tier],
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  };
}

function ScoreGauge({ score, tier }: { score: number; tier: Tier }) {
  const circ = 285;
  const offset = circ - (score / 100) * circ;
  const color = TIER_COLOR[tier];
  return (
    <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
      <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: "rotate(-220deg)" }}>
        <circle cx="80" cy="80" r="65" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" strokeDasharray="285" />
        <circle cx="80" cy="80" r="65" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
        <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 1, color, fontFamily: "ui-monospace,monospace", letterSpacing: -2 }}>{score}</div>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,.45)", fontWeight: 700 }}>TIGER SCORE</div>
      </div>
    </div>
  );
}

const WRAP: React.CSSProperties = { width: "min(1080px, calc(100% - 40px))", margin: "0 auto" };
const CARD: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04))",
  borderRadius: 26, boxShadow: "0 20px 60px rgba(0,0,0,.55)", overflow: "hidden", marginBottom: 20,
};

function btnStyle(active: boolean): React.CSSProperties {
  if (active) return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
    padding: "12px 14px", borderRadius: 14,
    borderWidth: 1, borderStyle: "solid", borderColor: "rgba(248,91,5,0.5)",
    background: "rgba(248,91,5,0.15)", color: "#F85B05",
    fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer",
  };
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
    padding: "12px 14px", borderRadius: 14,
    borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,.92)",
    fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer",
  };
}

const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
  padding: "12px 14px", borderRadius: 14,
  borderWidth: 1, borderStyle: "solid", borderColor: "rgba(248,91,5,0.65)",
  background: "linear-gradient(135deg, rgba(248,91,5,0.95), rgba(248,91,5,0.65))",
  color: "#0B0D10", fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer",
};

export default function DemoScanLanding() {
  const [chain, setChain] = useState<Chain>("SOL");
  const [addr, setAddr] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function showStatus(type: "ok" | "err", text: string) {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  }

  function detectChain(a: string): Chain {
    return /^0x[0-9a-fA-F]/.test(a.trim()) ? "ETH" : "SOL";
  }

  function validate(a: string, c: Chain) {
    if (c === "SOL") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
    return /^0x[0-9a-fA-F]{40}$/.test(a);
  }

  function handleAddrChange(v: string) {
    setAddr(v);
    if (v.trim().length > 5) setChain(detectChain(v));
  }

  async function loadMock(tier: string) {
    const d = MOCKS[tier];
    setChain(d.chain as Chain);
    setAddr(d.addr);
    setResult(null);
    setLoading(true);
    await new Promise(r => setTimeout(r, 1600));
    setResult(d);
    setLoading(false);
  }

  async function runScan() {
    const a = addr.trim();
    if (!a) { showStatus("err", "Please paste a wallet address first."); return; }
    const c = detectChain(a);
    setChain(c);
    if (!validate(a, c)) {
      showStatus("err", c === "SOL"
        ? "Invalid Solana address — expected base58, 32–44 characters."
        : "Invalid Ethereum address — expected 0x + 40 hex characters.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const url = c === "ETH"
        ? `/api/scan/eth?address=${encodeURIComponent(a)}`
        : `/api/wallet/scan?address=${encodeURIComponent(a)}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      const fixed = (chain === "SOL") ? normalizeSol(json) : json;
      if (!res.ok) throw new Error(json?.detail || json?.error || `Error ${res.status}`);
      setResult(fixed);
    } catch (e: any) {
      showStatus("err", String(e?.message || "Scan failed — please try again."));
    } finally {
      setLoading(false);
    }
  }

  const display = normalizeResult(result, chain, addr);

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial", minHeight: "100vh", color: "rgba(255,255,255,.92)", background: "radial-gradient(1100px 520px at 20% 10%, rgba(248,91,5,0.20), transparent 55%), radial-gradient(900px 520px at 80% 20%, rgba(255,255,255,0.10), transparent 60%), #0B0D10" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <header style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(14px)", background: "linear-gradient(to bottom, rgba(11,13,16,0.75), rgba(11,13,16,0.35))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ ...WRAP, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", gap: 14 }}>
          <div style={{ fontWeight: 900, letterSpacing: "0.8px", textTransform: "uppercase", fontSize: 14 }}>
            INTER<span style={{ color: "#F85B05" }}>LIGENS</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(248,91,5,0.4)", background: "rgba(248,91,5,0.1)", color: "#F85B05", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "#F85B05" }} />DEMO
            </div>
            <a href="/" style={{ ...BTN_PRIMARY, textDecoration: "none", fontSize: 13, padding: "9px 14px" }}>Early access</a>
          </div>
        </div>
      </header>

      <main style={{ padding: "56px 0 60px" }}>
        <div style={WRAP}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,.68)", fontSize: 13, marginBottom: 18 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#F85B05", boxShadow: "0 0 0 6px rgba(248,91,5,0.12)" }} />
              Anti-scam intelligence for retail crypto
            </div>
            <h1 style={{ fontSize: "clamp(32px,4.2vw,52px)", lineHeight: 1.03, letterSpacing: "-.7px", margin: "0 0 14px" }}>
              Scan. Score. <em style={{ color: "#F85B05", fontStyle: "normal" }}>Decide.</em>
            </h1>
            <p style={{ color: "rgba(255,255,255,.68)", fontSize: 16, lineHeight: 1.65, maxWidth: "58ch", margin: 0 }}>
              Paste any Solana or Ethereum wallet address and get an instant Tiger Risk Score — with evidence, not a black box.
            </p>
          </div>

          <div style={CARD}>
            <div style={{ padding: 28, display: "grid", gap: 20 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "rgba(255,255,255,.68)", fontSize: 13, fontWeight: 500, marginRight: 4 }}>Chain</span>
                <button style={btnStyle(chain === "SOL")} onClick={() => setChain("SOL")}>◎ Solana</button>
                <button style={btnStyle(chain === "ETH")} onClick={() => setChain("ETH")}>⟠ Ethereum</button>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 14, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", flex: 1, minWidth: 240 }}>
                  <input
                    style={{ flex: 1, outline: "none", border: "none", background: "transparent", color: "rgba(255,255,255,.92)", fontFamily: "ui-monospace,monospace", fontSize: 13 }}
                    value={addr}
                    onChange={e => handleAddrChange(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && runScan()}
                    placeholder="Paste wallet address — auto-detects SOL or ETH…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <button style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1 }} onClick={runScan} disabled={loading}>
                  {loading ? "Scanning…" : "Scan Address"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: "rgba(255,255,255,.45)", fontSize: 12, fontWeight: 600, letterSpacing: .5, textTransform: "uppercase" }}>Try a demo ›</span>
                {["green", "orange", "red"].map(t => (
                  <button key={t} onClick={() => loadMock(t)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", fontSize: 12, fontFamily: "inherit", color: "rgba(255,255,255,.68)", fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: t === "green" ? "#22c55e" : t === "orange" ? "#F85B05" : "#ef4444" }} />
                    {t === "green" ? "Safe wallet" : t === "orange" ? "Suspicious activity" : "Known scammer"}
                  </button>
                ))}
              </div>
              {statusMsg && (
                <div style={{ padding: "10px 14px", borderRadius: 14, borderWidth: 1, borderStyle: "solid", borderColor: statusMsg.type === "err" ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)", background: statusMsg.type === "err" ? "rgba(239,68,68,0.05)" : "rgba(34,197,94,0.05)", color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
                  {statusMsg.text}
                </div>
              )}
              {loading && (
                <div style={{ textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 999, borderWidth: 3, borderStyle: "solid", borderColor: "rgba(248,91,5,0.2)", borderTopColor: "#F85B05", animation: "spin 0.9s linear infinite" }} />
                  <div style={{ color: "rgba(255,255,255,.45)", fontSize: 13, fontFamily: "ui-monospace,monospace" }}>Analyzing on-chain data…</div>
                </div>
              )}
            </div>
          </div>

          {display && !loading && (
            <div style={{ animation: "fadeUp .4s ease" }}>
              <div style={CARD}>
                <div style={{ padding: 28, display: "grid", gap: 24 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 14, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", fontSize: 13, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "rgba(248,91,5,0.1)", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(248,91,5,0.25)", color: "#F85B05" }}>{display.chain}</span>
                    <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, color: "rgba(255,255,255,.5)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display.addr}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,.3)", fontFamily: "ui-monospace,monospace" }}>Scanned {new Date().toLocaleTimeString()}</span>
                  </div>
                  <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "start" }}>
                    <ScoreGauge score={display.score} tier={display.tier} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content", padding: "8px 16px", borderRadius: 999, fontWeight: 800, fontSize: 14, letterSpacing: 1, textTransform: "uppercase", borderWidth: 1, borderStyle: "solid", borderColor: TIER_COLOR[display.tier] + "55", background: TIER_BG[display.tier], color: TIER_COLOR[display.tier] }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: TIER_COLOR[display.tier] }} />{display.tier}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-.3px" }}>{display.headline}</div>
                      <div style={{ color: "rgba(255,255,255,.68)", fontSize: 14, lineHeight: 1.6 }}>{display.sub}</div>
                    </div>
                  </div>
                  <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)" }} />
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,.35)", fontWeight: 700, marginBottom: 12 }}>Evidence · Why this score</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {display.drivers.map((d: any, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 14, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, background: d.type === "neg" ? "rgba(239,68,68,0.15)" : d.type === "warn" ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)", borderWidth: 1, borderStyle: "solid", borderColor: d.type === "neg" ? "rgba(239,68,68,0.25)" : d.type === "warn" ? "rgba(245,158,11,0.25)" : "rgba(34,197,94,0.25)" }}>{d.icon}</div>
                          <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5 }}>
                            <strong style={{ fontWeight: 700, display: "block", marginBottom: 2 }}>{d.signal}</strong>
                            <span style={{ color: "rgba(255,255,255,.55)", fontSize: 12.5 }}>{d.detail}</span>
                          </div>
                          {d.weight ? <span style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", fontWeight: 700, padding: "3px 8px", borderRadius: 6, alignSelf: "flex-start", whiteSpace: "nowrap", color: d.wt === "high" ? "#f87171" : d.wt === "med" ? "#fbbf24" : "#4ade80", background: d.wt === "high" ? "rgba(239,68,68,0.1)" : d.wt === "med" ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)" }}>{d.weight}</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,.35)", fontWeight: 700, marginBottom: 12 }}>Holdings snapshot</div>
                      {display.holdings.length > 0 ? (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead><tr>
                            {["Token","Value","Risk"].map(h => <th key={h} style={{ textAlign: "left", color: "rgba(255,255,255,.35)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,.07)" }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {display.holdings.map((h: any, i: number) => (
                              <tr key={i}>
                                <td style={{ paddingTop: 10, borderBottom: "1px solid rgba(255,255,255,.04)", fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>{h.sym}</td>
                                <td style={{ paddingTop: 10, borderBottom: "1px solid rgba(255,255,255,.04)", color: "rgba(255,255,255,.55)", paddingRight: 12 }}>{h.val}</td>
                                <td style={{ paddingTop: 10, borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                                  <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, color: RISK_COLOR[h.risk] ?? "#fbbf24", background: RISK_BG[h.risk] ?? "rgba(245,158,11,0.1)" }}>{RISK_LABEL[h.risk] ?? "UNKNOWN"}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ color: "rgba(255,255,255,.35)", fontSize: 13 }}>No holdings data returned.</div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,.35)", fontWeight: 700, marginBottom: 12 }}>Recommended action</div>
                      <div style={{ padding: "16px 18px", borderRadius: 18, background: "rgba(255,255,255,0.05)", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.1)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <div style={{ fontSize: 22 }}>{display.action.icon}</div>
                        <div>
                          <strong style={{ display: "block", fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{display.action.title}</strong>
                          <p style={{ color: "rgba(255,255,255,.6)", fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{display.action.desc}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {display.warnings.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,.35)", fontWeight: 700, marginBottom: 12 }}>Active warnings</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {display.warnings.map((w: string, i: number) => (
                          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 12, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", fontSize: 13, color: "#fca5a5" }}>⚠ {w}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ color: "rgba(255,255,255,.35)", fontSize: 12, lineHeight: 1.5 }}>
                    Not financial advice. INTERLIGENS is an investigative tool. © 2026 INTERLIGENS
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer style={{ padding: "22px 0 34px", borderTop: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
        <div style={{ ...WRAP, display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div>© 2026 <strong style={{ color: "rgba(255,255,255,.7)" }}>INTERLIGENS</strong></div>
          <a href="https://interligens.com" style={{ color: "#F85B05", fontWeight: 600, textDecoration: "none" }}>interligens.com</a>
        </div>
      </footer>
    </div>
  );
}
