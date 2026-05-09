/**
 * GuardHero — opening of /guard.
 *
 * Two-column at desktop: producer-side hero text on the left, a single
 * pinned mock verdict on the right. The mock is a static GuardMockPanel
 * — same grammar as the three scenario panels lower on the page,
 * scaled at hero density.
 *
 * No "install now". The primary CTA is mailto guard@interligens.com
 * with a pre-filled subject. The secondary CTA is a sober link to a
 * canonical reference page (default /methodology) — never to a sales
 * surface.
 */

import Link from "next/link";
import { GuardMockPanel } from "./GuardMockPanel";

type SecondaryCta = { label: string; href: string };

export function GuardHero({
  kicker,
  title,
  dek,
  positionLine,
  primaryCta,
  primaryHref,
  secondaryCta,
}: {
  kicker: string;
  title: string;
  dek: string;
  positionLine: string;
  primaryCta: string;
  primaryHref: string;
  secondaryCta?: SecondaryCta;
}) {
  return (
    <section
      aria-label="Phantom Guard"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)",
        gap: 40,
        padding: "16px 0 56px",
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
        <h1
          style={{
            fontFamily:
              "var(--font-display, 'Gambarino'), 'General Sans', serif",
            fontSize: "clamp(38px, 5.4vw, 64px)",
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            color: "var(--bone)",
            margin: 0,
            maxWidth: 780,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontFamily:
              "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--bone-soft)",
            margin: 0,
            maxWidth: 640,
          }}
        >
          {dek}
        </p>

        <div
          aria-hidden
          style={{
            height: 1,
            background: "var(--rule)",
            margin: "8px 0 0",
            maxWidth: 480,
          }}
        />

        <div
          style={{
            fontFamily:
              "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--bone-dim)",
          }}
        >
          {positionLine}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            paddingTop: 8,
          }}
        >
          <a
            href={primaryHref}
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
            <span>{primaryCta}</span>
            <span aria-hidden style={{ color: "var(--signal)" }}>
              →
            </span>
          </a>
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 18px",
                border: "1px solid var(--rule)",
                color: "var(--bone-soft)",
                textDecoration: "none",
                fontFamily:
                  "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
                fontSize: 12,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              <span>{secondaryCta.label}</span>
              <span aria-hidden style={{ color: "var(--bone-dim)" }}>
                →
              </span>
            </Link>
          )}
        </div>
      </div>

      <aside
        aria-label="Verdict mock"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingTop: 8,
        }}
      >
        <div
          style={{
            fontFamily:
              "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--bone-dim)",
          }}
        >
          MOCK · VERDICT · APPROVAL INTERCEPT
        </div>
        <GuardMockPanel variant="approval" />
        <div
          style={{
            fontFamily:
              "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--bone-dimmer)",
          }}
        >
          Illustration · not a live transaction
        </div>
      </aside>
    </section>
  );
}
