// ─── /methodology — TigerScore hardening methodology ─────────────────────
// Public, server-rendered, indexable. Plain-language explanation of the
// numeric score, the governed-status layer, confidence and provenance.
// Kept deliberately short and non-promissory.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TigerScore — Methodology | INTERLIGENS",
  description:
    "How INTERLIGENS builds the TigerScore: signals, confidence levels, governed-status layer and data provenance.",
  openGraph: {
    title: "TigerScore — Methodology | INTERLIGENS",
    description:
      "Engine signals, confidence, governed status and provenance explained.",
    type: "article",
  },
  robots: { index: true, follow: true },
};

export default function MethodologyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        padding: "48px 20px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Header />

        <Section id="what-the-score-is" title="01 · What the TigerScore is">
          <p>
            The TigerScore is a number between 0 and 100 that summarises the
            on-chain risk signals we collected for a wallet or a token at a
            given moment in time. It is an analytical estimate — not a legal
            conclusion and not a prediction of future behaviour.
          </p>
          <p>
            Every score is rendered with three companion fields:
          </p>
          <ul style={UL}>
            <li>
              <strong>Tier</strong> — <Tag color="#22C55E">GREEN</Tag>{" "}
              <Tag color="#F59E0B">ORANGE</Tag> <Tag color="#EF4444">RED</Tag>.
            </li>
            <li>
              <strong>Confidence</strong> — Low / Medium / High. Reflects how
              many core signals agreed, and whether the data we needed was
              fully available.
            </li>
            <li>
              <strong>Governed status</strong> — when present, an editorial
              label set by a human or an authority. See below.
            </li>
          </ul>
        </Section>

        <Section id="signals" title="02 · Signals that drive the score">
          <p>
            The engine evaluates a small set of on-chain signals with explicit
            weights. We expose the top 3 signals that contributed to any given
            score directly in the UI — no hidden drivers.
          </p>
          <ul style={UL}>
            <li>Unlimited approvals, high approval count.</li>
            <li>Unknown programs interacting with the wallet.</li>
            <li>Freeze and mint authorities still active (SPL tokens).</li>
            <li>Mutable metadata (SPL tokens).</li>
            <li>Confirmed critical claims from our registry.</li>
            <li>Market-context boosters for fresh, low-liquidity tokens.</li>
          </ul>
          <p>
            The full driver list and weights live in{" "}
            <code>src/lib/tigerScore/engine.ts</code> and are versioned — the
            engine version is returned with every score.
          </p>
        </Section>

        <Section id="governed-status" title="03 · Governed-status layer">
          <p>
            Some cases don&apos;t reduce to pure on-chain heuristics — for
            example, an address confirmed as malicious through our own
            investigations, or a wallet sanctioned by a regulator. These are
            tracked as a separate <strong>governed status</strong> that is
            shown alongside the numeric score, never merged into it.
          </p>
          <ul style={UL}>
            <li>
              <strong>watchlisted</strong> — we&apos;re monitoring this
              entity.
            </li>
            <li>
              <strong>suspected</strong> — there are initial indications we
              have not yet fully corroborated.
            </li>
            <li>
              <strong>corroborated high risk</strong> — multi-source
              evidence, suggested by the engine itself.
            </li>
            <li>
              <strong>confirmed known bad</strong> — requires manual
              confirmation with evidence.
            </li>
            <li>
              <strong>authority-flagged</strong> — the entity is listed by a
              regulator or a public authority source.
            </li>
          </ul>
          <p>
            The two strongest tiers require an explicit <em>basis</em> (manual
            internal confirmation, external authority source, multi-source
            corroboration, legacy case linkage). The engine alone cannot emit
            them.
          </p>
        </Section>

        <Section id="confidence" title="04 · How confidence is computed">
          <p>
            Confidence is coarse on purpose — it answers “how much should you
            rely on the conclusion?” rather than “what is the exact score?”.
          </p>
          <ul style={UL}>
            <li>
              <strong>High</strong> — a critical driver plus at least one
              supporting driver, or multiple high-severity drivers agreeing.
            </li>
            <li>
              <strong>Medium</strong> — one strong driver, or several
              medium-severity drivers.
            </li>
            <li>
              <strong>Low</strong> — isolated signal, or on-chain data was
              unavailable (RPC fallback, missing history).
            </li>
          </ul>
        </Section>

        <Section id="provenance" title="05 · Provenance & snapshots">
          <p>
            Every score is persisted as an immutable snapshot with:
          </p>
          <ul style={UL}>
            <li>The engine version that produced it.</li>
            <li>The top reasons (driver id + label + why).</li>
            <li>
              Per-driver provenance: which data source produced each signal
              (RPC, explorer, aggregator, internal registry), whether it was
              observed directly or inferred.
            </li>
            <li>The governed status that was active at that time.</li>
          </ul>
          <p>
            Historical snapshots can be read back via the investigator API
            and are never silently overwritten.
          </p>
        </Section>

        <Section id="limits" title="06 · What the score is not">
          <ul style={UL}>
            <li>Not a guarantee of safety or of harm.</li>
            <li>Not a legal or financial recommendation.</li>
            <li>Not a promise that bad actors will always be flagged red.</li>
            <li>
              Not a substitute for reading the code of a contract you&apos;re
              about to interact with.
            </li>
          </ul>
          <p>
            See the{" "}
            <a href="/review-policy" style={LINK}>
              review policy
            </a>{" "}
            for how to contest a score or a governed status.
          </p>
        </Section>

        <Footer />
      </div>
    </main>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────

function Header() {
  return (
    <header style={{ marginBottom: 40 }}>
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          fontSize: 10,
          letterSpacing: 3,
          fontWeight: 900,
          border: "1px solid #FF6B00",
          color: "#FF6B00",
          borderRadius: 2,
          marginBottom: 14,
        }}
      >
        TIGERSCORE · METHODOLOGY
      </span>
      <h1
        style={{
          fontSize: 40,
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: -1,
          marginBottom: 10,
        }}
      >
        What the TigerScore measures — and what it doesn&apos;t
      </h1>
      <p style={{ color: "#999", fontSize: 15, lineHeight: 1.65, maxWidth: 720 }}>
        Six short sections describing the signals, the governed-status layer,
        the confidence tiers, the provenance trail and the explicit limits of
        the score.
      </p>
    </header>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        marginTop: 40,
        scrollMarginTop: 80,
      }}
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: -0.3,
          marginBottom: 10,
        }}
      >
        {title}
      </h2>
      <div style={{ color: "#CCCCCC", fontSize: 15, lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 2,
        color,
        border: `1px solid ${color}`,
        borderRadius: 2,
      }}
    >
      {children}
    </span>
  );
}

function Footer() {
  return (
    <footer
      style={{
        marginTop: 48,
        paddingTop: 24,
        borderTop: "1px solid #1A1A1A",
        color: "#666",
        fontSize: 12,
        lineHeight: 1.7,
      }}
    >
      Questions or corrections?{" "}
      <a href="mailto:legal@interligens.com" style={LINK}>
        legal@interligens.com
      </a>
      . See also the{" "}
      <a href="/review-policy" style={LINK}>
        review policy
      </a>
      .
    </footer>
  );
}

const UL: React.CSSProperties = {
  lineHeight: 1.7,
  color: "#CCCCCC",
  paddingLeft: 20,
};

const LINK: React.CSSProperties = {
  color: "#FF6B00",
  textDecoration: "none",
};
