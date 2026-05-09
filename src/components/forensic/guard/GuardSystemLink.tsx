/**
 * GuardSystemLink — six-cell pillars of the engine that Guard surfaces.
 *
 * Same kicker / Gambarino title / dim body grammar as the AudienceGrid
 * on /enterprise. Reads as a list of components Guard does not own —
 * TigerScore, Open Evidence, Casefiles, KOL intelligence, Constellation,
 * Publication discipline — to make the dependency explicit.
 */

import type { GuardEnginePillar } from "@/lib/mocks/guard";

export function GuardSystemLink({
  pillars,
}: {
  pillars: GuardEnginePillar[];
}) {
  return (
    <section
      aria-label="Built on the INTERLIGENS engine"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        borderTop: "1px solid var(--rule)",
        borderLeft: "1px solid var(--rule)",
        background: "var(--ink)",
      }}
    >
      {pillars.map((p) => (
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
            {p.label}
          </div>
          <h3
            style={{
              fontFamily:
                "var(--font-display, 'Gambarino'), 'General Sans', serif",
              fontSize: 22,
              lineHeight: 1.22,
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
              lineHeight: 1.6,
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
