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

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "FR", label: "Français" },
  { code: "ES", label: "Español" },
  { code: "DE", label: "Deutsch" },
  { code: "PT-BR", label: "Português (BR)" },
];

const SPECIALTIES = [
  "On-chain forensics",
  "OSINT",
  "KOL investigation",
  "DeFi / protocol analysis",
  "Social engineering tracking",
  "Malware / drainer tracking",
  "Other",
];

const INPUT_STYLE: React.CSSProperties = {
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

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
  marginBottom: 8,
  fontFamily: "monospace",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "6px 14px",
    border: `1px solid ${active ? ACCENT : "rgba(255,255,255,0.15)"}`,
    backgroundColor: active ? "rgba(255,107,0,0.12)" : "transparent",
    color: active ? TEXT : "rgba(255,255,255,0.5)",
    cursor: "pointer",
    fontFamily: "monospace",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderRadius: 2,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.18em",
          fontFamily: "monospace",
          textTransform: "uppercase",
          color: ACCENT,
          marginBottom: 10,
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 14, color: DIM, lineHeight: 1.7 }}>{children}</p>
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 24 }}>{children}</div>;
}

export default function InvestigatorApplyPage() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [publicLinks, setPublicLinks] = useState("");
  const [background, setBackground] = useState("");
  const [motivation, setMotivation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(arr: string[], val: string, setFn: (v: string[]) => void) {
    setFn(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!handle.trim() || !email.trim() || !country || !background.trim() || !motivation.trim()) {
      setError("All required fields must be filled.");
      return;
    }
    if (languages.length === 0) {
      setError("Select at least one language.");
      return;
    }
    if (specialties.length === 0) {
      setError("Select at least one specialty.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/investigators/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim(),
          displayName: displayName.trim() || undefined,
          email: email.trim(),
          country,
          languages,
          specialties,
          publicLinks,
          background: background.trim(),
          motivation: motivation.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
        setSubmitting(false);
        return;
      }
      router.push("/investigators/apply/received");
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
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px 120px" }}>
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
          INTERLIGENS
        </div>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            marginBottom: 12,
          }}
        >
          Join the Trusted Investigator Program
        </h1>
        <p style={{ fontSize: 14, color: DIM, lineHeight: 1.7, marginBottom: 48 }}>
          We apply a proportionate level of verification to protect your work,
          our platform, and the other investigators using it.
        </p>

        <Section title="Who this is for">
          Serious OSINT practitioners, on-chain forensics specialists,
          KOL investigators, DeFi / protocol analysts, drainer trackers.
          This is not a community. It is a program.
        </Section>

        <Section title="What stays private">
          Your case files are encrypted client-side. Your passphrase is yours
          alone. INTERLIGENS cannot read your workspace. Verification does
          not open your vault.
        </Section>

        <Section title="What INTERLIGENS protects">
          Methods, analytical workflows, scoring systems, compiled datasets,
          proprietary intelligence. Not publicly available blockchain facts.
        </Section>

        <Section title="What happens next">
          Manual review. No immediate access. You will be contacted if
          approved. This rigor protects every investigator in the program.
        </Section>

        <div
          style={{
            marginTop: 48,
            paddingTop: 48,
            borderTop: `1px solid ${LINE}`,
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
              marginBottom: 32,
            }}
          >
            Application
          </h2>

          <form onSubmit={onSubmit}>
            <FieldRow>
              <label style={LABEL_STYLE}>Handle *</label>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="Your operational handle"
                style={INPUT_STYLE}
                required
              />
            </FieldRow>

            <FieldRow>
              <label style={LABEL_STYLE}>Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Public name or alias"
                style={INPUT_STYLE}
              />
            </FieldRow>

            <FieldRow>
              <label style={LABEL_STYLE}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Contact email"
                style={INPUT_STYLE}
                required
              />
            </FieldRow>

            <FieldRow>
              <label style={LABEL_STYLE}>Country *</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{ ...INPUT_STYLE, appearance: "none" }}
                required
              >
                <option value="">— Select —</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FieldRow>

            <FieldRow>
              <label style={LABEL_STYLE}>Languages *</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LANGUAGES.map((l) => {
                  const active = languages.includes(l.code);
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => toggle(languages, l.code, setLanguages)}
                      style={chipStyle(active)}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </FieldRow>

            <FieldRow>
              <label style={LABEL_STYLE}>Specialties *</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {SPECIALTIES.map((s) => {
                  const active = specialties.includes(s);
                  return (
                    <label
                      key={s}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        fontSize: 13,
                        color: active ? TEXT : DIM,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggle(specialties, s, setSpecialties)}
                        style={{ accentColor: ACCENT, width: 16, height: 16 }}
                      />
                      {s}
                    </label>
                  );
                })}
              </div>
            </FieldRow>

            <FieldRow>
              <label style={LABEL_STYLE}>Public links</label>
              <textarea
                value={publicLinks}
                onChange={(e) => setPublicLinks(e.target.value)}
                placeholder="Twitter, GitHub, blog — one per line"
                rows={3}
                style={{ ...INPUT_STYLE, resize: "vertical", fontFamily: "monospace" }}
              />
            </FieldRow>

            <FieldRow>
              <label style={LABEL_STYLE}>Your investigative background *</label>
              <textarea
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                rows={5}
                style={{ ...INPUT_STYLE, resize: "vertical" }}
                required
              />
            </FieldRow>

            <FieldRow>
              <label style={LABEL_STYLE}>Why do you want to join INTERLIGENS? *</label>
              <textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                rows={5}
                style={{ ...INPUT_STYLE, resize: "vertical" }}
                required
              />
            </FieldRow>

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
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
