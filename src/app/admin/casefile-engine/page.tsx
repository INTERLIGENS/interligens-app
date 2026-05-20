import Link from "next/link";

import SyntheticBanner from "@/components/admin/casefile-engine/SyntheticBanner";
import { assertCasefileEngineEnabled } from "@/lib/casefile-engine/gate";

export const dynamic = "force-dynamic";

export default function CasefileEngineListPage() {
  // Server-side feature-flag gate. notFound() returns a 404 when the flag is
  // off, indistinguishable from an unknown route.
  assertCasefileEngineEnabled();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <SyntheticBanner />
      <div style={{ padding: "32px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#FF6B00",
            fontWeight: 700,
          }}
        >
          CASEFILE ENGINE — V1 SCAFFOLD
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
          Draft casefiles
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          Synthetic-demo workspace. No PII. No public exposure. Drafts created
          here are admin-only and never auto-published.
        </p>

        <div
          style={{
            marginTop: 24,
            padding: 24,
            background: "#0D0D0D",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            V1 scaffold — the draft list will surface here once the Neon
            migration is applied (CasefileDraft / Exhibit tables).
          </div>
          <Link
            href="/admin/casefile-engine/new"
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "10px 18px",
              background: "#FF6B00",
              color: "#000000",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            New draft
          </Link>
        </div>
      </div>
    </div>
  );
}
