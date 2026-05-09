/**
 * EarlyAccessBlock — sober early-access surface for /guard.
 *
 * One mailto chip, one note line, one address. No HTML form, no
 * "subscribe", no pricing language. Distribution is described as
 * "available via early access" and nothing else: the §7.2 pricing
 * decision is open and the page must not act it out.
 */

export function EarlyAccessBlock({
  kicker,
  title,
  body,
  noteLine,
  email,
  subject,
}: {
  kicker: string;
  title: string;
  body: string;
  noteLine: string;
  email: string;
  subject: string;
}) {
  return (
    <section
      aria-label="Early access"
      style={{
        border: "1px solid var(--rule-strong)",
        background: "var(--ink-raised)",
        padding: "32px 28px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
        columnGap: 32,
        rowGap: 20,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          {kicker}
        </div>
        <h2
          style={{
            fontFamily:
              "var(--font-display, 'Gambarino'), 'General Sans', serif",
            fontSize: 28,
            lineHeight: 1.18,
            letterSpacing: "-0.015em",
            color: "var(--bone)",
            margin: 0,
            maxWidth: 560,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontFamily:
              "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--bone-soft)",
            margin: 0,
            maxWidth: 560,
          }}
        >
          {body}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-start",
          borderLeft: "1px solid var(--rule)",
          paddingLeft: 24,
        }}
      >
        <a
          href={`mailto:${email}?subject=${encodeURIComponent(subject)}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            border: "1px solid var(--signal)",
            background: "var(--signal-edge)",
            color: "var(--bone)",
            textDecoration: "none",
            fontFamily:
              "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span>{email}</span>
          <span aria-hidden style={{ color: "var(--signal)" }}>
            →
          </span>
        </a>
        <div
          style={{
            fontFamily:
              "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--bone-dim)",
          }}
        >
          {noteLine}
        </div>
      </div>
    </section>
  );
}
