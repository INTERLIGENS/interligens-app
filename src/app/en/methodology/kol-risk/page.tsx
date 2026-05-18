import BetaNav from "@/components/beta/BetaNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KOL Risk Profile — INTERLIGENS Methodology",
  description:
    "How INTERLIGENS assesses influencer risk. Seven directional axes. Evidence-based. Architecture, not recipe.",
  openGraph: {
    title: "KOL Risk Profile — INTERLIGENS Methodology",
    description:
      "How INTERLIGENS assesses influencer risk. Seven directional axes. Evidence-based.",
  },
};

const AXES = [
  {
    id: "laundry-linkage",
    label: "Laundry Linkage",
    desc: "Observed on-chain connections between the actor's documented wallets and addresses associated with high-risk flows, mixers, or flagged counterparties.",
  },
  {
    id: "observed-proceeds",
    label: "Observed Proceeds",
    desc: "Minimum documented cashout events attributed to the actor across verified wallet clusters. Figures represent on-chain floors, not total earnings.",
  },
  {
    id: "mm-coordination",
    label: "MM Coordination",
    desc: "Evidence of coordinated market-making or wash-trading activity linked to tokens promoted by this actor, based on observable transaction patterns.",
  },
  {
    id: "rug-avoidance",
    label: "Rug Avoidance",
    desc: "Pattern of exiting promoted positions prior to documented collapses. Assessed across multiple launches with verified timing data.",
  },
  {
    id: "timing-quality",
    label: "Timing Quality",
    desc: "Consistency between public promotion timing and documented insider wallet activity. Early access and pre-launch positioning are assessed.",
  },
  {
    id: "holding-pattern",
    label: "Holding Pattern",
    desc: "Observable behavior of attributed wallets post-promotion: sell timing, hold duration, and distribution patterns relative to retail activity.",
  },
  {
    id: "disclosure-honesty",
    label: "Public Disclosure Honesty",
    desc: "Assessment of publicly stated claims — team relationships, wallet ownership, compensation disclosures — against verifiable on-chain and public record evidence.",
  },
];

export default function KolRiskMethodologyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>

        {/* Breadcrumb */}
        <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 32 }}>
          <a href="/en/methodology" style={{ color: "#FF6B00", textDecoration: "none", fontWeight: 700 }}>Methodology</a>
          <span style={{ margin: "0 8px" }}>→</span>
          <span>KOL Risk Profile</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>KOL RISK PROFILE</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>How Influencer Risk Is Assessed</h1>
          <div style={{ marginTop: 12, fontSize: 14, color: "#d1d5db", lineHeight: 1.7 }}>
            INTERLIGENS assesses key opinion leaders (KOLs) across seven directional axes. Each axis contributes to a holistic risk profile.
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>Architecture, not recipe.</div>
        </div>

        {/* Axes */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 16 }}>DIRECTIONAL AXES</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
            Formulas, scoring weights, and axis thresholds are not published. INTERLIGENS documents the axes — not the arithmetic.
          </div>
          {AXES.map((axis, i) => (
            <div
              key={axis.id}
              style={{
                marginBottom: 10,
                background: "#0f0f0f",
                border: "1px solid #1a1a1a",
                borderRadius: 8,
                padding: "18px 22px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  minWidth: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#FF6B0018",
                  border: "1px solid #FF6B0044",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 900,
                  color: "#FF6B00",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#f9fafb", marginBottom: 6 }}>{axis.label}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>{axis.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Holistic note */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #1f2937",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.2em", marginBottom: 10 }}>HOLISTIC SCORING</div>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75 }}>
            No single axis determines an outcome. Risk profiles emerge from the combination, weight, and corroboration of signals across all axes. A high reading on one axis may be offset by documented evidence on another. All profiles are reviewed before publication.
          </div>
        </div>

        {/* PERSON-type notice */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #FF6B0022",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 10 }}>PUBLICATION STANDARD</div>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75 }}>
            KOL profiles are published only when a minimum evidence threshold is met across at least two independent axes. Profiles in review, restricted status, or draft state are not publicly visible. INTERLIGENS does not publish speculation — only documented observations.
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.7, borderTop: "1px solid #111827", paddingTop: 24 }}>
          KOL risk profiles are analytical instruments. They are not legal findings, defamation, or financial advice.
          All published profiles meet a documented evidence threshold and are subject to correction requests.
          <br /><br />
          <a href="/en/methodology" style={{ color: "#FF6B00", textDecoration: "none", fontWeight: 700 }}>← Back to Methodology</a>
          <span style={{ margin: "0 12px", color: "#1f2937" }}>·</span>
          <a href="/en/methodology/tigerscore" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>TigerScore →</a>
          <span style={{ margin: "0 12px", color: "#1f2937" }}>·</span>
          <a href="/en/kol" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>KOL Registry →</a>
        </div>
      </div>
    </div>
  );
}
