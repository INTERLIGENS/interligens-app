/**
 * GuardMockPanel — single mock of a Guard verdict modal as it would
 * appear over a wallet signature surface.
 *
 * Forensic Editorial palette only: ink background, bone text, signal
 * orange for kickers and emphasis, risk red for critical states. No
 * device chrome, no browser screenshot, no rounded "AI assistant"
 * idiom. The frame is a tight rectangle — a pinned verdict, not a
 * popup advertisement.
 */

type Variant = "approval" | "honeypot" | "kol" | "signature";

const VARIANT_COPY: Record<
  Variant,
  {
    headLeft: string;
    headRight: string;
    title: string;
    score: string;
    scoreTone: "risk" | "caution" | "signal";
    rows: string[];
    footer: string;
    footerLink?: { label: string; href: string };
  }
> = {
  approval: {
    headLeft: "PHANTOM GUARD · INTERCEPT",
    headRight: "PRE-SIGNATURE",
    title: "setApprovalForAll · unlimited delegation",
    score: "TigerScore 17/100",
    scoreTone: "risk",
    rows: [
      "Deployer linked to documented drainer cluster · published 2026-03",
      "Function: setApprovalForAll · operator: external · approved: true",
      "Approval scope: unlimited · revocation cost: 1 tx",
    ],
    footer: "Source · INTERLIGENS registry · TigerScore composite",
    footerLink: { label: "Read dossier →", href: "/cases" },
  },
  honeypot: {
    headLeft: "PHANTOM GUARD · INTERCEPT",
    headRight: "PRE-SIGNATURE",
    title: "Transfer-blacklist function detected",
    score: "Honeypot · sell path obstructed",
    scoreTone: "risk",
    rows: [
      "Bytecode read · _blacklist mapping referenced inside transfer()",
      "Path · buy permitted · sell rejected for non-deployer addresses",
      "Source · on-chain bytecode · hashref attached to verdict",
    ],
    footer: "Source · contract bytecode · static read",
    footerLink: { label: "Read methodology →", href: "/methodology" },
  },
  kol: {
    headLeft: "PHANTOM GUARD · INTERCEPT",
    headRight: "PRE-SIGNATURE",
    title: "Linked to @bkokoski cluster",
    score: "Cluster · Casefile open",
    scoreTone: "caution",
    rows: [
      "Originating address sits inside the published @bkokoski cluster",
      "Front-running pattern matches dossier (3 prior tokens, same window)",
      "Casefile 2026-07 open · disclosure threshold met",
    ],
    footer: "Source · INTERLIGENS actor registry · KOL dossier",
    footerLink: { label: "See casefile →", href: "/cases/botify" },
  },
  signature: {
    headLeft: "PHANTOM GUARD · INTERCEPT",
    headRight: "OFF-CHAIN SIGNATURE",
    title: "Permit · external spender",
    score: "Signature, not transaction",
    scoreTone: "caution",
    rows: [
      "EIP-712 payload reconstructed · grants control without on-chain trace",
      "Spender · external address · no published dossier · low credibility prior",
      "Refused single-line summary · structure not safe to compress",
    ],
    footer: "Source · payload reconstruction · SDK adapter",
    footerLink: { label: "Read evidence →", href: "/evidence/vine" },
  },
};

export function GuardMockPanel({ variant }: { variant: Variant }) {
  const copy = VARIANT_COPY[variant];
  const toneColor =
    copy.scoreTone === "risk"
      ? "var(--risk)"
      : copy.scoreTone === "caution"
      ? "var(--caution)"
      : "var(--signal)";

  return (
    <figure
      role="img"
      aria-label={`Phantom Guard verdict mock — ${copy.title}`}
      style={{
        margin: 0,
        border: "1px solid var(--rule-strong)",
        background: "var(--ink-raised)",
        fontFamily:
          "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
        color: "var(--bone)",
        position: "relative",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          insetInline: 0,
          top: 0,
          height: 1,
          background: toneColor,
        }}
      />
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          borderBottom: "1px solid var(--rule)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--bone-dim)",
        }}
      >
        <span style={{ color: "var(--signal)" }}>{copy.headLeft}</span>
        <span>{copy.headRight}</span>
      </header>

      <div
        style={{
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <div
          style={{
            fontFamily:
              "var(--font-display, 'Gambarino'), 'General Sans', serif",
            fontSize: 18,
            lineHeight: 1.25,
            color: "var(--bone)",
            letterSpacing: "-0.01em",
          }}
        >
          {copy.title}
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: toneColor,
          }}
        >
          {copy.score}
        </div>
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          fontSize: 11,
          lineHeight: 1.55,
        }}
      >
        {copy.rows.map((row, i) => (
          <li
            key={i}
            style={{
              padding: "10px 14px",
              color: "var(--bone-soft)",
              borderBottom:
                i === copy.rows.length - 1 ? "none" : "1px solid var(--rule)",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <span
              aria-hidden
              style={{
                color: "var(--bone-dim)",
                flexShrink: 0,
                width: 18,
                fontSize: 10,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{row}</span>
          </li>
        ))}
      </ul>

      <footer
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--rule)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--bone-dim)",
        }}
      >
        <span>{copy.footer}</span>
        {copy.footerLink && (
          <a
            href={copy.footerLink.href}
            style={{
              color: "var(--bone)",
              textDecoration: "none",
            }}
          >
            {copy.footerLink.label}
          </a>
        )}
      </footer>
    </figure>
  );
}
