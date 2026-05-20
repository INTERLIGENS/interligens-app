/**
 * src/app/admin/casefile-nova/page.tsx
 *
 * Admin-only generator UI for the $NOVA synthetic casefile PDF.
 *
 * The page itself is a Server Component so it can read FEATURE_FLAGS at
 * render time. The interactive form is a Client Component below.
 *
 * Auth: the underlying POST route is gated by requireAdminApi() + cookie. The
 * page does not redirect on its own (matches the existing admin pages in this
 * tree), but the form will surface a 401/403 if the visitor lacks a valid
 * admin cookie.
 */

import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { NovaGeneratorForm } from "./_components/NovaGeneratorForm";

const ACCENT = "#FF6B00";
const DANGER = "#FF3B5C";

export const dynamic = "force-dynamic";

export default function CasefileNovaPage() {
  const enabled = FEATURE_FLAGS.CASEFILE_NOVA_GENERATOR;

  return (
    <div
      style={{
        background: "#000",
        color: "#FFF",
        minHeight: "100vh",
        padding: "32px",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div
          style={{
            background: "#000",
            border: `2px solid ${DANGER}`,
            color: DANGER,
            padding: "14px 18px",
            textAlign: "center",
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          SYNTHETIC SAMPLE &mdash; NOT REAL CASE &mdash; ADMIN ONLY
        </div>

        <div
          style={{
            fontFamily: "\"Courier New\", monospace",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: ACCENT,
            textTransform: "uppercase",
            paddingLeft: 12,
            borderLeft: `4px solid ${ACCENT}`,
            marginBottom: 14,
          }}
        >
          INTERLIGENS CASEFILE GENERATOR
        </div>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          $NOVA &mdash; Synthetic Demo
        </h1>
        <p style={{ color: "#A1A1AA", fontSize: 14, marginBottom: 24 }}>
          Generates the synthetic <code>$NOVA</code> casefile PDF (8 sections,
          attribution-ladder tagged, no real PII) for outreach packages. No R2
          upload in v1; direct streaming download only.
        </p>

        {!enabled && (
          <div
            style={{
              background: "#1f1100",
              border: `1px solid ${ACCENT}`,
              color: ACCENT,
              padding: "12px 16px",
              fontSize: 13,
              marginBottom: 20,
              fontFamily: "\"Courier New\", monospace",
            }}
          >
            <strong>Feature flag disabled.</strong> Set{" "}
            <code>FEATURE_CASEFILE_NOVA_GENERATOR=true</code> in your env and
            restart the dev server to enable PDF generation.
          </div>
        )}

        <NovaGeneratorForm flagEnabled={enabled} />

        <div
          style={{
            marginTop: 32,
            padding: "16px 18px",
            background: "#0A0A0A",
            border: "1px solid #27272A",
            color: "#A1A1AA",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: "#FFF" }}>Guard-rails.</strong> Output PDF
          contains: cover with SYNTHETIC banner + 4-prohibition disclaimer,
          sect.01-08 (Reporting party - Incident - On-chain - OSINT - Claims -
          Assumptions/Limitations/Negative/Contradictory - Exhibits - Triage).
          Wallet origin attribution = L0 (audit-corrected). Triage = B,
          Exchange escalation candidate (post-audit downgrade from C). No real
          names. No real addresses. Not for filing.
        </div>
      </div>
    </div>
  );
}
