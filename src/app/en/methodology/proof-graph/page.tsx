import BetaNav from "@/components/beta/BetaNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Score Proof Graph — INTERLIGENS",
  description:
    "The architecture behind every TigerScore: on-chain signals, case intelligence, and market & social inputs. Architecture, not recipe — proportions shown, weights withheld.",
  openGraph: {
    title: "Score Proof Graph — INTERLIGENS",
    description:
      "How the TigerScore is built — on-chain signals, case intelligence, market & social. Architecture, not recipe.",
  },
};

type NodeStatus = "LIVE" | "PARTIAL" | "PLANNED";

const STATUS_STYLE: Record<NodeStatus, { color: string; label: string }> = {
  LIVE: { color: "#00FF94", label: "LIVE" },
  PARTIAL: { color: "#FFB800", label: "PARTIAL" },
  PLANNED: { color: "#6b7280", label: "PLANNED" },
};

// `share` drives the proportional bar width only — the numeric weight is
// never rendered. Architecture, not recipe.
const BRANCHES: {
  name: string;
  caption: string;
  share: number;
  children: { name: string; status: NodeStatus }[];
}[] = [
  {
    name: "On-chain Signals",
    caption: "What the blockchain itself shows about the token.",
    share: 100,
    children: [
      { name: "Holder Concentration", status: "LIVE" },
      { name: "Liquidity Analysis", status: "LIVE" },
      { name: "Token Age", status: "LIVE" },
      { name: "Volume Analysis", status: "LIVE" },
      { name: "Cluster Risk", status: "PARTIAL" },
    ],
  },
  {
    name: "Case Intelligence",
    caption: "Documented evidence and third-party security sources.",
    share: 86,
    children: [
      { name: "OFAC / Sanctions", status: "LIVE" },
      { name: "Scam Sniffer", status: "LIVE" },
      { name: "GoPlus", status: "LIVE" },
      { name: "Casefile Claims", status: "LIVE" },
      { name: "KOL Registry", status: "LIVE" },
    ],
  },
  {
    name: "Market & Social",
    caption: "Trading venue context and social-distribution signals.",
    share: 62,
    children: [
      { name: "DexScreener Data", status: "LIVE" },
      { name: "Pump.fun Detection", status: "LIVE" },
      { name: "Community Signals", status: "PLANNED" },
    ],
  },
];

function StatusBadge({ status }: { status: NodeStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      style={{
        background: s.color + "15",
        border: "1px solid " + s.color + "44",
        color: s.color,
        fontSize: 8,
        fontWeight: 900,
        padding: "3px 9px",
        borderRadius: 4,
        letterSpacing: "0.12em",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export default function ProofGraphPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>PROOF GRAPH</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", margin: 0, marginBottom: 16 }}>
            How the TigerScore is built
          </h1>
          <div style={{ fontSize: 14, color: "#d1d5db", lineHeight: 1.7 }}>
            Every TigerScore is assembled from three layers of evidence. The graph below shows the architecture — which inputs feed the score and how much each layer contributes, relative to the others.
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#9ca3af", lineHeight: 1.7 }}>
            Bars are proportional, not numeric. Exact weights, thresholds, and detector internals stay proprietary. <span style={{ color: "#FF6B00", fontWeight: 700 }}>Architecture, not recipe.</span>
          </div>
        </div>

        {/* ── ROOT NODE ── */}
        <div style={{ background: "#0f0f0f", border: "1px solid #FF6B00", borderRadius: 10, padding: "20px 24px", marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 6 }}>ROOT</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#f9fafb" }}>TIGERSCORE · 0–100</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>A single risk score, composed from the three branches below.</div>
        </div>

        {/* connector */}
        <div style={{ width: 1, height: 24, background: "#1f2937", margin: "0 auto" }} />

        {/* ── BRANCHES ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {BRANCHES.map((b) => (
            <div key={b.name} style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 10, padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" as const }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#f9fafb" }}>{b.name}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{b.caption}</div>
              </div>

              {/* proportional bar — no numeric weight */}
              <div style={{ marginTop: 12, marginBottom: 18, height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: b.share + "%", height: "100%", background: "#FF6B00", borderRadius: 4 }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {b.children.map((c, i) => (
                  <div
                    key={c.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "9px 0",
                      borderTop: i === 0 ? "none" : "1px solid #161616",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "#374151", fontFamily: "monospace", fontSize: 13 }}>
                        {i === b.children.length - 1 ? "└─" : "├─"}
                      </span>
                      <span style={{ fontSize: 13, color: "#d1d5db", fontWeight: 600 }}>{c.name}</span>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── LEGEND ── */}
        <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "18px 24px", marginTop: 28 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#374151", letterSpacing: "0.2em", marginBottom: 12 }}>STATUS LEGEND</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" as const }}>
            {([
              ["LIVE", "In production — actively scored."],
              ["PARTIAL", "Partially implemented — limited coverage."],
              ["PLANNED", "Not yet implemented — on the roadmap."],
            ] as [NodeStatus, string][]).map(([status, desc]) => (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusBadge status={status} />
                <span style={{ fontSize: 11, color: "#6b7280" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            borderTop: "1px solid #111827",
            marginTop: 32,
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
            Architecture, not recipe. Internal weights remain proprietary.
            <br />INTERLIGENS Delaware C-Corp · Not legal advice · Not financial advice
          </span>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const }}>
            <a href="/en/methodology" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>← Methodology</a>
            <a href="/en/methodology/tigerscore" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>TigerScore →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
