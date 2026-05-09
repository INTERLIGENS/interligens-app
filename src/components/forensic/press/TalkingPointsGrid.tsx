/**
 * TalkingPointsGrid — six-cell variant of the SystemLayers grammar.
 *
 * Same kicker / Gambarino title / dim body cell as /about §03, sized
 * for talking-point density. Wraps fluidly so the desktop layout is
 * 3 × 2 and the mobile layout collapses to a single column.
 */

import type { TalkingPoint } from "@/lib/mocks/press";

export function TalkingPointsGrid({ points }: { points: TalkingPoint[] }) {
  return (
    <section
      aria-label="On-the-record talking points"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        borderTop: "1px solid var(--rule)",
        borderLeft: "1px solid var(--rule)",
        background: "var(--ink)",
      }}
    >
      {points.map((p) => (
        <article
          key={p.num}
          style={{
            borderRight: "1px solid var(--rule)",
            borderBottom: "1px solid var(--rule)",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
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
            <span style={{ color: "var(--bone-dim)" }}>{p.num} ·</span>{" "}
            {p.kicker}
          </div>
          <h3
            style={{
              fontFamily:
                "var(--font-display, 'Gambarino'), 'General Sans', serif",
              fontSize: 22,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              color: "var(--bone)",
              margin: 0,
            }}
          >
            {p.title}
          </h3>
          <p
            style={{
              fontFamily:
                "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--bone-soft)",
              margin: 0,
            }}
          >
            {p.body}
          </p>
        </article>
      ))}
    </section>
  );
}
