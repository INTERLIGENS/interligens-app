import Link from "next/link";

/**
 * HomeGuardTeaser — editorial teaser for Phantom Guard on /home.
 *
 * Sits after the registry cross-links (the last of which is the
 * Constellation entry), before the colophon. Visibility is comparable
 * to that Constellation teaser: kicker / Gambarino title / dim body /
 * a single sober CTA to /guard.
 *
 * Phantom Guard is a major distribution pillar — this block makes it a
 * named surface in the home sequence rather than a buried footer link.
 * Reuses the existing token and grammar set; no new design language.
 */

export function HomeGuardTeaser({
  kicker,
  title,
  body,
  cta,
  href,
}: {
  kicker: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <section
      aria-label="Phantom Guard"
      style={{
        borderTop: "1px solid var(--rule)",
        padding: "56px 0",
        display: "flex",
        flexDirection: "column",
        gap: 20,
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
        {kicker}
      </div>
      <h2
        style={{
          fontFamily:
            "var(--font-display, 'Gambarino'), 'General Sans', serif",
          fontSize: "clamp(30px, 4vw, 46px)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: "var(--bone)",
          fontWeight: 400,
          margin: 0,
          maxWidth: 680,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily:
            "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
          fontSize: 17,
          lineHeight: 1.55,
          color: "var(--bone-soft)",
          margin: 0,
          maxWidth: 620,
        }}
      >
        {body}
      </p>
      <div style={{ paddingTop: 4 }}>
        <Link
          href={href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 20px",
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
          <span>{cta}</span>
          <span aria-hidden style={{ color: "var(--signal)" }}>
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
