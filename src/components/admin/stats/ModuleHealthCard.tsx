"use client";

import { StatusPill } from "./StatusPill";

const ACCENT = "#FF6B00";

type ModuleHealthCardProps = {
  name: string;
  status: "healthy" | "warning" | "critical";
  primary: { label: string; value: string | number };
  secondary?: { label: string; value: string | number };
  delta?: number | null;
};

function formatDelta(delta: number | null | undefined): string | null {
  if (delta === undefined || delta === null) return null;
  if (delta === 0) return "0%";
  if (delta > 0) return `+${delta}%`;
  return `${delta}%`;
}

export function ModuleHealthCard({
  name,
  status,
  primary,
  secondary,
  delta,
}: ModuleHealthCardProps) {
  const deltaLabel = formatDelta(delta);
  return (
    <div
      style={{
        background: "#0D0D0D",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#FFFFFF",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {name}
        </div>
        <StatusPill status={status} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>
          {typeof primary.value === "number" ? primary.value.toLocaleString() : primary.value}
        </div>
        {deltaLabel && (
          <div
            style={{
              fontSize: 11,
              color:
                deltaLabel.startsWith("+")
                  ? "#7FE28C"
                  : deltaLabel.startsWith("-")
                  ? ACCENT
                  : "rgba(255,255,255,0.4)",
              fontWeight: 600,
            }}
          >
            {deltaLabel}
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 3,
        }}
      >
        {primary.label}
      </div>
      {secondary && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <span>{secondary.label}</span>
          <span style={{ color: "#FFFFFF", fontWeight: 600 }}>
            {typeof secondary.value === "number"
              ? secondary.value.toLocaleString()
              : secondary.value}
          </span>
        </div>
      )}
    </div>
  );
}
