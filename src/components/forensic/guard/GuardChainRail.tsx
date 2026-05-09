/**
 * GuardChainRail — five stages of the engine, ending at Guard.
 *
 * Reads as: scan → evidence → casefiles → constellation → guard. The
 * earlier stages link back to canonical surfaces; the final stage is
 * Guard itself and renders as a non-link emphasis cell.
 *
 * No "powered by" claims; stages are listed as-is. Visual is a
 * numbered horizontal rail at desktop, falling back to a vertical
 * stack at narrow widths.
 */

import type { CSSProperties } from "react";
import Link from "next/link";
import type { GuardChainStage } from "@/lib/mocks/guard";

const containerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  borderTop: "1px solid var(--rule)",
  borderLeft: "1px solid var(--rule)",
};

const cellBase: CSSProperties = {
  borderRight: "1px solid var(--rule)",
  borderBottom: "1px solid var(--rule)",
  padding: "24px 22px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  textDecoration: "none",
  color: "var(--bone)",
};

export function GuardChainRail({ stages }: { stages: GuardChainStage[] }) {
  return (
    <section aria-label="From scan to signature" style={containerStyle}>
      {stages.map((stage, i) => {
        const isFinal = i === stages.length - 1;

        const kicker = (
          <div
            style={{
              fontFamily:
                "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: isFinal ? "var(--signal)" : "var(--bone-dim)",
            }}
          >
            {stage.num} · {stage.label}
          </div>
        );

        const title = (
          <h3
            style={{
              fontFamily:
                "var(--font-display, 'Gambarino'), 'General Sans', serif",
              fontSize: 20,
              lineHeight: 1.22,
              letterSpacing: "-0.01em",
              color: "var(--bone)",
              margin: 0,
            }}
          >
            {stage.title}
          </h3>
        );

        const body = (
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
            {stage.body}
          </p>
        );

        const trail = (
          <span
            aria-hidden
            style={{
              fontFamily:
                "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: isFinal ? "var(--signal)" : "var(--bone-dim)",
              marginTop: 6,
            }}
          >
            {isFinal ? "You are here" : `Read ${stage.label.toLowerCase()} →`}
          </span>
        );

        if (isFinal || !stage.href) {
          return (
            <div
              key={stage.num}
              style={{
                ...cellBase,
                background: isFinal ? "var(--ink-raised)" : "var(--ink)",
              }}
            >
              {kicker}
              {title}
              {body}
              {trail}
            </div>
          );
        }

        return (
          <Link
            key={stage.num}
            href={stage.href}
            style={{ ...cellBase, background: "var(--ink)" }}
          >
            {kicker}
            {title}
            {body}
            {trail}
          </Link>
        );
      })}
    </section>
  );
}
