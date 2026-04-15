"use client";

const ACCENT = "#FF6B00";

type AlertRowProps = {
  severity: "critical" | "warning" | "low";
  title: string;
  context: string;
  action: string;
};

function severityBadge(severity: AlertRowProps["severity"]) {
  if (severity === "critical") {
    return {
      label: "CRITICAL",
      bg: "rgba(165,28,28,0.18)",
      color: "#FF6B6B",
      border: "1px solid rgba(255,107,107,0.35)",
    };
  }
  if (severity === "warning") {
    return {
      label: "WARNING",
      bg: "rgba(255,107,0,0.12)",
      color: ACCENT,
      border: "1px solid rgba(255,107,0,0.35)",
    };
  }
  return {
    label: "LOW",
    bg: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.08)",
  };
}

export function AlertRow({ severity, title, context, action }: AlertRowProps) {
  const b = severityBadge(severity);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: "3px 9px",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: b.color,
          background: b.bg,
          border: b.border,
          borderRadius: 4,
          flexShrink: 0,
          minWidth: 72,
          textAlign: "center",
        }}
      >
        {b.label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600 }}>{title}</div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            marginTop: 3,
          }}
        >
          {context}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            fontStyle: "italic",
            marginTop: 4,
          }}
        >
          → {action}
        </div>
      </div>
    </div>
  );
}
