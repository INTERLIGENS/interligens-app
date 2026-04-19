import Link from "next/link";
import { enforceInvestigatorAccess } from "@/lib/investigators/accessGate";

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.6)";
const LINE = "rgba(255,255,255,0.06)";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: 40,
        paddingBottom: 40,
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      <h2
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.2em",
          fontFamily: "monospace",
          textTransform: "uppercase",
          color: ACCENT,
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 14, color: DIM, lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

export default async function WelcomePage() {
  await enforceInvestigatorAccess();
  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 120px" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.25em",
            fontFamily: "monospace",
            color: ACCENT,
            marginBottom: 12,
          }}
        >
          INTERLIGENS · WELCOME
        </div>
        <h1
          style={{
            fontSize: 42,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            marginBottom: 48,
          }}
        >
          Welcome to the Program.
        </h1>

        <Section title="What remains private">
          Your case files are encrypted client-side with a passphrase you
          control. INTERLIGENS cannot read your cases. The vault is yours.
          Verification does not change this.
        </Section>

        <Section title="What INTERLIGENS can and cannot see">
          Can see: activity metadata — login events, case count, export events,
          timestamps.
          <br />
          Cannot see: case content, entity values, your notes, your raw uploads.
        </Section>

        <Section title="Why verification exists">
          To protect you and every investigator in the program. More sensitive
          access requires stronger verification. This is proportionate, not
          intrusive.
        </Section>

        <Section title="How access levels work">
          Beta Investigator → Verified Investigator → Trusted Contributor.
          Each level unlocks additional capabilities. Trusted Contributor
          status requires time, contribution quality, and human review.
        </Section>

        <Section title="How publishing works">
          Not available by default. Requires Trusted Contributor status and
          editorial review by INTERLIGENS. Attribution is always controlled.
        </Section>

        <Section title="How suspension and revocation work">
          INTERLIGENS can suspend or permanently revoke access. NDA breach,
          security concerns, trust incidents are grounds for action. Audit
          records are always retained.
        </Section>

        <Link
          href="/investigators/dashboard"
          style={{
            display: "block",
            width: "100%",
            padding: "18px 0",
            background: ACCENT,
            color: BG,
            border: "none",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.18em",
            fontFamily: "monospace",
            textTransform: "uppercase",
            textAlign: "center",
            textDecoration: "none",
          }}
        >
          Enter Workspace →
        </Link>
      </div>
    </main>
  );
}
