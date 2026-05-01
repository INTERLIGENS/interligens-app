import BetaNav from "@/components/beta/BetaNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developers — Private API Beta · INTERLIGENS",
  description:
    "Programmatic TigerScore for qualified partners and integrations. Private beta — by invitation only. Request access: admin@interligens.com",
  openGraph: {
    title: "Developers — Private API Beta · INTERLIGENS",
    description:
      "Programmatic TigerScore for qualified partners and integrations. By invitation only.",
  },
};

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/partner/v1/score-lite",
    desc: "Lightweight TigerScore for any Solana, Ethereum, or EVM token. Returns score, tier, and top signals.",
    params: "address (required) — token mint or contract address",
  },
  {
    method: "GET",
    path: "/api/v1/score",
    desc: "Full TigerScore with case intelligence, off-chain signals, and community data.",
    params: "mint (required) — Solana mint address",
  },
  {
    method: "GET",
    path: "/api/v1/scan-context",
    desc: "Token metadata context: name, symbol, chain, and enriched risk flags.",
    params: "target (required) — address or mint",
  },
];

export default function DevelopersPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.2em",
                color: "#FF6B00",
                background: "#FF6B0012",
                border: "1px solid #FF6B0044",
                padding: "4px 12px",
                borderRadius: 4,
              }}
            >
              PRIVATE BETA — BY INVITATION ONLY
            </span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            Developers — Private API Beta
          </h1>
          <div style={{ marginTop: 12, fontSize: 14, color: "#d1d5db", lineHeight: 1.7 }}>
            Programmatic TigerScore for qualified partners and integrations.
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#9ca3af", lineHeight: 1.7 }}>
            Public self-serve keys are not available during private beta.
          </div>
        </div>

        {/* ── ACCESS ── */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #FF6B0033",
            borderRadius: 10,
            padding: "28px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 16 }}>
            REQUEST ACCESS
          </div>
          <p style={{ fontSize: 14, color: "#d1d5db", lineHeight: 1.75, margin: 0, marginBottom: 16 }}>
            API access is granted to qualified partners, compliance teams, and security integrations on a case-by-case basis.
            No self-serve key generation is available during the private beta.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
            <a
              href="mailto:admin@interligens.com"
              style={{
                background: "#FF6B00",
                color: "#000",
                fontWeight: 900,
                fontSize: 12,
                letterSpacing: "0.05em",
                padding: "10px 22px",
                borderRadius: 8,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Request access: admin@interligens.com
            </a>
          </div>
        </div>

        {/* ── ENDPOINTS ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 16 }}>
            AVAILABLE ENDPOINTS (PARTNER TIER)
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
            Three endpoints are available to approved partners. Full documentation provided upon approval.
          </div>
          {ENDPOINTS.map((ep) => (
            <div
              key={ep.path}
              style={{
                marginBottom: 12,
                background: "#0f0f0f",
                border: "1px solid #1a1a1a",
                borderRadius: 8,
                padding: "18px 22px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
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
                  }}
                >
                  {ep.method}
                </span>
                <code
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: "#d1d5db",
                    fontWeight: 700,
                  }}
                >
                  {ep.path}
                </code>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6, marginBottom: 6 }}>{ep.desc}</div>
              <div style={{ fontSize: 11, color: "#4b5563" }}>
                <span style={{ fontWeight: 700, color: "#6b7280" }}>Params: </span>{ep.params}
              </div>
            </div>
          ))}
        </div>

        {/* ── USE CASES ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 16 }}>
            QUALIFIED INTEGRATIONS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Wallet apps", desc: "Pre-transaction risk check on destination tokens" },
              { label: "DEX frontends", desc: "Token risk badge at point of swap" },
              { label: "Compliance tooling", desc: "Batch TigerScore for portfolio screening" },
              { label: "Security dashboards", desc: "Alert on high-risk token detection" },
            ].map((uc) => (
              <div
                key={uc.label}
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #1a1a1a",
                  borderRadius: 8,
                  padding: "16px 18px",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, color: "#f9fafb", marginBottom: 4 }}>{uc.label}</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>{uc.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── NOT AVAILABLE ── */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #1a1a1a",
            borderRadius: 8,
            padding: "18px 22px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.2em", marginBottom: 10 }}>
            NOT AVAILABLE DURING PRIVATE BETA
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {[
              "Self-serve API key generation",
              "Developer dashboard",
              "Free tier or open quotas",
              "Webhook subscriptions",
              "Bulk historical data export",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#374151", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#6b7280" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            borderTop: "1px solid #111827",
            paddingTop: 24,
            fontSize: 11,
            color: "#374151",
            lineHeight: 1.7,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap" as const,
            gap: 8,
          }}
        >
          <span>INTERLIGENS Delaware C-Corp · Private beta · Not financial advice</span>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="/en/methodology" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Methodology →</a>
            <a href="/en/integrations" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Integrations →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
