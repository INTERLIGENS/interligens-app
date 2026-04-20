import Link from "next/link";

export const metadata = {
  title: "Integrations — INTERLIGENS",
  description:
    "Demo integrations: how INTERLIGENS TigerScore gates common DEX / frontend flows.",
};

/**
 * Integrations hub. Lists the one-click demo cards for each partner DEX /
 * wallet UI where a TigerScore gate can be wired ahead of a user action.
 *
 * Today: Jupiter only. Add new entries to the `CARDS` array as demos
 * land; each entry ships its own `/integrations/<slug>` route.
 */

const ACCENT = "#FF6B00";
const MUTED = "rgba(255,255,255,0.55)";

interface Card {
  slug: string;
  title: string;
  chain: string;
  summary: string;
  status: "demo" | "coming_soon";
}

const CARDS: Card[] = [
  {
    slug: "jupiter",
    title: "Jupiter",
    chain: "SOL",
    summary:
      "Swap simulator: enter a token mint, INTERLIGENS scores it before you even compose the swap. RED → overlay alert, ORANGE → caution banner, GREEN → checkmark.",
    status: "demo",
  },
];

export default function IntegrationsHub() {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#000", color: "#FFF" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "64px 24px 96px" }}>
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.14em",
            color: MUTED,
          }}
        >
          INTEGRATIONS · DEMO
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 700, marginTop: 8, letterSpacing: "-0.01em" }}>
          Score before you sign.
        </h1>
        <p
          style={{
            color: MUTED,
            fontSize: 15,
            lineHeight: 1.55,
            marginTop: 14,
            maxWidth: 620,
          }}
        >
          Demos of INTERLIGENS TigerScore wired into the UX flow of common DEXs
          and wallet frontends. Each card below is a live interactive sample —
          not a real swap. Every scan points at the same public{" "}
          <code style={{ color: ACCENT }}>/api/v1/score</code> endpoint retail uses.
        </p>

        <div
          style={{
            marginTop: 44,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {CARDS.map((c) =>
            c.status === "demo" ? (
              <Link
                key={c.slug}
                href={`/en/integrations/${c.slug}`}
                className="integration-card"
                style={cardBase}
              >
                <Kicker>{c.chain}</Kicker>
                <div style={cardTitle}>{c.title}</div>
                <p style={cardText}>{c.summary}</p>
                <div style={cta}>Open demo &rarr;</div>
              </Link>
            ) : (
              <div key={c.slug} style={{ ...cardBase, opacity: 0.6, cursor: "not-allowed" }}>
                <Kicker>{c.chain}</Kicker>
                <div style={cardTitle}>{c.title}</div>
                <p style={cardText}>{c.summary}</p>
                <div style={{ ...cta, color: MUTED }}>Coming soon</div>
              </div>
            ),
          )}
        </div>
      </div>

      <style>{`
        .integration-card:hover {
          border-color: rgba(255,107,0,0.32) !important;
          background-color: #0d0d0d !important;
        }
      `}</style>
    </main>
  );
}

// ── inline styles ────────────────────────────────────────────────────

const cardBase: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: 22,
  backgroundColor: "#0a0a0a",
  transition: "border-color 160ms ease, background-color 160ms ease",
};

const cardTitle: React.CSSProperties = {
  color: "#FFFFFF",
  fontSize: 22,
  fontWeight: 600,
  marginTop: 10,
};

const cardText: React.CSSProperties = {
  color: MUTED,
  fontSize: 13,
  lineHeight: 1.5,
  marginTop: 10,
};

const cta: React.CSSProperties = {
  marginTop: 18,
  color: ACCENT,
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontWeight: 600,
};

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "inline-block",
        padding: "2px 8px",
        background: "rgba(255,107,0,0.12)",
        border: "1px solid rgba(255,107,0,0.28)",
        borderRadius: 3,
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "#FF6B00",
      }}
    >
      {children}
    </div>
  );
}
