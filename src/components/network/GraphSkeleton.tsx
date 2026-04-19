"use client";

import { CHROME } from "@/styles/graph-tokens";

// Loading skeleton for the three-column graph layout. Mirrors the grid
// geometry of ScamUniverseGraph / EditableGraph so the page doesn't reflow
// when the real graph lands.
export default function GraphSkeleton() {
  return (
    <>
      <style>{SKELETON_CSS}</style>
      <div className="graph-skeleton">
        <aside className="graph-skeleton-panel">
          <div className="graph-skeleton-bar" style={{ width: "55%", height: 16 }} />
          <div className="graph-skeleton-bar" style={{ width: "80%", height: 8, marginTop: 6 }} />
          <div className="graph-skeleton-bar" style={{ width: "100%", height: 32, marginTop: 16 }} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="graph-skeleton-bar"
              style={{ width: "100%", height: 20, marginTop: 8 }}
            />
          ))}
        </aside>

        <main className="graph-skeleton-canvas">
          <div className="graph-skeleton-canvas-label">Loading graph…</div>
        </main>

        <aside className="graph-skeleton-panel">
          <div className="graph-skeleton-bar" style={{ width: "60%", height: 12 }} />
          <div className="graph-skeleton-bar" style={{ width: "100%", height: 32, marginTop: 16 }} />
          <div className="graph-skeleton-bar" style={{ width: "90%", height: 20, marginTop: 8 }} />
          <div className="graph-skeleton-bar" style={{ width: "75%", height: 20, marginTop: 8 }} />
        </aside>
      </div>
    </>
  );
}

const SKELETON_CSS = `
.graph-skeleton {
  display: grid;
  grid-template-columns: 240px 1fr 320px;
  gap: 12px;
  padding: 12px;
  height: calc(100vh - 48px);
  background: ${CHROME.bg};
  color: ${CHROME.textPrimary};
}
.graph-skeleton-panel {
  background: ${CHROME.panel};
  border: 1px solid ${CHROME.border};
  border-radius: 6px;
  padding: 12px;
  overflow: hidden;
}
.graph-skeleton-canvas {
  position: relative;
  background: radial-gradient(ellipse at center, #0a0a0a 0%, #000 100%);
  border: 1px solid ${CHROME.border};
  border-radius: 6px;
  box-shadow: 0 0 20px rgba(0,0,0,0.6) inset;
  overflow: hidden;
}
.graph-skeleton-canvas-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  color: ${CHROME.textMuted};
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.graph-skeleton-bar {
  background: rgba(255,255,255,0.04);
  border-radius: 3px;
  animation: graph-skel-pulse 1.4s ease-in-out infinite;
}
@keyframes graph-skel-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
`;
