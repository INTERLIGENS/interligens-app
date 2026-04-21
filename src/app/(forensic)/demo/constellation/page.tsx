"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  ClassificationBar,
  Masthead,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import NodePopover from "@/components/forensic/constellation/NodePopover";
import {
  DEMO_01_GRAPH,
  DEMO_01_SNAPSHOT,
  type DemoConstellationNode,
} from "@/lib/mocks/constellation-demo-01";

// three.js + react-force-graph-3d are heavy and only meaningful client-
// side. Dynamic import keeps them out of the page bundle until this
// route is hit.
const ConstellationCanvas3D = dynamic(
  () => import("@/components/forensic/constellation/ConstellationCanvas3D"),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-live="polite"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--bone-dim)",
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Initialising constellation…
      </div>
    ),
  },
);

export default function DemoConstellationPage() {
  const [selected, setSelected] = useState<DemoConstellationNode | null>(null);
  const [autopilot, setAutopilot] = useState(true);

  return (
    <>
      <ClassificationBar
        ctx={DEMO_01_SNAPSHOT.classification}
        statusLabel="DEMO · CONSTELLATION · SYNTHETIC"
      />
      <Masthead active="/constellation" />

      <main>
        <a
          href="#constellation-canvas"
          className="fx-skip-link"
          style={{
            position: "absolute",
            left: -9999,
            top: "auto",
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
          onFocus={(e) => {
            Object.assign(e.currentTarget.style, {
              left: 16,
              top: 16,
              width: "auto",
              height: "auto",
              padding: "10px 14px",
              background: "var(--ink-raised)",
              color: "var(--bone)",
              borderRadius: 6,
              fontSize: 12,
              zIndex: 100,
            });
          }}
          onBlur={(e) => {
            Object.assign(e.currentTarget.style, {
              left: -9999,
              width: 1,
              height: 1,
            });
          }}
        >
          Skip to constellation
        </a>

        <div className="fx-container">
          <section
            style={{
              padding: "64px 0 32px",
              borderBottom: "1px solid var(--rule)",
            }}
          >
            <div
              style={{
                fontFamily:
                  "var(--font-jetbrains-mono), ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--bone-dim)",
                marginBottom: 16,
              }}
            >
              Module 02 · Constellation · 3D preview
            </div>
            <h1
              style={{
                fontFamily:
                  "Gambarino, 'General Sans', var(--font-inter), serif",
                fontSize: "clamp(40px, 6vw, 72px)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: "var(--bone)",
                margin: 0,
                maxWidth: 820,
              }}
            >
              One wallet doesn&apos;t tell you anything.{" "}
              <span style={{ fontStyle: "italic", color: "var(--signal)" }}>
                A graph does.
              </span>
            </h1>
          </section>
        </div>

        <section
          id="constellation-canvas"
          style={{
            position: "relative",
            width: "100%",
            background: "var(--ink)",
            borderBottom: "1px solid var(--rule)",
          }}
        >
          <style>{`
            .constellation-3d-shell { height: 420px; }
            @media (min-width: 768px) { .constellation-3d-shell { height: 680px; } }
          `}</style>
          <div className="constellation-3d-shell">
            <ConstellationCanvas3D
              graph={DEMO_01_GRAPH as typeof DEMO_01_GRAPH & { nodes: DemoConstellationNode[] }}
              onNodeClick={(node) => setSelected(node)}
              autopilotOverrideCallback={setAutopilot}
            />
            <NodePopover node={selected} onClose={() => setSelected(null)} />
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "10px 24px",
              background: "rgba(0, 0, 0, 0.72)",
              borderTop: "1px solid var(--rule)",
              fontFamily:
                "var(--font-jetbrains-mono), ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--bone-dim)",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>Synthetic dataset · 45 nodes · case demo-01</span>
            <span style={{ color: autopilot ? "var(--signal)" : "var(--bone)" }}>
              {autopilot ? "AUTOPILOT" : "MANUAL"}
            </span>
          </div>
        </section>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
