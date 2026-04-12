"use client";

const BG = "#0A0C10";
const SURFACE = "#111318";
const BORDER = "#1E2028";
const BRAND = "#F85B05";
const CYAN = "#FF6B00";
const TEXT = "#F9FAFB";
const MUTED = "#6B7280";
const DIMMED = "#3B3F4A";

export default function BetaAccessLanding() {
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
      <div
        style={{
          width: 460,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: 40,
          textAlign: "center",
        }}
      >
        {/* Branding */}
        <div
          style={{
            color: BRAND,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.25em",
            fontFamily: "monospace",
            marginBottom: 8,
          }}
        >
          INTERLIGENS
        </div>
        <h1 style={{ color: TEXT, fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
          Beta Access
        </h1>
        <p
          style={{
            color: MUTED,
            fontSize: 13,
            lineHeight: 1.6,
            margin: "0 0 28px",
            maxWidth: 360,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          This platform is available under NDA to authorized participants only.
          Proceed to review the confidentiality agreement and enter your access code.
        </p>

        {/* Status badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {[
            { label: "PRIVATE BETA", color: BRAND },
            { label: "NDA REQUIRED", color: CYAN },
            { label: "INVITE ONLY", color: "#FF3B5C" },
          ].map((b) => (
            <span
              key={b.label}
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.08em",
                fontFamily: "monospace",
                background: b.color + "12",
                color: b.color,
                border: `1px solid ${b.color}25`,
              }}
            >
              {b.label}
            </span>
          ))}
        </div>

        {/* CTA */}
        <a
          href="/access/nda"
          style={{
            display: "inline-block",
            padding: "14px 40px",
            background: BRAND,
            color: BG,
            border: "none",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.12em",
            fontFamily: "monospace",
            textDecoration: "none",
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
        >
          CONTINUE TO NDA &amp; ACCESS
        </a>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 24,
          color: DIMMED,
          fontSize: 9,
          fontFamily: "monospace",
          letterSpacing: "0.1em",
          textAlign: "center",
          lineHeight: 1.8,
        }}
      >
        CONFIDENTIAL &middot; AUTHORIZED ACCESS ONLY
        <br />
        INTERLIGENS INTELLIGENCE PLATFORM
      </div>
    </div>
  );
}
