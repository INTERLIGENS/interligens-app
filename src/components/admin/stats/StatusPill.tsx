"use client";

const ACCENT = "#FF6B00";

type StatusPillProps = {
  status: "healthy" | "warning" | "critical";
  label?: string;
};

export function StatusPill({ status, label }: StatusPillProps) {
  const displayLabel = label ?? status;
  if (status === "critical") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          fontWeight: 700,
          color: ACCENT,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          padding: "3px 10px",
          border: `1px solid ${ACCENT}`,
          borderRadius: 999,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: ACCENT,
          }}
        />
        {displayLabel}
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          fontWeight: 700,
          color: ACCENT,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          padding: "3px 10px",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: ACCENT,
          }}
        />
        {displayLabel}
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        fontWeight: 600,
        color: "#FFFFFF",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        padding: "3px 10px",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.3)",
        }}
      />
      {displayLabel}
    </span>
  );
}
