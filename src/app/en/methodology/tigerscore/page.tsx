import BetaNav from "@/components/beta/BetaNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TigerScore — INTERLIGENS Methodology",
  description:
    "How the INTERLIGENS TigerScore works. A 0–100 evidence-based risk score across multiple on-chain signal categories. Architecture, not recipe.",
  openGraph: {
    title: "TigerScore — INTERLIGENS Methodology",
    description:
      "A 0–100 evidence-based risk score across multiple on-chain signal categories. Architecture, not recipe.",
  },
};

const SIGNAL_GROUPS: {
  group: string;
  signals: { code: string; desc: string }[];
}[] = [
  {
    group: "On-chain Signals",
    signals: [
      { code: "holders_concentrated_80", desc: "Top holders control 80%+ of supply." },
      { code: "holders_concentrated_60", desc: "Top holders control 60%+ of supply." },
      { code: "liquidity_very_low", desc: "Less than $10K liquidity." },
      { code: "liquidity_low", desc: "Less than $50K liquidity." },
      { code: "token_young_7d", desc: "Token created in the last 7 days." },
      { code: "token_young_30d", desc: "Token created in the last 30 days." },
      { code: "volume_very_low", desc: "Less than $1K daily trading volume." },
      { code: "cluster_risk", desc: "Three or more strong signals combined." },
      { code: "pump_fun_origin", desc: "Token launched via pump.fun." },
    ],
  },
  {
    group: "Case Intelligence",
    signals: [
      { code: "OFAC / Sanctions check", desc: "Screened against 332K+ sanctioned entities." },
      { code: "Scam Sniffer", desc: "Third-party scam-address database integration." },
      { code: "GoPlus", desc: "Honeypot and phishing contract detection." },
      { code: "Casefile claims", desc: "Cross-referenced against 5 published cases." },
      { code: "KOL Registry correlation", desc: "Matched against documented influencer profiles." },
    ],
  },
  {
    group: "Market Data",
    signals: [
      { code: "DexScreener", desc: "Real-time price, market cap, and volume." },
      { code: "Pump.fun detection", desc: "Identifies pump.fun-launched tokens." },
    ],
  },
  {
    group: "Social Intelligence",
    signals: [
      { code: "Watcher V2", desc: "79 handles monitored automatically every 72 hours." },
      { code: "Shill pattern detection", desc: "Identifies coordinated promotion bursts." },
      { code: "Campaign clustering", desc: "Groups related promotion activity across actors." },
    ],
  },
];

export default function TigerScoreMethodologyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>

        {/* Breadcrumb */}
        <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 32 }}>
          <a href="/en/methodology" style={{ color: "#FF6B00", textDecoration: "none", fontWeight: 700 }}>Methodology</a>
          <span style={{ margin: "0 8px" }}>→</span>
          <span>TigerScore</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>TIGERSCORE SYSTEM</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>How TigerScore Works</h1>
          <div style={{ marginTop: 12, fontSize: 14, color: "#d1d5db", lineHeight: 1.7 }}>
            TigerScore is a 0–100 evidence-based risk score computed from multiple independent signal categories. Higher scores indicate higher observed risk.
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>Architecture, not recipe.</div>
        </div>

        {/* Score tiers */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 16 }}>RISK TIERS</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
            {[
              { tier: "GREEN", range: "0 – 39", label: "Lower observed risk", color: "#10b981", desc: "No critical signals surfaced. Risk indicators within observed norms for this chain and token type." },
              { tier: "ORANGE", range: "40 – 69", label: "Elevated risk — caution", color: "#f59e0b", desc: "One or more elevated signals present. Independent verification recommended before interaction." },
              { tier: "RED", range: "70 – 100", label: "Critical risk", color: "#ef4444", desc: "Multiple high-severity signals detected. Consistent with documented high-risk patterns." },
            ].map((t) => (
              <div
                key={t.tier}
                style={{
                  background: "#0f0f0f",
                  border: `1px solid ${t.color}44`,
                  borderLeft: `3px solid ${t.color}`,
                  borderRadius: 8,
                  padding: "18px 22px",
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 80 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, color: t.color, letterSpacing: "0.15em", marginBottom: 4 }}>{t.tier}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: t.color, fontFamily: "monospace" }}>{t.range}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Signal categories */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 16 }}>SIGNAL CATEGORIES</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>
            TigerScore draws from four signal groups, all currently live in production. Internal weights, thresholds, and detector logic are not published — only the architecture below.
          </div>
          {SIGNAL_GROUPS.map((g) => (
            <div key={g.group} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#f9fafb", letterSpacing: "0.05em" }}>{g.group}</div>
                <span
                  style={{
                    background: "#00FF9415",
                    border: "1px solid #00FF9444",
                    color: "#00FF94",
                    fontSize: 8,
                    fontWeight: 900,
                    padding: "3px 9px",
                    borderRadius: 4,
                    letterSpacing: "0.12em",
                  }}
                >
                  LIVE
                </span>
              </div>
              <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "6px 22px" }}>
                {g.signals.map((s, i) => (
                  <div
                    key={s.code}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 12,
                      padding: "12px 0",
                      borderTop: i === 0 ? "none" : "1px solid #161616",
                      flexWrap: "wrap" as const,
                    }}
                  >
                    <code style={{ fontSize: 12, fontFamily: "monospace", color: "#FF6B00", fontWeight: 700 }}>{s.code}</code>
                    <span style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Proprietary notice */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #FF6B0022",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 10 }}>PROPRIETARY</div>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75 }}>
            Individual signal weights, score thresholds, detector internals, and anti-evasion logic are not disclosed. Disclosure would enable targeted evasion of detection systems. INTERLIGENS publishes the architecture — not the recipe.
          </div>
        </div>

        {/* Score use disclaimer */}
        <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.7, borderTop: "1px solid #111827", paddingTop: 24 }}>
          TigerScore is an analytical instrument. It is not a financial recommendation, a legal finding, or an audit result.
          Scores reflect observed signals at the time of computation and may change as new evidence emerges.
          <br /><br />
          <a href="/en/methodology" style={{ color: "#FF6B00", textDecoration: "none", fontWeight: 700 }}>← Back to Methodology</a>
          <span style={{ margin: "0 12px", color: "#1f2937" }}>·</span>
          <a href="/en/methodology/kol-risk" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>KOL Risk Profile →</a>
        </div>
      </div>
    </div>
  );
}
