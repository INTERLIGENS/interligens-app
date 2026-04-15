"use client";

const ACCENT = "#FF6B00";

type MetricCardProps = {
  label: string;
  value: string | number | null;
  delta?: number | null;
  subtitle?: string;
};

function formatValue(v: string | number | null): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString();
  return v;
}

function formatDelta(delta: number | null | undefined): {
  label: string;
  color: string;
} | null {
  if (delta === undefined) return null;
  if (delta === null) return { label: "new", color: "rgba(255,255,255,0.4)" };
  if (delta === 0) return { label: "0%", color: "rgba(255,255,255,0.4)" };
  if (delta > 0) return { label: `+${delta}%`, color: "#7FE28C" };
  return { label: `${delta}%`, color: ACCENT };
}

export function MetricCard({ label, value, delta, subtitle }: MetricCardProps) {
  const d = formatDelta(delta);
  return (
    <div
      style={{
        background: "#0D0D0D",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 8,
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>
          {formatValue(value)}
        </div>
        {d && (
          <div style={{ fontSize: 12, color: d.color, fontWeight: 600 }}>{d.label}</div>
        )}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            marginTop: 6,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
