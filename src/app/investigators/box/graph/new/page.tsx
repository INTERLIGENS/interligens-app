import Link from "next/link";

export const metadata = {
  title: "New graph — INTERLIGENS",
  robots: { index: false, follow: false },
};

/**
 * Entry point for creating a new investigator graph.
 *
 * The full editor (EditableGraph, AUTO-populate, vault-encrypted persistence)
 * ships behind the VaultNetworkGraph Prisma model, which is not yet migrated
 * to prod. Until that migration lands, this page explains what is coming so
 * the landing's "Create your own graph" CTA is reachable and honest instead
 * of a dead link.
 */
export default function NewGraphPage() {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#000", color: "#FFF" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "72px 24px 96px" }}>
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <Link
            href="/investigators/box/graph"
            style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}
            className="graph-crumb-link"
          >
            Graph
          </Link>{" "}
          <span style={{ color: "rgba(255,255,255,0.15)" }}>/</span> New
        </div>

        <h1
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: "#FFFFFF",
            marginTop: 10,
            letterSpacing: "-0.01em",
          }}
        >
          Create your own graph
        </h1>

        <p
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 14,
            lineHeight: 1.6,
            marginTop: 16,
          }}
        >
          The editor is shipping next. It lets you start a blank graph tied to
          one of your cases, drop in wallets, tokens, KOL handles, and evidence
          edges, and persist everything under the investigator vault. While the
          underlying storage migration completes, new graphs cannot be saved yet.
        </p>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 6,
            border: "1px solid rgba(255,107,0,0.24)",
            background: "rgba(255,107,0,0.06)",
            color: "rgba(255,255,255,0.8)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "#FF6B00" }}>Tip —</strong> want to see the
          interactive graph style before the editor lands? Open a{" "}
          <Link
            href="/investigators/box/graph/demo"
            style={{
              color: "#FF6B00",
              textDecoration: "none",
              borderBottom: "1px solid rgba(255,107,0,0.4)",
            }}
          >
            demo graph
          </Link>{" "}
          — the same canvas the editor will render.
        </div>
      </div>

      <style>{`
        .graph-crumb-link:hover { color: #FFFFFF; }
      `}</style>
    </main>
  );
}
