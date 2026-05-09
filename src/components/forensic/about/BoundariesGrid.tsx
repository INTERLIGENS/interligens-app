/**
 * BoundariesGrid — explicit do / do-not list, two columns.
 *
 * Used on /about §06. Visually distinct from ReaderSplit (which is a
 * comparative reader-perspective block) because boundaries declare scope
 * — a stronger, more declarative grammar. Left column is faintly
 * accented signal-orange (positive scope); right column is faintly
 * accented bone-dim (negative scope). No risk-red used here, the page
 * is editorial, not alarmist.
 */

import type { AboutColumn } from "@/lib/mocks/about";

export function BoundariesGrid({
  doColumn,
  dontColumn,
}: {
  doColumn: AboutColumn;
  dontColumn: AboutColumn;
}) {
  return (
    <section
      aria-label="What INTERLIGENS does and does not do"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        border: "1px solid var(--rule)",
        background: "var(--ink)",
      }}
    >
      <BoundaryColumn column={doColumn} side="do" />
      <BoundaryColumn column={dontColumn} side="dont" />
    </section>
  );
}

function BoundaryColumn({
  column,
  side,
}: {
  column: AboutColumn;
  side: "do" | "dont";
}) {
  const accent = side === "do" ? "var(--signal)" : "var(--bone-dim)";
  return (
    <div
      style={{
        padding: "32px 28px",
        borderRight:
          side === "do" ? "1px solid var(--rule)" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily:
            "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {column.kicker}
      </div>
      <h3
        style={{
          fontFamily:
            "var(--font-display, 'Gambarino'), 'General Sans', serif",
          fontSize: 22,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
          color: "var(--bone)",
          margin: 0,
        }}
      >
        {column.title}
      </h3>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {column.lines.map((l, i) => (
          <li
            key={i}
            style={{
              paddingLeft: 18,
              position: "relative",
              fontFamily:
                "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--bone-soft)",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: "0.55em",
                width: 8,
                height: 1,
                background: accent,
              }}
            />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
