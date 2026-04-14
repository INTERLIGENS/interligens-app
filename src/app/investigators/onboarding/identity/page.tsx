"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.1)";

const COUNTRIES = [
  "France", "United States", "United Kingdom", "Germany", "Spain", "Italy",
  "Netherlands", "Belgium", "Switzerland", "Canada", "Australia", "Singapore",
  "Japan", "Brazil", "Mexico", "Portugal", "Ireland", "Sweden", "Norway",
  "Denmark", "Finland", "Poland", "Czech Republic", "Austria", "Greece",
  "Other",
];

const INPUT: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: `1px solid ${LINE}`,
  borderRadius: 4,
  padding: "12px 14px",
  color: TEXT,
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
  marginBottom: 8,
  fontFamily: "monospace",
};

export default function InvestigatorIdentityPage() {
  const router = useRouter();
  const [legalFirstName, setLegalFirstName] = useState("");
  const [legalLastName, setLegalLastName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [country, setCountry] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!legalFirstName.trim() || !legalLastName.trim() || !primaryEmail.trim() || !country) {
      setError("All required fields must be filled.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/investigators/identity/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalFirstName: legalFirstName.trim(),
          legalLastName: legalLastName.trim(),
          primaryEmail: primaryEmail.trim(),
          country,
          organizationName: organizationName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Identity submission failed");
        setSubmitting(false);
        return;
      }
      router.push("/investigators/onboarding/welcome");
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 24px 120px" }}>
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
          INTERLIGENS · IDENTITY
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            marginBottom: 8,
          }}
        >
          Identity Verification
        </h1>
        <p style={{ fontSize: 13, color: DIM, lineHeight: 1.7, marginBottom: 40 }}>
          Before we activate your workspace, we need to know who you are.
          This information is held privately by INTERLIGENS and is never
          displayed publicly.
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={LABEL}>Legal first name *</label>
            <input
              value={legalFirstName}
              onChange={(e) => setLegalFirstName(e.target.value)}
              style={INPUT}
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={LABEL}>Legal last name *</label>
            <input
              value={legalLastName}
              onChange={(e) => setLegalLastName(e.target.value)}
              style={INPUT}
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={LABEL}>Primary email *</label>
            <input
              type="email"
              value={primaryEmail}
              onChange={(e) => setPrimaryEmail(e.target.value)}
              style={INPUT}
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={LABEL}>Country *</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ ...INPUT, appearance: "none" }}
              required
            >
              <option value="">— Select —</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={LABEL}>Organization</label>
            <input
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Organization or affiliation (optional)"
              style={INPUT}
            />
          </div>

          {error && (
            <div
              style={{
                color: "#FF3B5C",
                fontSize: 12,
                marginBottom: 16,
                fontFamily: "monospace",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "16px 0",
              background: ACCENT,
              color: BG,
              border: "none",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.15em",
              fontFamily: "monospace",
              textTransform: "uppercase",
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
