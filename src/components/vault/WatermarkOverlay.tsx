/**
 * WatermarkOverlay — full-screen diagonal confidentiality watermark.
 *
 * CSS-only, never blocks clicks (pointer-events: none), never selectable
 * (user-select: none). Renders a tiled SVG background with the investigator
 * handle + current date rotated -30deg, alpha 0.025 so it's barely visible on
 * screen but survives screenshots. Not mounted on print pages or public
 * shared pages.
 */

import React from "react";

interface Props {
  handle: string;
}

function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function WatermarkOverlay({ handle }: Props) {
  const clean = handle.replace(/^@+/, "").replace(/[<>&"]/g, "");
  const stamp = `@${clean} · CONFIDENTIEL · ${formatDate(new Date())}`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="180" viewBox="0 0 420 180">
  <g transform="rotate(-30 210 90)">
    <text x="0" y="90" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="13" fill="rgba(255,255,255,0.025)" letter-spacing="0.05em">${stamp}</text>
  </g>
</svg>`.trim();

  const dataUri = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

  return (
    <>
      <style>{`@media print { .vault-watermark-overlay { display: none !important; } }`}</style>
      <div
        aria-hidden
        className="vault-watermark-overlay"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 999,
          overflow: "hidden",
          backgroundImage: dataUri,
          backgroundRepeat: "repeat",
        }}
      />
    </>
  );
}
