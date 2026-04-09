"use client";
import { useState } from "react";

const BG = "#0A0C10";
const SURFACE = "#111318";
const SURFACE2 = "#161920";
const BORDER = "#1E2028";
const BRAND = "#F85B05";
const CYAN = "#00E5FF";
const TEXT = "#F9FAFB";
const MUTED = "#6B7280";
const DIMMED = "#3B3F4A";
const RED = "#FF3B5C";

const NDA_TEXT = `INTERLIGENS — NON-DISCLOSURE AGREEMENT (BETA ACCESS)

By entering your access code below, you acknowledge and agree to the following:

1. CONFIDENTIALITY
All data, reports, intelligence, scoring, analysis, case files, and any information accessed through the Interligens platform ("Confidential Information") is proprietary and strictly confidential. You shall not disclose, reproduce, distribute, or share any Confidential Information with any third party without prior written authorization from Interligens.

2. AUTHORIZED USE ONLY
Access is granted solely for the purposes specified in your invitation. You may not use the platform or any of its contents for commercial purposes, competitive intelligence, or any purpose not expressly authorized.

3. NO REDISTRIBUTION
Screenshots, exports, PDFs, data extracts, or any reproduction of platform content may not be shared outside the scope of your authorized use.

4. FACTUAL REPORTING
All intelligence presented on the platform constitutes factual observations and documented evidence. Nothing on the platform constitutes legal advice or formal accusations. Any action taken based on platform intelligence is your sole responsibility.

5. SECURITY
You are responsible for the security of your access credentials. Do not share your access code. Report any suspected unauthorized access immediately.

6. DURATION
This agreement remains in effect for the duration of your access and survives termination. Confidentiality obligations persist after access revocation.

7. GOVERNING LAW
This agreement is governed by the laws of the European Union and the applicable jurisdiction of the platform operator.

By proceeding, you confirm that you have read, understood, and agree to be bound by these terms.`;

export default function BetaAccessNDA() {
  const [code, setCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setError("You must accept the NDA to continue.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/beta/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ndaAccepted: true }),
      });
      if (res.status === 429) {
        setError("Too many attempts. Please wait a few minutes.");
        return;
      }
      if (!res.ok) {
        setError("Access denied.");
        return;
      }
      // Redirect to the main demo
      window.location.href = "/en/demo";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "40px 16px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 560,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: 36,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              color: BRAND,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.25em",
              fontFamily: "monospace",
              marginBottom: 6,
            }}
          >
            INTERLIGENS
          </div>
          <h1 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
            Non-Disclosure Agreement
          </h1>
          <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>
            Read the agreement below, then enter your access code to proceed.
          </p>
        </div>

        {/* NDA scroll box */}
        <div
          style={{
            background: BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            padding: 20,
            maxHeight: 320,
            overflowY: "auto",
            marginBottom: 20,
            fontSize: 11,
            fontFamily: "monospace",
            color: MUTED,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
        >
          {NDA_TEXT}
        </div>

        {/* NDA checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 24,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{
              marginTop: 2,
              width: 16,
              height: 16,
              accentColor: BRAND,
              cursor: "pointer",
              flexShrink: 0,
            }}
          />
          <span style={{ color: TEXT, fontSize: 12, lineHeight: 1.5 }}>
            I have read and accept the Non-Disclosure Agreement. I understand that all
            information accessed through this platform is confidential.
          </span>
        </label>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: BORDER,
            marginBottom: 24,
          }}
        />

        {/* Access code input */}
        <label
          style={{
            display: "block",
            color: DIMMED,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.15em",
            marginBottom: 6,
            fontFamily: "monospace",
            textTransform: "uppercase",
          }}
        >
          Access Code
        </label>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          placeholder="Enter your access code"
          style={{
            width: "100%",
            padding: "12px 14px",
            background: BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            color: TEXT,
            fontSize: 14,
            fontFamily: "monospace",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = BRAND + "50")}
          onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
        />

        {/* Error */}
        {error && (
          <div
            style={{
              color: RED,
              fontSize: 12,
              marginTop: 8,
              fontFamily: "monospace",
            }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !code || !accepted}
          style={{
            width: "100%",
            marginTop: 20,
            padding: "14px 0",
            background: BRAND,
            color: BG,
            border: "none",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.12em",
            fontFamily: "monospace",
            cursor: loading ? "wait" : "pointer",
            opacity: loading || !code || !accepted ? 0.4 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {loading ? "AUTHENTICATING..." : "ACCEPT NDA & ENTER PLATFORM"}
        </button>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a
            href="/access"
            style={{
              color: DIMMED,
              fontSize: 10,
              fontFamily: "monospace",
              textDecoration: "none",
            }}
          >
            &larr; Back
          </a>
        </div>
      </form>

      {/* Footer */}
      <div
        style={{
          marginTop: 24,
          color: DIMMED,
          fontSize: 9,
          fontFamily: "monospace",
          letterSpacing: "0.1em",
          textAlign: "center",
        }}
      >
        NDA CONFIDENTIAL &middot; AUTHORIZED ACCESS ONLY
      </div>
    </div>
  );
}
