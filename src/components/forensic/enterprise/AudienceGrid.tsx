/**
 * AudienceGrid — seven-cell variant of the SystemLayers grammar.
 *
 * Same kicker / Gambarino title / dim body cell used on /about §03 and
 * /press §03, sized for the audience-category density. Wraps fluidly:
 * desktop tends toward a 3 × N grid, tablet to 2 × N, mobile to a
 * single column. Visually neutral — no commercial accent. Naming a
 * category is not a customer claim.
 */

import type { AudienceCategory } from "@/lib/mocks/enterprise";

export function AudienceGrid({
  categories,
}: {
  categories: AudienceCategory[];
}) {
  return (
    <section
      aria-label="Audiences the system can serve"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        borderTop: "1px solid var(--rule)",
        borderLeft: "1px solid var(--rule)",
        background: "var(--ink)",
      }}
    >
      {categories.map((c) => (
        <article
          key={c.num}
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
            <span style={{ color: "var(--bone-dim)" }}>{c.num} ·</span>{" "}
            {c.kicker}
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
            {c.title}
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
            {c.body}
          </p>
        </article>
      ))}
    </section>
  );
}
