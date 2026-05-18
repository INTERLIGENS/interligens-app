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

const SIGNAL_CATEGORIES = [
  {
    label: "On-chain Signals",
    desc: "Transaction patterns, wallet age, deployment history, authority status, and observable on-chain behaviors associated with the token contract and its deployer.",
  },
  {
    label: "Token Metadata",
    desc: "Token contract configuration, mint and freeze authority status, metadata completeness, and verified links between on-chain identity and off-chain presence.",
  },
  {
    label: "Liquidity Analysis",
    desc: "Depth and distribution of available liquidity, pool age, LP lock status, and observable patterns in liquidity provision and withdrawal events.",
  },
  {
    label: "Holder Concentration",
    desc: "Distribution of token supply across holder addresses, insider accumulation patterns, and the presence of coordinated holding structures.",
  },
  {
    label: "Token Age",
    desc: "Time since deployment, trading history length, and contextual signals derived from token maturity relative to observed risk indicators.",
  },
  {
    label: "Case Intelligence",
    desc: "Cross-referenced findings from the INTERLIGENS case database. When a token or associated wallet appears in an active investigation, case signals are incorporated.",
  },
  {
    label: "Community Signals",
    desc: "Aggregated scan frequency, corroboration data from independent investigations, and observable consensus signals from documented sources.",
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
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
            TigerScore draws from seven independent signal categories. Internal weights, thresholds, and detector logic are not published.
          </div>
          {SIGNAL_CATEGORIES.map((cat) => (
            <div
              key={cat.label}
              style={{ marginBottom: 10, background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "18px 22px" }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, color: "#f9fafb", letterSpacing: "0.05em", marginBottom: 6 }}>{cat.label}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>{cat.desc}</div>
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
