import BetaNav from "@/components/beta/BetaNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — INTERLIGENS",
  description:
    "How INTERLIGENS scores, documents, and surfaces risk. Architecture, not recipe. Every TigerScore is grounded in documented signals and evidence context.",
  openGraph: {
    title: "Methodology — INTERLIGENS",
    description:
      "Architecture, not recipe. Every TigerScore is grounded in documented signals and evidence context.",
  },
};

export default function MethodologyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>METHODOLOGY</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16, margin: 0 }}>
            Architecture, not recipe.
          </h1>
          <div style={{ marginTop: 12, fontSize: 14, color: "#d1d5db", lineHeight: 1.7 }}>
            Every TigerScore is grounded in documented signals and evidence context.
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#9ca3af", lineHeight: 1.7 }}>
            Internal weights, thresholds, detector internals, and anti-evasion logic remain proprietary.
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>Evidence-based. Not financial advice.</div>
        </div>

        {/* ── NAVIGATION CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 56 }}>
          <a
            href="/en/methodology/tigerscore"
            style={{ textDecoration: "none", background: "#0f0f0f", border: "1px solid #FF6B00", borderRadius: 10, padding: "24px", display: "block" }}
          >
            <div style={{ fontSize: 9, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 8 }}>TIGERSCORE</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#f9fafb", marginBottom: 8 }}>TigerScore System</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
              How tokens are scored 0–100. Signal categories, risk tiers, evidence thresholds.
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#FF6B00", fontWeight: 700 }}>Explore →</div>
          </a>
          <a
            href="/en/methodology/kol-risk"
            style={{ textDecoration: "none", background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 10, padding: "24px", display: "block" }}
          >
            <div style={{ fontSize: 9, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 8 }}>KOL RISK</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#f9fafb", marginBottom: 8 }}>KOL Risk Profile</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
              How influencer risk is assessed. Directional axes, behavioral signals, evidence framework.
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#FF6B00", fontWeight: 700 }}>Explore →</div>
          </a>
        </div>

        {/* ── PROOF GRAPH LINK ── */}
        <a
          href="/en/methodology/proof-graph"
          style={{ textDecoration: "none", background: "#0f0f0f", border: "1px solid #FF6B00", borderRadius: 10, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 56, flexWrap: "wrap" }}
        >
          <div>
            <div style={{ fontSize: 9, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 6 }}>PROOF GRAPH</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#f9fafb" }}>See how TigerScore is built</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>The full scoring architecture — branches, inputs, and what is live.</div>
          </div>
          <div style={{ fontSize: 12, color: "#FF6B00", fontWeight: 700, whiteSpace: "nowrap" }}>Proof Graph →</div>
        </a>

        {/* ── A) WHAT WE ANALYZE ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>WHAT WE ANALYZE</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, marginBottom: 8 }}>Every input behind a score</h2>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.7, marginTop: 8, marginBottom: 16 }}>
            Each TigerScore is assembled from four evidence layers, all sourced from public data.
          </div>
          {[
            { label: "7 chains live", body: "Solana, Ethereum, Base, Arbitrum, BSC, TRON, Neon." },
            { label: "On-chain signals", body: "Holder concentration, liquidity depth, token age, volume analysis, cluster risk, deployer history." },
            { label: "Case intelligence", body: "OFAC / sanctions, Scam Sniffer, GoPlus, casefile claims, and the KOL registry — 370+ profiles, 220 with linked wallets." },
            { label: "Market data", body: "DexScreener real-time pricing and pump.fun launch detection." },
            { label: "Social intelligence", body: "Watcher V2 — 79 handles, captured automatically every 72 hours." },
          ].map((s) => (
            <div key={s.label} style={{ marginBottom: 12, background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "20px 24px" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#f9fafb", letterSpacing: "0.05em", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75 }}>{s.body}</div>
            </div>
          ))}
        </div>

        {/* ── B) HOW THE SCORE WORKS ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>HOW THE SCORE WORKS</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, marginBottom: 8 }}>TigerScore 0–100</h2>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.7, marginTop: 8, marginBottom: 16 }}>
            A single risk score — higher means higher observed risk. The architecture is published; the exact weights are not.
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
            {[
              { tier: "GREEN", range: "0 – 39", color: "#10b981", desc: "Lower observed risk." },
              { tier: "ORANGE", range: "40 – 69", color: "#f59e0b", desc: "Suspicious signals detected." },
              { tier: "RED", range: "70 – 100", color: "#ef4444", desc: "Critical risk — documented evidence." },
            ].map((t) => (
              <div
                key={t.tier}
                style={{
                  background: "#0f0f0f",
                  border: `1px solid ${t.color}44`,
                  borderLeft: `3px solid ${t.color}`,
                  borderRadius: 8,
                  padding: "16px 22px",
                  display: "flex",
                  gap: 20,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 80 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, color: t.color, letterSpacing: "0.15em", marginBottom: 4 }}>{t.tier}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: t.color, fontFamily: "monospace" }}>{t.range}</div>
                </div>
                <div style={{ fontSize: 13, color: "#d1d5db", fontWeight: 600 }}>{t.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#FF6B00", fontWeight: 700, fontStyle: "italic" }}>Architecture, not recipe.</div>
        </div>

        {/* ── C) WHAT MAKES US DIFFERENT ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>WHAT MAKES US DIFFERENT</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, marginBottom: 16 }}>Evidence, not opinion</h2>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
            {[
              "No wallet connection required.",
              "Evidence-based, not opinion-based.",
              "Every claim backed by on-chain data or a documented source.",
              "5 published casefiles — BOTIFY, RAVE, GHOST, VINE, SOLAXY.",
              "$17.6M in proceeds traced on-chain.",
              "484 wallets linked to 220 KOL profiles.",
              "Automated surveillance — Watcher V2, 79 handles.",
            ].map((line, i) => (
              <div
                key={line}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "11px 0",
                  borderTop: i === 0 ? "none" : "1px solid #161616",
                }}
              >
                <span style={{ color: "#FF6B00", fontWeight: 900, fontSize: 13, lineHeight: 1.6 }}>+</span>
                <span style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, fontWeight: 600 }}>{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── D) WHAT WE DON'T DO ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>WHAT WE DON&apos;T DO</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, marginBottom: 16 }}>Hard limits</h2>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
            {[
              "No financial advice.",
              "No absolute claims of guilt.",
              "No private data collection.",
              "No doxxing.",
              'We write "documented critical risk" — never "scammer" or "criminal".',
            ].map((line, i) => (
              <div
                key={line}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "11px 0",
                  borderTop: i === 0 ? "none" : "1px solid #161616",
                }}
              >
                <span style={{ color: "#6b7280", fontWeight: 900, fontSize: 13, lineHeight: 1.6 }}>—</span>
                <span style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── E) LINKS ── */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 16 }}>EXPLORE</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
            {[
              { label: "TigerScore Details", href: "/en/methodology/tigerscore" },
              { label: "KOL Risk Methodology", href: "/en/methodology/kol-risk" },
              { label: "Score Proof Graph", href: "/en/methodology/proof-graph" },
              { label: "Interactive Architecture", href: "/tigerscore-architecture.html" },
              { label: "KOL Data Doctrine", href: "/en/legal/kol-data-doctrine" },
            ].map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 4px",
                  borderTop: i === 0 ? "none" : "1px solid #161616",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontSize: 13, color: "#d1d5db", fontWeight: 700 }}>{l.label}</span>
                <span style={{ fontSize: 12, color: "#FF6B00", fontWeight: 700 }}>→</span>
              </a>
            ))}
          </div>
        </div>

        {/* ── EVIDENCE METHODOLOGY ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>EVIDENCE METHODOLOGY</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, marginBottom: 8 }}>How INTERLIGENS Calculates Financial Estimates</h2>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.7, marginTop: 8 }}>
            INTERLIGENS publishes estimated financial figures derived from publicly available blockchain data. These figures are analytical estimates — not established facts, not legal conclusions.
          </div>
        </div>

        {[
          {
            title: "Est. Investor Losses",
            body: "Represents the estimated aggregate value lost by retail market participants in documented rug-linked cases associated with this profile. Calculated as the approximate USD value of tokens purchased by non-insider wallets minus any recovered value, based on contemporaneous market pricing at the time of collapse. This is an estimate. Individual loss figures may vary significantly.",
          },
          {
            title: "Est. Proceeds",
            body: "Represents the estimated USD value received by insider-linked or promoter-linked wallets through pre-launch token allocation, sell activity, or attributed promotion compensation. Derived from observable on-chain transfer and swap transactions valued at contemporaneous market or LP price data.",
          },
          {
            title: "Pricing Reference",
            body: "Token prices are sourced from DexScreener, GeckoTerminal, or on-chain LP pricing at the time of the relevant transaction. Where multiple sources conflict, INTERLIGENS uses the closest available data point to the transaction timestamp. Pricing sources are documented in the underlying evidence record.",
          },
          {
            title: "Time Basis",
            body: "Financial calculations cover all available on-chain history for the wallet addresses and token contracts referenced. The time range is noted in the profile evidence record. Figures are not forward-looking and do not include unrealized positions unless explicitly stated.",
          },
          {
            title: "Inclusions and Exclusions",
            body: "Only wallets with documented on-chain linkage (verified or source-attributed) are included in financial calculations. Wallets classified as provisional or heuristically linked are excluded from primary figures and noted separately. DEX router addresses and liquidity pool contracts are excluded.",
          },
          {
            title: "Realized vs. Unrealized",
            body: "Unless stated otherwise, all estimated proceeds figures reflect realized transactions — observable sell events or token transfers with corresponding value flows. Unrealized positions are excluded from the primary figure and noted where material.",
          },
          {
            title: "Confidence and Revision",
            body: "All methodology-based estimates carry inherent uncertainty. INTERLIGENS reviews published figures when new on-chain evidence emerges or when a correction request provides supporting data. Revised figures are logged with version notes. The methodology is reviewed quarterly.",
          },
        ].map((s) => (
          <div key={s.title} style={{ marginBottom: 12, background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "20px 24px" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#f9fafb", letterSpacing: "0.05em", marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75 }}>{s.body}</div>
          </div>
        ))}

        {/* ── INTELLIGENCE METHODOLOGY ── */}
        <div style={{ marginTop: 48, marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>INTELLIGENCE METHODOLOGY</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, marginBottom: 8 }}>How INTERLIGENS Documents Crypto Influence Activity</h2>
        </div>

        {[
          {
            title: "What We Document",
            body: "INTERLIGENS aggregates publicly available on-chain activity, publicly archived social content, and documented links between crypto launches, influencer profiles, and financial flows. We do not assert criminal intent or legal liability. All published profiles meet a minimum evidence threshold before becoming publicly visible.",
          },
          {
            title: "Observed Proceeds",
            body: 'Figures labeled "Min. observed" represent on-chain cashout events identified across documented wallets. These are minimums — not total earnings, not net worth. Coverage is noted as partial when wallet attribution is incomplete. We use real historical pricing data to convert token amounts to USD equivalents at the time of transaction.',
          },
          {
            title: "Documented Wallets",
            body: "Wallets are associated with a profile when supported by verifiable public documentation — on-chain evidence, public statements, or reviewed source material. Attribution strength is noted: Confirmed, High, Medium. Wallets marked as under review are not publicly displayed.",
          },
          {
            title: "Related Actors & Coordination Signals",
            body: "When two or more published profiles share documented launches, case clusters, or recurring behavioral patterns, INTERLIGENS surfaces these overlaps as related actors or coordination signals. These reflect observed co-occurrence — not assertions of legal coordination or conspiracy.",
          },
          {
            title: "Published vs Internal",
            body: "Only profiles with published status are visible on public surfaces. Profiles under review, restricted, or in draft state are not exposed. Evidence items and snapshots follow the same gate.",
          },
          {
            title: "Data Limits",
            body: "Some data is partial. Wallet clusters may be incomplete. Proceeds figures are floors, not ceilings. Attribution confidence varies by profile. INTERLIGENS updates profiles as documentation improves. Nothing published here constitutes legal advice or a judicial finding.",
          },
          {
            title: "Voluntary Transparency",
            body: "Some actors choose to voluntarily submit their wallet addresses for public monitoring. These wallets are labeled self-submitted and are reviewed before public display. Voluntary disclosure does not constitute endorsement, certification, or an assessment of risk by INTERLIGENS. Submit wallets at /en/transparency.",
          },
        ].map((s) => (
          <div key={s.title} style={{ marginBottom: 12, background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "20px 24px" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#f9fafb", letterSpacing: "0.05em", marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75 }}>{s.body}</div>
          </div>
        ))}

        {/* Evidence Standard */}
        <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "20px 24px", marginBottom: 32, marginTop: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#374151", letterSpacing: "0.2em", marginBottom: 12 }}>EVIDENCE STANDARD</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            {[
              ["VERIFIED ON-CHAIN", "#10b981"],
              ["SOURCE-ATTRIBUTED", "#3b82f6"],
              ["ANALYTICAL ESTIMATE", "#f59e0b"],
              ["NOT A JUDICIAL FINDING", "#6b7280"],
            ].map(([label, color]) => (
              <span
                key={label}
                style={{
                  background: color + "15",
                  border: "1px solid " + color + "44",
                  color,
                  fontSize: 8,
                  fontWeight: 900,
                  padding: "3px 10px",
                  borderRadius: 4,
                  letterSpacing: "0.1em",
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

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
          <span>
            Questions about methodology: <span style={{ color: "#FF6B00" }}>admin@interligens.com</span>
            <br />INTERLIGENS Delaware C-Corp · Not legal advice · Not financial advice
          </span>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const }}>
            <a href="/en/correction" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Request a correction →</a>
            <a href="/en/methodology/tigerscore" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>TigerScore →</a>
            <a href="/en/methodology/kol-risk" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>KOL Risk →</a>
            <a href="/en/explorer" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Explorer →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
