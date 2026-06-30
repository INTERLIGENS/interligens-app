/**
 * src/app/submit/page.tsx
 *
 * SPRINT C1 — Page publique /submit, DERRIÈRE LE KILL SWITCH.
 *
 * Server component : lit OSINT_RETAIL_SUBMIT_ENABLED. Fermé par défaut → affiche
 * "submissions temporarily closed", AUCUN formulaire actif. Ouvert → rend le
 * formulaire client (upload 1-3 captures + URL tweet + contexte), le widget
 * Turnstile (si site key) et la copie d'abus obligatoire (exigence GPT).
 *
 * Design system INTERLIGENS : fond noir, accent orange #FF6B00, jamais de cyan,
 * labels uppercase tracking, zéro emoji.
 */

import type { Metadata } from "next";
import Script from "next/script";
import { isRetailSubmitEnabled } from "@/lib/osint/retail/retailConfig";
import { SubmitForm } from "./SubmitForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Submit evidence — INTERLIGENS",
  description: "Submit OSINT screenshots for internal review. Submitting publishes nothing.",
  robots: { index: false, follow: false },
};

const C = {
  bg: "#000000",
  accent: "#FF6B00",
  text: "#FFFFFF",
  danger: "#FF3B5C",
  warning: "#FFB800",
  dim: "#8A8A8A",
  line: "#1C1C1C",
  panel: "#0A0A0A",
};

const eyebrow: React.CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.32em",
  fontWeight: 900,
  fontSize: 11,
  color: C.accent,
};

function ClosedNotice() {
  return (
    <div
      style={{
        border: `1px solid ${C.line}`,
        borderLeft: `3px solid ${C.warning}`,
        background: C.panel,
        borderRadius: 8,
        padding: "26px 28px",
        maxWidth: 640,
      }}
    >
      <p style={{ ...eyebrow, color: C.warning, marginBottom: 14 }}>Intake offline</p>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
        Submissions are temporarily closed.
      </h2>
      <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
        The evidence intake is not accepting new submissions right now. Nothing is being collected on
        this page. Check back later.
      </p>
    </div>
  );
}

export default function SubmitPage() {
  const open = isRetailSubmitEnabled();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;

  return (
    <main
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "56px 24px 80px",
      }}
    >
      {open && siteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      )}

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* ── Hero : la thèse, pas un gros chiffre ─────────────────────────── */}
        <header style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: 20, marginBottom: 40 }}>
          <p style={{ ...eyebrow, marginBottom: 16 }}>INTERLIGENS · Evidence intake</p>
          <h1 style={{ fontSize: 38, lineHeight: 1.05, fontWeight: 900, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
            Send a screenshot.
            <br />
            <span style={{ color: C.accent }}>It stays a private lead.</span>
          </h1>
          <p style={{ color: C.dim, fontSize: 15, lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
            Drop up to three captures of a KOL call, a perf card, or a contract address. They go into an
            internal review queue. Submitting does not publish anything, anywhere — and the original image
            is never made public, even after review.
          </p>
        </header>

        {open ? <SubmitForm siteKey={siteKey} /> : <ClosedNotice />}

        <footer style={{ marginTop: 48, paddingTop: 18, borderTop: `1px solid ${C.line}` }}>
          <p style={{ color: C.dim, fontSize: 11, letterSpacing: "0.04em", margin: 0 }}>
            Internal OSINT intake · shadow pipeline · no public output
          </p>
        </footer>
      </div>
    </main>
  );
}
