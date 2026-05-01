import BetaNav from "@/components/beta/BetaNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BOTIFY — Evidence View · INTERLIGENS",
  description:
    "Public-safe evidence view for CASE-2024-BOTIFY-001. Documented wallet connections, on-chain flows, and corroborated claims. Readonly.",
  openGraph: {
    title: "BOTIFY — Evidence View · INTERLIGENS",
    description:
      "Documented wallet connections, on-chain flows, and corroborated claims. Readonly.",
  },
};

// Static data from data/cases/botify.json — readonly, no admin tools
const CASE = {
  id: "CASE-2024-BOTIFY-001",
  token: "BOTIFY",
  ticker: "$BOTIFY",
  mint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
  chain: "Solana",
  status: "Confirmed",
  severity: "RED",
  openedAt: "2024-11-01",
  updatedAt: "2025-01-15",
  summary:
    "BOTIFY token exhibits multiple high-severity rug-pull indicators: anonymous team, no locked liquidity, coordinated shill campaigns, and abrupt social media abandonment post-launch. Eight independent claims corroborated by screenshot evidence.",
};

const CLAIMS = [
  { id: "C1", title: "Coordinated Shill Campaign", severity: "HIGH", status: "CONFIRMED", category: "social_manipulation", desc: "Multiple bot accounts posted identical promotional content within minutes of each other, displaying classic coordinated pump behavior." },
  { id: "C2", title: "Insider Pre-Launch Pump Signal", severity: "HIGH", status: "CONFIRMED", category: "insider_trading", desc: "Telegram group messages show buy signals distributed to insiders 45 minutes before public listing, enabling front-running." },
  { id: "C3", title: "Liquidity Withdrawal < 30 min Post-Peak", severity: "CRITICAL", status: "CONFIRMED", category: "rug_pull", desc: "On-chain data confirms the deployer wallet removed 100% of liquidity from the primary Raydium pool within 28 minutes of the price peak, causing a 97% collapse." },
  { id: "C4", title: "Pre-funded Wallet Cluster (Sybil)", severity: "HIGH", status: "CONFIRMED", category: "sybil_attack", desc: "Seven wallets received identical SOL amounts from a single source wallet 2 hours before launch. All seven sold at peak within a 90-second window." },
  { id: "C5", title: "Mint & Freeze Authority Not Revoked", severity: "CRITICAL", status: "CONFIRMED", category: "contract_risk", desc: "Rugcheck.xyz confirms mint authority and freeze authority both remain active, allowing the deployer to mint unlimited supply or freeze any holder wallet." },
  { id: "C6", title: "Anonymous Team / Same-Day Domain", severity: "MEDIUM", status: "CONFIRMED", category: "identity_risk", desc: "Project website domain registered on the same day as token launch. No team identities, CVs, or verifiable social accounts exist." },
  { id: "C7", title: "Whale Concentration — Top 3 Hold 62%", severity: "HIGH", status: "CONFIRMED", category: "tokenomics_risk", desc: "At peak, top 3 holder wallets controlled 62% of circulating supply, indicating extreme insider accumulation." },
  { id: "C8", title: "Social Media Abandonment Post-Launch", severity: "HIGH", status: "CONFIRMED", category: "project_abandonment", desc: "All official BOTIFY social channels went completely silent on day 5 after launch. No developer responses to community distress signals." },
];

// Wallet nodes for the evidence graph
const WALLETS = [
  { id: "deployer", label: "Deployer", short: "7xKQ…mN2u", role: "DEPLOYER", color: "#ef4444", x: 50, y: 50 },
  { id: "source", label: "Source Wallet", short: "BYZ9…h69x", role: "FUNDER", color: "#f97316", x: 50, y: 200 },
  { id: "sybil1", label: "Sybil W1", short: "4xZ9…kQMM", role: "SYBIL", color: "#f59e0b", x: 220, y: 130 },
  { id: "sybil2", label: "Sybil W2", short: "9Th6…BYZ9", role: "SYBIL", color: "#f59e0b", x: 220, y: 200 },
  { id: "sybil3", label: "Sybil W3", short: "DezX…PB26", role: "SYBIL", color: "#f59e0b", x: 220, y: 270 },
  { id: "raydium", label: "Raydium Pool", short: "RAY…mmLP", role: "DEX", color: "#6b7280", x: 380, y: 130 },
  { id: "cex1", label: "CEX Deposit", short: "5KJe…xFG2", role: "CEX", color: "#3b82f6", x: 380, y: 270 },
];

const EDGES = [
  { from: "source", to: "deployer", label: "Pre-launch fund", amount: "— SOL" },
  { from: "source", to: "sybil1", label: "Identical SOL", amount: "Equal" },
  { from: "source", to: "sybil2", label: "Identical SOL", amount: "Equal" },
  { from: "source", to: "sybil3", label: "Identical SOL", amount: "Equal" },
  { from: "deployer", to: "raydium", label: "LP add → remove", amount: "100% LP" },
  { from: "sybil1", to: "cex1", label: "Sell at peak", amount: "~90s window" },
  { from: "sybil2", to: "cex1", label: "Sell at peak", amount: "~90s window" },
  { from: "sybil3", to: "cex1", label: "Sell at peak", amount: "~90s window" },
];

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#6b7280",
};

export default function BotifyEvidencePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 16, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: "#ef4444", letterSpacing: "0.2em", background: "#ef444418", border: "1px solid #ef444444", padding: "3px 10px", borderRadius: 4 }}>
                CONFIRMED · RED
              </span>
              <span style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.15em" }}>
                {CASE.id}
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
              {CASE.token} — Evidence View
            </h1>
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
              {CASE.chain} · Mint: <code style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{CASE.mint.slice(0, 16)}…</code>
              · Opened {CASE.openedAt} · Updated {CASE.updatedAt}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 6 }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#4b5563", letterSpacing: "0.2em", background: "#111", border: "1px solid #1f2937", padding: "4px 10px", borderRadius: 4 }}>
              PUBLIC-SAFE EVIDENCE VIEW
            </span>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#374151", letterSpacing: "0.15em" }}>INTERLIGENS — READONLY</span>
          </div>
        </div>

        {/* ── SUMMARY ── */}
        <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "20px 24px", marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 10 }}>CASE SUMMARY</div>
          <p style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.75, margin: 0 }}>{CASE.summary}</p>
        </div>

        {/* ── WALLET FLOW DIAGRAM ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em" }}>WALLET FLOW DIAGRAM</div>
            <span style={{ fontSize: 9, color: "#374151", fontWeight: 700 }}>Static · Evidence-based · Not live</span>
          </div>

          <div style={{ background: "#070707", border: "1px solid #1a1a1a", borderRadius: 10, padding: 24, overflowX: "auto" as const }}>
            <svg width="560" height="360" viewBox="0 0 560 360" style={{ display: "block", maxWidth: "100%" }}>
              {/* Edges */}
              {EDGES.map((e, i) => {
                const from = WALLETS.find((w) => w.id === e.from)!;
                const to = WALLETS.find((w) => w.id === e.to)!;
                const fx = from.x + 60;
                const fy = from.y + 18;
                const tx = to.x;
                const ty = to.y + 18;
                const mx = (fx + tx) / 2;
                const my = (fy + ty) / 2;
                return (
                  <g key={i}>
                    <line x1={fx} y1={fy} x2={tx} y2={ty} stroke="#333" strokeWidth="1" markerEnd="url(#arrow)" />
                    <text x={mx} y={my - 4} textAnchor="middle" fontSize="8" fill="#4b5563" fontFamily="monospace">
                      {e.label}
                    </text>
                  </g>
                );
              })}

              {/* Arrow marker */}
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#444" />
                </marker>
              </defs>

              {/* Wallet nodes */}
              {WALLETS.map((w) => (
                <g key={w.id}>
                  <rect
                    x={w.x}
                    y={w.y}
                    width={120}
                    height={36}
                    rx={6}
                    fill="#0f0f0f"
                    stroke={w.color}
                    strokeWidth="1"
                  />
                  <text x={w.x + 8} y={w.y + 12} fontSize="8" fill={w.color} fontWeight="900" fontFamily="monospace">
                    {w.role}
                  </text>
                  <text x={w.x + 8} y={w.y + 26} fontSize="9" fill="#d1d5db" fontFamily="monospace">
                    {w.short}
                  </text>
                </g>
              ))}

              {/* INTERLIGENS watermark */}
              <text x="280" y="345" textAnchor="middle" fontSize="9" fill="#1a1a1a" fontWeight="900" fontFamily="monospace" letterSpacing="0.3em">
                INTERLIGENS
              </text>
            </svg>

            {/* Legend */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const, marginTop: 16, paddingTop: 12, borderTop: "1px solid #1a1a1a" }}>
              {[
                { color: "#ef4444", label: "Deployer" },
                { color: "#f97316", label: "Funder" },
                { color: "#f59e0b", label: "Sybil wallet" },
                { color: "#3b82f6", label: "CEX deposit" },
                { color: "#6b7280", label: "DEX / LP" },
              ].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CLAIMS ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 16 }}>CORROBORATED CLAIMS ({CLAIMS.length})</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
            {CLAIMS.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #1a1a1a",
                  borderLeft: `3px solid ${SEVERITY_COLOR[c.severity] ?? "#6b7280"}`,
                  borderRadius: 8,
                  padding: "14px 18px",
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 36, textAlign: "center" as const }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#4b5563" }}>{c.id}</div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 7,
                      fontWeight: 900,
                      color: SEVERITY_COLOR[c.severity] ?? "#6b7280",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {c.severity}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#f9fafb", marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>{c.desc}</div>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 900,
                      color: "#10b981",
                      background: "#10b98118",
                      border: "1px solid #10b98144",
                      padding: "2px 8px",
                      borderRadius: 3,
                      letterSpacing: "0.1em",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── DETECTIVE TRADE ── */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #ef444444",
            borderRadius: 8,
            padding: "18px 22px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, color: "#ef4444", letterSpacing: "0.2em", marginBottom: 10 }}>INSIDER TRADE — DOCUMENTED</div>
          <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.7 }}>
            Insider wallet bought 2h before launch, sold at peak — <strong style={{ color: "#ef4444" }}>+$4,820 PnL in 18 minutes</strong>.
            Wallet pre-funded from the cluster source address. Sell timing within 90-second coordinated window.
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#4b5563" }}>
            Wallet: <code style={{ fontFamily: "monospace" }}>DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263</code>
          </div>
        </div>

        {/* ── FOOTER DISCLAIMER ── */}
        <div
          style={{
            borderTop: "1px solid #111827",
            paddingTop: 24,
            fontSize: 11,
            color: "#374151",
            lineHeight: 1.7,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 8 }}>
            <span>
              Public-safe evidence view · Readonly · No admin tools · INTERLIGENS Delaware C-Corp
              <br />
              Not legal advice · Not financial advice · Evidence-based
            </span>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const }}>
              <a href="/en/explorer" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Case Explorer →</a>
              <a href="/en/methodology" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Methodology →</a>
              <a href="/en/correction" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Request correction →</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
