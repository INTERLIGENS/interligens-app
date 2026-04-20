"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type GraphSummary = {
  id: string;
  title: string;
  visibility: "PRIVATE" | "TEAM_POOL" | "PUBLIC";
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
};

const ACCENT = "#FF6B00";
const DIM = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";

export default function SavedGraphsSection() {
  const [graphs, setGraphs] = useState<GraphSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/investigators/graphs", {
          credentials: "same-origin",
        });
        if (!res.ok) {
          if (alive) setFailed(true);
          return;
        }
        const data = await res.json();
        if (alive) setGraphs(Array.isArray(data.graphs) ? data.graphs : []);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Hide the section entirely if the user is not authenticated as an
  // investigator yet — the landing page is also reachable from the logged-out
  // shell, and an unauth 401 shouldn't surface a red error there.
  if (failed) return null;

  // Loading: render a subtle skeleton so the landing doesn't jump.
  if (graphs === null) {
    return (
      <section style={{ marginTop: 48 }}>
        <SectionHeader />
        <div
          style={{
            border: `1px dashed ${LINE}`,
            borderRadius: 8,
            padding: 28,
            background: SURFACE,
            color: DIM,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          Loading your graphs…
        </div>
      </section>
    );
  }

  if (graphs.length === 0) {
    return (
      <section style={{ marginTop: 48 }}>
        <SectionHeader />
        <div
          style={{
            border: `1px dashed ${LINE}`,
            borderRadius: 8,
            padding: 32,
            background: SURFACE,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            No graphs yet
          </div>
          <div
            style={{
              fontSize: 12,
              color: DIM,
              marginTop: 6,
              lineHeight: 1.6,
              maxWidth: 360,
              margin: "6px auto 0",
            }}
          >
            Start a blank graph and map wallets, handles, and the edges between
            them. Everything is encrypted client-side before it reaches our
            servers.
          </div>
          <Link
            href="/investigators/box/graph/new"
            style={{
              display: "inline-block",
              marginTop: 18,
              backgroundColor: ACCENT,
              color: "#FFFFFF",
              height: 36,
              lineHeight: "36px",
              padding: "0 18px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Create one →
          </Link>
        </div>
      </section>
    );
  }

  const recent = graphs.slice(0, 6);

  return (
    <section style={{ marginTop: 48 }}>
      <SectionHeader
        cta={
          graphs.length > recent.length ? (
            <Link
              href="/investigators/box/graphs"
              style={{
                fontSize: 12,
                color: ACCENT,
                textDecoration: "none",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              See all {graphs.length} →
            </Link>
          ) : null
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {recent.map((g) => (
          <Link
            key={g.id}
            href={`/investigators/box/graphs/${g.id}`}
            style={{
              textDecoration: "none",
              color: "#FFFFFF",
              border: `1px solid ${LINE}`,
              borderRadius: 8,
              padding: 16,
              background: SURFACE,
              transition: "border-color 160ms ease, background 160ms ease",
            }}
            className="saved-graph-card"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  wordBreak: "break-word",
                }}
              >
                {g.title}
              </div>
              <span
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color:
                    g.visibility === "PUBLIC"
                      ? "#FFB800"
                      : g.visibility === "TEAM_POOL"
                      ? ACCENT
                      : DIM,
                }}
              >
                {g.visibility.replace("_", " ")}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: DIM,
                marginTop: 10,
              }}
            >
              {g.nodeCount} nodes · {g.edgeCount} edges ·{" "}
              {new Date(g.updatedAt).toLocaleDateString("en-US")}
            </div>
          </Link>
        ))}
      </div>
      <style>{`
        .saved-graph-card:hover {
          border-color: rgba(255,107,0,0.32);
          background-color: #0d0d0d;
        }
      `}</style>
    </section>
  );
}

function SectionHeader({ cta }: { cta?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase",
          }}
        >
          03 · My graphs
        </div>
        <div
          style={{
            color: "#FFFFFF",
            fontSize: 18,
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          Your saved constellations
        </div>
      </div>
      {cta}
    </div>
  );
}
