// ─── MmRiskBandBadge ──────────────────────────────────────────────────────
// Four-colour band indicator. Zero cyan. Reds for anything ORANGE/RED,
// amber for YELLOW, muted-green for GREEN (deliberately low-saturation so
// it does not read as "safe / normal" on a dark background).

import type { MmRiskBand } from "@prisma/client";

const PALETTE: Record<MmRiskBand, { bg: string; fg: string; label: string }> = {
  GREEN: { bg: "#14532D", fg: "#D1FAE5", label: "GREEN" },
  YELLOW: { bg: "#713F12", fg: "#FEF3C7", label: "YELLOW" },
  ORANGE: { bg: "#7C2D12", fg: "#FED7AA", label: "ORANGE" },
  RED: { bg: "#7F1D1D", fg: "#FECACA", label: "RED" },
};

export function MmRiskBandBadge({
  band,
  size = "sm",
}: {
  band: MmRiskBand;
  size?: "sm" | "md";
}) {
  const p = PALETTE[band];
  const padding = size === "md" ? "6px 14px" : "4px 12px";
  const fontSize = size === "md" ? 12 : 11;
  return (
    <span
      data-testid={`mm-band-badge-${band}`}
      style={{
        display: "inline-block",
        padding,
        fontSize,
        fontWeight: 900,
        letterSpacing: 3,
        textTransform: "uppercase",
        background: p.bg,
        color: p.fg,
        borderRadius: 2,
        lineHeight: 1,
      }}
    >
      {p.label}
    </span>
  );
}
