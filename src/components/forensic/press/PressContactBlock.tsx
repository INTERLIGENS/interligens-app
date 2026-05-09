/**
 * PressContactBlock — single-address contact panel.
 *
 * Mirrors the filing-channel pattern from /takedown so the press
 * address is the visual centre of gravity of its section. One real
 * email address, no form, no contact-flow theatre. Inactive surfaces
 * (DM, support tickets, social) are explicitly out of scope.
 */

export function PressContactBlock({ email }: { email: string }) {
  return (
    <div
      aria-label="Press contact"
      style={{
        border: "1px solid var(--rule)",
        padding: "24px",
        background: "var(--ink-raised)",
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
        Press address
      </div>
      <div
        style={{
          fontFamily:
            "var(--font-display, 'Gambarino'), 'General Sans', serif",
          fontSize: 28,
          lineHeight: 1.2,
          color: "var(--bone)",
          wordBreak: "break-word",
        }}
      >
        <a
          href={`mailto:${email}`}
          style={{ color: "var(--bone)", textDecoration: "none" }}
        >
          {email}
        </a>
      </div>
      <div
        style={{
          fontFamily:
            "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
          fontSize: 13,
          color: "var(--bone-dim)",
          lineHeight: 1.5,
        }}
      >
        Acknowledged within two working days. For tighter deadlines,
        flag in the subject line. We do not handle press queries via
        DM, support tickets, or social channels.
      </div>
    </div>
  );
}
