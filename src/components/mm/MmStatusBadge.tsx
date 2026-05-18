// ─── MmStatusBadge ────────────────────────────────────────────────────────
// Small inline pill showing an entity's procedural status. Colour mapping
// follows the editorial severity order — darker red for convictions, lighter
// yellow for passive mentions.

import type { MmStatus } from "@/lib/mm/types";

const PALETTE: Record<
  MmStatus,
  { bg: string; border: string; fg: string; label: string }
> = {
  CONVICTED: {
    bg: "rgba(239, 68, 68, 0.15)",
    border: "#B91C1C",
    fg: "#FCA5A5",
    label: "CONDAMNÉ",
  },
  CHARGED: {
    bg: "rgba(239, 68, 68, 0.08)",
    border: "#DC2626",
    fg: "#F87171",
    label: "INCULPÉ",
  },
  SETTLED: {
    bg: "rgba(249, 115, 22, 0.12)",
    border: "#EA580C",
    fg: "#FDBA74",
    label: "RÈGLEMENT",
  },
  INVESTIGATED: {
    bg: "rgba(234, 179, 8, 0.10)",
    border: "#CA8A04",
    fg: "#FDE68A",
    label: "SOUS ENQUÊTE",
  },
  DOCUMENTED: {
    bg: "rgba(249, 115, 22, 0.08)",
    border: "#C2410C",
    fg: "#FED7AA",
    label: "DOCUMENTÉ",
  },
  OBSERVED: {
    bg: "rgba(234, 179, 8, 0.05)",
    border: "#A16207",
    fg: "#FEF3C7",
    label: "OBSERVÉ",
  },
};

export function MmStatusBadge({
  status,
  size = "sm",
}: {
  status: MmStatus;
  size?: "sm" | "md";
}) {
  const p = PALETTE[status];
  const padding = size === "md" ? "6px 12px" : "4px 10px";
  const fontSize = size === "md" ? 12 : 11;
  return (
    <span
      data-testid={`mm-status-badge-${status}`}
      style={{
        display: "inline-block",
        padding,
        fontSize,
        fontWeight: 900,
        letterSpacing: 2,
        textTransform: "uppercase",
        background: p.bg,
        border: `1px solid ${p.border}`,
        color: p.fg,
        borderRadius: 2,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {p.label}
    </span>
  );
}
