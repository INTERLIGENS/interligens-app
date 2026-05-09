/**
 * System layers — five-cell variant of the pillar grammar used on /cases.
 *
 * Wraps to two rows on desktop (3 + 2) and stacks on mobile, keeping the
 * same kicker / Gambarino title / dim body as StandardPillars but sized
 * for a higher-density listing. Used on /about §03.
 */

import type { AboutLayer } from "@/lib/mocks/about";

export function SystemLayers({ layers }: { layers: AboutLayer[] }) {
  return (
    <section
      aria-label="INTERLIGENS system layers"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        borderTop: "1px solid var(--rule)",
        borderLeft: "1px solid var(--rule)",
        background: "var(--ink)",
      }}
    >
      {layers.map((l) => (
        <article
          key={l.num}
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
            <span style={{ color: "var(--bone-dim)" }}>{l.num} ·</span>{" "}
            {l.kicker}
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
            {l.title}
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
            {l.body}
          </p>
        </article>
      ))}
    </section>
  );
}
