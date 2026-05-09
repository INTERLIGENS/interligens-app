/**
 * ReaderSplit — two-column comparison of retail vs investigator reading.
 *
 * Used on /about §05. Both columns share the same grammar (mono kicker,
 * Gambarino title, bullet list); the asymmetry sits in the content, not
 * in the styling. A unifying note rendered below both columns explains
 * that the retail surface is not a degraded version of the deep read.
 */

import type { AboutColumn } from "@/lib/mocks/about";

export function ReaderSplit({
  left,
  right,
  note,
}: {
  left: AboutColumn;
  right: AboutColumn;
  note?: string;
}) {
  return (
    <section
      aria-label="Retail and investigator reading"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 0,
          border: "1px solid var(--rule)",
          background: "var(--ink-raised)",
        }}
      >
        <ReaderColumn column={left} side="left" />
        <ReaderColumn column={right} side="right" />
      </div>
      {note && (
        <p
          style={{
            margin: 0,
            fontFamily:
              "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--bone-dim)",
            maxWidth: 760,
          }}
        >
          {note}
        </p>
      )}
    </section>
  );
}

function ReaderColumn({
  column,
  side,
}: {
  column: AboutColumn;
  side: "left" | "right";
}) {
  return (
    <div
      style={{
        padding: "32px 28px",
        borderRight:
          side === "left" ? "1px solid var(--rule)" : undefined,
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
          color: "var(--signal)",
        }}
      >
        {column.kicker}
      </div>
      <h3
        style={{
          fontFamily:
            "var(--font-display, 'Gambarino'), 'General Sans', serif",
          fontSize: 26,
          lineHeight: 1.2,
          letterSpacing: "-0.015em",
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
                background: "var(--signal)",
              }}
            />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
