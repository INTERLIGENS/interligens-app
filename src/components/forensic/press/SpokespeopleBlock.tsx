/**
 * SpokespeopleBlock — factual definition-list of authorised spokespeople.
 *
 * Reuses the ImprintBlock grammar so a TO_FILL spokesperson is visually
 * obvious in orange/mono until the editorial entity confirms a name.
 * Deliberately not a "team page" — no headshots, no bios, no LinkedIn
 * chips. Name, role, language. Three columns, plain.
 */

import type { Spokesperson } from "@/lib/mocks/press";

export function SpokespeopleBlock({
  people,
}: {
  people: Spokesperson[];
}) {
  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderBottom: "none",
        background: "var(--ink-raised)",
      }}
    >
      {people.map((p, i) => (
        <SpokespersonRow key={i} person={p} />
      ))}
    </div>
  );
}

function SpokespersonRow({ person }: { person: Spokesperson }) {
  const pendingCellStyle = {
    fontFamily:
      "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
    fontSize: 12,
    letterSpacing: "0.10em",
    textTransform: "uppercase" as const,
    color: "var(--signal)",
  };
  const nameStyle = {
    fontFamily:
      "var(--font-display, 'Gambarino'), 'General Sans', serif",
    fontSize: 20,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    color: "var(--bone)",
  };
  const metaStyle = {
    fontFamily:
      "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
    fontSize: 13,
    color: "var(--bone-soft)",
    lineHeight: 1.5,
  };
  const langStyle = {
    fontFamily:
      "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    color: "var(--bone-dim)",
  };

  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(200px, 1fr) minmax(180px, 1.2fr) minmax(140px, 200px)",
        columnGap: 24,
        rowGap: 6,
        padding: "20px 24px",
        borderBottom: "1px solid var(--rule)",
        alignItems: "baseline",
      }}
    >
      <div style={person.pending ? pendingCellStyle : nameStyle}>
        {person.name}
      </div>
      <div style={person.pending ? pendingCellStyle : metaStyle}>
        {person.title}
      </div>
      <div style={person.pending ? pendingCellStyle : langStyle}>
        {person.languages}
      </div>
    </article>
  );
}
