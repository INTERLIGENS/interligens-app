"use client";
import { useState } from "react";

const BG = "#0A0C10";
const SURFACE = "#111318";
const BORDER = "#1E2028";
const AMBER = "#FFB800";
const CYAN = "#00E5FF";
const TEXT = "#F9FAFB";
const MUTED = "#6B7280";
const DIMMED = "#3B3F4A";

export default function InvestigatorLogin() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/investigator/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.status === 429) {
        setError("Too many attempts. Please wait a few minutes.");
        return;
      }
      if (!res.ok) {
        setError("Access denied");
        return;
      }
      window.location.href = "/en/investigator";
    } catch {
      setError("Network error");
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
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 400,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: 36,
        }}
      >
        {/* Branding */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              color: AMBER,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.25em",
              fontFamily: "monospace",
              marginBottom: 6,
            }}
          >
            INTERLIGENS
          </div>
          <h1 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: 0 }}>
            Investigator Access
          </h1>
          <p style={{ color: MUTED, fontSize: 12, margin: "8px 0 0", lineHeight: 1.5 }}>
            Enter your personal access code to view published intelligence.
          </p>
        </div>

        {/* Input */}
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
          autoFocus
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
          onFocus={(e) => (e.currentTarget.style.borderColor = AMBER + "50")}
          onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
        />

        {error && (
          <div style={{ color: "#FF3B5C", fontSize: 12, marginTop: 8, fontFamily: "monospace" }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !code}
          style={{
            width: "100%",
            marginTop: 20,
            padding: "12px 0",
            background: AMBER,
            color: BG,
            border: "none",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.12em",
            fontFamily: "monospace",
            cursor: loading ? "wait" : "pointer",
            opacity: loading || !code ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {loading ? "AUTHENTICATING..." : "ENTER DASHBOARD"}
        </button>
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
        NDA CONFIDENTIAL &middot; PUBLISHED INTELLIGENCE ONLY
      </div>
    </div>
  );
}
