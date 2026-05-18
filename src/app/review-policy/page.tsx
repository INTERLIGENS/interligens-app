// ─── /review-policy — contestation + correction workflow ────────────────
// Plain-language description of how to contest a TigerScore or a governed
// status. Indexable. Deliberately avoids any over-promised guarantee (no
// "24h response time", no "100% accurate") so it stays defensible.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Review policy — INTERLIGENS",
  description:
    "How to signal an error, request a review, or contest a governed status on INTERLIGENS.",
  openGraph: {
    title: "Review policy — INTERLIGENS",
    description: "Correction workflow and right-of-reply for TigerScore outputs.",
    type: "article",
  },
  robots: { index: true, follow: true },
};

export default function ReviewPolicyPage() {
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
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
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
            REVIEW POLICY
          </span>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -0.8,
              marginBottom: 10,
            }}
          >
            How to contest a TigerScore or a governed status
          </h1>
          <p style={{ color: "#999", fontSize: 15, lineHeight: 1.65 }}>
            Scores and governed statuses are analytical outputs. When they
            disagree with reality, we want to know — and fix them.
          </p>
        </header>

        <Section id="scope" title="01 · What can be contested">
          <ul style={UL}>
            <li>The numeric TigerScore shown on a wallet or a token page.</li>
            <li>
              A specific driver listed in the top reasons (e.g. an
              &quot;unknown programs&quot; signal that turns out to be benign).
            </li>
            <li>
              A governed status attached to an entity (watchlisted, suspected,
              corroborated high risk, confirmed known bad, authority-flagged).
            </li>
            <li>A provenance claim (who the data came from).</li>
          </ul>
        </Section>

        <Section id="how" title="02 · How to reach us">
          <p>
            Two channels, both monitored. Use whichever fits the nature of the
            request:
          </p>
          <ul style={UL}>
            <li>
              <strong>Email</strong> —{" "}
              <a href="mailto:legal@interligens.com" style={LINK}>
                legal@interligens.com
              </a>
              . Include the URL, the exact score/status observed, and the
              reason for contestation.
            </li>
            <li>
              <strong>Form</strong> —{" "}
              <a href="/en/correction" style={LINK}>
                /en/correction
              </a>{" "}
              (or{" "}
              <a href="/fr/correction" style={LINK}>
                /fr/correction
              </a>
              ).
            </li>
          </ul>
        </Section>

        <Section id="verify" title="03 · Identity verification">
          <p>
            For challenges that come from the affected entity or its counsel,
            we verify identity before publishing a response:
          </p>
          <ul style={UL}>
            <li>
              E-mail sent from an official domain of the entity (DKIM-signed).
            </li>
            <li>
              For the two strongest governed tiers — <em>confirmed known bad</em>{" "}
              and <em>authority-flagged</em> — a signed legal document is
              required in addition to the email.
            </li>
          </ul>
          <p>
            Unverifiable submissions are acknowledged and queued, but not
            published in the fact-sheet.
          </p>
        </Section>

        <Section id="workflow" title="04 · Our workflow">
          <ol style={OL}>
            <li>Receipt logged with an internal ID.</li>
            <li>
              Editorial + (if needed) legal review — we favour facts over
              speed, so the timeline is not fixed. We will commit to a
              reasonable delay in writing when the review starts.
            </li>
            <li>
              Correction, retraction or refusal — each decision is motivated.
              Corrections land in-place on the fact-sheet with a changelog
              entry.
            </li>
            <li>Audit trail kept on an append-only log for traceability.</li>
          </ol>
        </Section>

        <Section id="limits" title="05 · What we will and will not do">
          <h3 style={H3}>Will</h3>
          <ul style={UL}>
            <li>
              Read every submission and record it in our internal audit log.
            </li>
            <li>
              Fix factual errors and publicly log the correction.
            </li>
            <li>
              Publish a verified right-of-reply next to the contested claim.
            </li>
            <li>
              Revoke a governed status when the underlying evidence no longer
              holds.
            </li>
          </ul>
          <h3 style={H3}>Will not</h3>
          <ul style={UL}>
            <li>Remove a score simply because it reflects badly on an entity.</li>
            <li>
              Guarantee a fixed turnaround time — quality of review matters
              more than deadline.
            </li>
            <li>
              Disclose the identity of a community submitter back to the
              contested entity.
            </li>
            <li>
              Negotiate the score in exchange for a commercial relationship —
              INTERLIGENS does not sell whitewashing.
            </li>
          </ul>
        </Section>

        <Section id="legal" title="06 · Legal framing">
          <p>
            INTERLIGENS operates as an editorial analysis platform. Our
            outputs are{" "}
            <strong>estimates</strong>, not judicial determinations. They are
            offered for information only and do not constitute legal or
            financial advice.
          </p>
          <p>
            When a specific national legal regime applies — e.g. the French
            loi du 29 juillet 1881 on press and right-of-reply — we honour
            the deadlines and formalism defined by that regime.
          </p>
        </Section>

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
          See also the{" "}
          <a href="/methodology" style={LINK}>
            methodology
          </a>{" "}
          and{" "}
          <a href="/en/legal/mentions-legales" style={LINK}>
            mentions légales
          </a>
          .
        </footer>
      </div>
    </main>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────

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
    <section id={id} style={{ marginTop: 36, scrollMarginTop: 80 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: -0.2,
          marginBottom: 10,
        }}
      >
        {title}
      </h2>
      <div style={{ color: "#CCCCCC", fontSize: 14.5, lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}

const UL: React.CSSProperties = {
  lineHeight: 1.7,
  color: "#CCCCCC",
  paddingLeft: 20,
};

const OL: React.CSSProperties = {
  lineHeight: 1.7,
  color: "#CCCCCC",
  paddingLeft: 20,
};

const H3: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#FF6B00",
  fontWeight: 900,
  marginTop: 20,
  marginBottom: 8,
};

const LINK: React.CSSProperties = {
  color: "#FF6B00",
  textDecoration: "none",
};
