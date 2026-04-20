import Link from "next/link";

export const metadata = {
  title: "Demo graphs — INTERLIGENS",
  robots: { index: false, follow: false },
};

const DEMOS: Array<{
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
}> = [
  {
    slug: "botify",
    title: "BOTIFY",
    subtitle: "Token-rug investigation",
    summary:
      "Cross-chain lifecycle of a coordinated KOL-led rug: launch wallets, exit routes, and the two KOL clusters that promoted it.",
  },
];

const KICKER: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.12em",
  color: "rgba(255,255,255,0.4)",
};

const HEADLINE: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: "#FFFFFF",
  marginTop: 8,
  letterSpacing: "-0.01em",
};

const BREADCRUMB: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.35)",
  marginBottom: 16,
};

const BREADCRUMB_LINK: React.CSSProperties = {
  color: "rgba(255,255,255,0.35)",
  textDecoration: "none",
  transition: "color 150ms",
};

const ROW: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: 20,
  backgroundColor: "#0a0a0a",
  transition: "border-color 160ms ease, background 160ms ease",
};

const ROW_TITLE: React.CSSProperties = {
  color: "#FFFFFF",
  fontSize: 18,
  fontWeight: 600,
};

const ROW_SUB: React.CSSProperties = {
  color: "#FF6B00",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginTop: 4,
};

const ROW_TEXT: React.CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 13,
  lineHeight: 1.5,
  marginTop: 10,
};

const DEMO_TAG: React.CSSProperties = {
  display: "inline-block",
  marginTop: 10,
  padding: "2px 8px",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.6)",
  backgroundColor: "rgba(255,107,0,0.12)",
  border: "1px solid rgba(255,107,0,0.28)",
  borderRadius: 3,
};

export default function DemoGraphsIndex() {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#000", color: "#FFF" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(32px, 5vw, 56px) clamp(24px, 5vw, 64px) clamp(48px, 8vw, 96px)" }}>
        <div style={BREADCRUMB}>
          <Link href="/investigators/box/graph" style={BREADCRUMB_LINK} className="graph-crumb-link">
            Graph
          </Link>{" "}
          <span style={{ color: "rgba(255,255,255,0.15)" }}>/</span>{" "}
          Demo
        </div>
        <div style={KICKER}>INTERLIGENS · SAMPLE INVESTIGATIONS</div>
        <h1 style={HEADLINE}>Demo graphs</h1>
        <p
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 14,
            lineHeight: 1.55,
            maxWidth: 580,
            marginTop: 12,
          }}
        >
          These are published INTERLIGENS investigations rendered with the
          premium Constellation view. Every node, edge, and amount shown is
          sample data — no investigator case is exposed.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 36 }}>
          {DEMOS.map((d) => (
            <Link
              key={d.slug}
              href={`/investigators/box/graph/demo/${d.slug}`}
              style={ROW}
              className="graph-demo-row"
            >
              <div style={ROW_TITLE}>{d.title}</div>
              <div style={ROW_SUB}>{d.subtitle}</div>
              <p style={ROW_TEXT}>{d.summary}</p>
              <div style={DEMO_TAG}>Demo dataset</div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .graph-crumb-link:hover { color: #FFFFFF; }
        .graph-demo-row:hover {
          border-color: rgba(255,107,0,0.32);
          background-color: #0d0d0d;
        }
      `}</style>
    </main>
  );
}
