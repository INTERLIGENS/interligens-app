import Link from "next/link";
import SavedGraphsSection from "@/components/vault/SavedGraphsSection";

export const metadata = {
  title: "Graph — INTERLIGENS",
  robots: { index: false, follow: false },
};

const KICKER: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.12em",
  color: "rgba(255,255,255,0.4)",
};

const HEADLINE: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 700,
  color: "#FFFFFF",
  marginTop: 8,
  letterSpacing: "-0.01em",
};

const DEK: React.CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 14,
  lineHeight: 1.55,
  maxWidth: 560,
  marginTop: 14,
};

const CARD_BASE: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: 24,
  backgroundColor: "#0a0a0a",
  transition: "border-color 160ms ease, background 160ms ease",
};

const CARD_NUM: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: 11,
  letterSpacing: "0.12em",
  color: "rgba(255,255,255,0.3)",
  textTransform: "uppercase",
};

const CARD_TITLE: React.CSSProperties = {
  color: "#FFFFFF",
  fontSize: 20,
  fontWeight: 600,
  marginTop: 10,
};

const CARD_TEXT: React.CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 13,
  lineHeight: 1.5,
  marginTop: 8,
};

const CARD_CTA: React.CSSProperties = {
  marginTop: 18,
  color: "#FF6B00",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontWeight: 600,
};

/**
 * Landing for the investigator Graph section.
 *
 * Two clear paths:
 *   1. View demo graphs — the INTERLIGENS sample investigations we ship
 *      with the app. BOTIFY now lives behind this route so the nav item
 *      no longer dumps the user straight into demo data.
 *   2. Create your own graph — placeholder entry for the editor flow.
 *      The editor itself is pending a VaultNetworkGraph schema migration,
 *      so /graph/new currently explains what is coming.
 *
 * The module is branded "CONSTELLATION"; "Graph" is the investigator-
 * facing nav label. Style stays in the #000 / #FF6B00 / #FFFFFF system.
 */
export default function GraphLandingPage() {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#000", color: "#FFF" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "56px 24px 96px" }}>
        <div style={KICKER}>INVESTIGATORS · CONSTELLATION</div>
        <h1 style={HEADLINE}>Investigation Graph</h1>
        <p style={DEK}>
          Visualise wallets, tokens, and KOL relationships across a case.
          Explore the INTERLIGENS demo investigations to see what a finished
          dossier looks like, or start a blank graph to map your own case.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginTop: 40,
          }}
        >
          <Link href="/investigators/box/graph/demo" style={CARD_BASE} className="graph-landing-card">
            <div style={CARD_NUM}>01 · Demo</div>
            <div style={CARD_TITLE}>View demo graphs</div>
            <p style={CARD_TEXT}>
              Walk through published INTERLIGENS investigations rendered as
              interactive graphs. Every node and edge is sample data.
            </p>
            <div style={CARD_CTA}>Open demo &rarr;</div>
          </Link>

          <Link href="/investigators/box/graph/new" style={CARD_BASE} className="graph-landing-card">
            <div style={CARD_NUM}>02 · Create</div>
            <div style={CARD_TITLE}>Create your own graph</div>
            <p style={CARD_TEXT}>
              Start a blank graph and map wallets, tokens, handles, and
              evidence edges. Payloads are encrypted client-side.
            </p>
            <div style={CARD_CTA}>New graph &rarr;</div>
          </Link>

          <Link href="/investigators/box/graphs" style={CARD_BASE} className="graph-landing-card">
            <div style={CARD_NUM}>03 · My graphs</div>
            <div style={CARD_TITLE}>Open saved graphs</div>
            <p style={CARD_TEXT}>
              Reopen, rename, or promote any graph you&apos;ve saved. Team-pool
              shares and PUBLIC review flows live here.
            </p>
            <div style={CARD_CTA}>Browse &rarr;</div>
          </Link>
        </div>

        <SavedGraphsSection />
      </div>

      <style>{`
        .graph-landing-card:hover {
          border-color: rgba(255,107,0,0.32);
          background-color: #0d0d0d;
        }
      `}</style>
    </main>
  );
}
