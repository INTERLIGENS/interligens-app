// ─── MmScoreDisplay ───────────────────────────────────────────────────────
// Circle-framed score with optional disclaimer beneath. Colour follows the
// risk band (spec §8.3). The disclaimer is rendered in muted text and kept
// separate so callers can skip it in compact layouts.

import type { MmRiskBand } from "@prisma/client";

const RING_COLOR: Record<MmRiskBand, string> = {
  GREEN: "#22C55E",
  YELLOW: "#EAB308",
  ORANGE: "#F97316",
  RED: "#EF4444",
};

export function MmScoreDisplay({
  score,
  band,
  disclaimer,
  size = 120,
}: {
  score: number;
  band: MmRiskBand;
  disclaimer?: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const ring = RING_COLOR[band];

  return (
    <div data-testid="mm-score-display" style={{ display: "inline-block" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `4px solid ${ring}`,
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          boxShadow: `0 0 24px ${ring}33`,
        }}
      >
        <div
          style={{
            fontSize: size * 0.35,
            fontWeight: 900,
            color: "#FFFFFF",
            letterSpacing: 2,
            lineHeight: 1,
          }}
        >
          {clamped}
        </div>
        <div
          style={{
            fontSize: 10,
            color: ring,
            letterSpacing: 2,
            fontWeight: 900,
            marginTop: 4,
            textTransform: "uppercase",
          }}
        >
          {band}
        </div>
      </div>
      {disclaimer ? (
        <div
          style={{
            marginTop: 14,
            color: "#999999",
            fontSize: 12,
            lineHeight: 1.5,
            maxWidth: 320,
          }}
        >
          {disclaimer}
        </div>
      ) : null}
    </div>
  );
}
