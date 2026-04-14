"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.1)";
const SURFACE = "#0a0a0a";

type Lang = "en" | "fr";

type LegalDoc = {
  content: string;
  hash: string;
  version: string;
  language: string;
};

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function InvestigatorLegalOnboardingPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");

  const [ndaDoc, setNdaDoc] = useState<LegalDoc | null>(null);
  const [termsDoc, setTermsDoc] = useState<LegalDoc | null>(null);
  const [ndaHash, setNdaHash] = useState<string>("");
  const [termsHash, setTermsHash] = useState<string>("");

  const [ndaScrolledEnd, setNdaScrolledEnd] = useState(false);
  const [termsScrolledEnd, setTermsScrolledEnd] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signerName, setSignerName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ndaBoxRef = useRef<HTMLDivElement>(null);
  const termsBoxRef = useRef<HTMLDivElement>(null);

  // Fetch both documents whenever the language changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ndaRes, termsRes] = await Promise.all([
          fetch(`/api/investigators/legal/doc?type=nda&lang=${lang}&version=1.0`),
          fetch(`/api/investigators/legal/doc?type=terms&lang=${lang}&version=1.0`),
        ]);
        if (cancelled) return;
        if (!ndaRes.ok || !termsRes.ok) {
          setError("Failed to load legal documents. Refresh the page.");
          return;
        }
        const nda = (await ndaRes.json()) as LegalDoc;
        const terms = (await termsRes.json()) as LegalDoc;
        if (cancelled) return;

        // Compute client-side hash on the exact text we'll display.
        const ndaClientHash = await sha256Hex(nda.content);
        const termsClientHash = await sha256Hex(terms.content);

        setNdaDoc(nda);
        setTermsDoc(terms);
        setNdaHash(ndaClientHash);
        setTermsHash(termsClientHash);

        // Reset scroll/accept state on language change
        setNdaScrolledEnd(false);
        setTermsScrolledEnd(false);
        setNdaAccepted(false);
        setTermsAccepted(false);
        setError(null);
      } catch {
        if (!cancelled) setError("Failed to load legal documents. Refresh the page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const handleNdaScroll = useCallback(() => {
    const el = ndaBoxRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setNdaScrolledEnd(true);
    }
  }, []);

  const handleTermsScroll = useCallback(() => {
    const el = termsBoxRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setTermsScrolledEnd(true);
    }
  }, []);

  const canSubmit =
    ndaAccepted && termsAccepted && signerName.trim().length > 0 && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !ndaDoc || !termsDoc) return;
    setError(null);
    setSubmitting(true);
    try {
      const ndaRes = await fetch("/api/investigators/nda/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          ndaVersion: ndaDoc.version,
          ndaLanguage: ndaDoc.language,
          ndaDocHash: ndaHash,
          accepted: true,
        }),
      });
      if (!ndaRes.ok) {
        const data = await ndaRes.json().catch(() => ({}));
        setError(data.error ?? "NDA acceptance failed");
        setSubmitting(false);
        return;
      }

      const termsRes = await fetch("/api/investigators/terms/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          termsVersion: termsDoc.version,
          termsLanguage: termsDoc.language,
          termsDocHash: termsHash,
          accepted: true,
        }),
      });
      if (!termsRes.ok) {
        const data = await termsRes.json().catch(() => ({}));
        setError(data.error ?? "Terms acceptance failed");
        setSubmitting(false);
        return;
      }

      router.push("/investigators/onboarding/identity");
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
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "60px 24px 120px" }}>
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
          INTERLIGENS · LEGAL ACCEPTANCE
        </div>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            marginBottom: 8,
          }}
        >
          Sign NDA & Beta Program Terms
        </h1>
        <p style={{ fontSize: 13, color: DIM, lineHeight: 1.7, marginBottom: 32 }}>
          Both documents must be read and accepted individually. Your acceptance
          is recorded with a cryptographic hash of the exact text you signed.
        </p>

        {/* Language selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
          {(["en", "fr"] as Lang[]).map((l) => {
            const active = lang === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                style={{
                  padding: "8px 20px",
                  border: `1px solid ${active ? ACCENT : LINE}`,
                  backgroundColor: active ? "rgba(255,107,0,0.12)" : "transparent",
                  color: active ? TEXT : DIM,
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  fontFamily: "monospace",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {l.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* NDA Section */}
        <section style={{ marginBottom: 48 }}>
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
            Non-Disclosure Agreement — V1.0
          </h2>
          <div
            ref={ndaBoxRef}
            onScroll={handleNdaScroll}
            style={{
              background: SURFACE,
              border: `1px solid ${LINE}`,
              padding: 20,
              maxHeight: 340,
              overflowY: "auto",
              fontSize: 12,
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              marginBottom: 8,
            }}
          >
            {ndaDoc?.content ?? "Loading…"}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              fontFamily: "monospace",
              marginBottom: 12,
            }}
          >
            Document hash: {ndaHash || "…"}
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: ndaScrolledEnd ? "pointer" : "not-allowed",
              opacity: ndaScrolledEnd ? 1 : 0.4,
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              disabled={!ndaScrolledEnd}
              checked={ndaAccepted}
              onChange={(e) => setNdaAccepted(e.target.checked)}
              style={{
                accentColor: ACCENT,
                width: 16,
                height: 16,
                marginTop: 2,
                flexShrink: 0,
              }}
            />
            <span>
              I have read and accept the Non-Disclosure Agreement (v1.0, {lang.toUpperCase()})
            </span>
          </label>
          {!ndaScrolledEnd && (
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                marginTop: 6,
                fontFamily: "monospace",
              }}
            >
              Scroll to the bottom of the document to enable acceptance.
            </div>
          )}
        </section>

        {/* Terms Section */}
        <section style={{ marginBottom: 48 }}>
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
            Beta Investigator Program Terms — V1.0
          </h2>
          <div
            ref={termsBoxRef}
            onScroll={handleTermsScroll}
            style={{
              background: SURFACE,
              border: `1px solid ${LINE}`,
              padding: 20,
              maxHeight: 340,
              overflowY: "auto",
              fontSize: 12,
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              marginBottom: 8,
            }}
          >
            {termsDoc?.content ?? "Loading…"}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              fontFamily: "monospace",
              marginBottom: 12,
            }}
          >
            Document hash: {termsHash || "…"}
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: termsScrolledEnd ? "pointer" : "not-allowed",
              opacity: termsScrolledEnd ? 1 : 0.4,
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              disabled={!termsScrolledEnd}
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              style={{
                accentColor: ACCENT,
                width: 16,
                height: 16,
                marginTop: 2,
                flexShrink: 0,
              }}
            />
            <span>
              I have read and accept the Beta Investigator Program Terms (v1.0, {lang.toUpperCase()})
            </span>
          </label>
          {!termsScrolledEnd && (
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                marginTop: 6,
                fontFamily: "monospace",
              }}
            >
              Scroll to the bottom of the document to enable acceptance.
            </div>
          )}
        </section>

        {/* Signer name */}
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
                fontFamily: "monospace",
              }}
            >
              Full name — as it will appear on record
            </label>
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="First Last"
              style={{
                width: "100%",
                backgroundColor: "#0d0d0d",
                border: `1px solid ${LINE}`,
                borderRadius: 4,
                padding: "12px 14px",
                color: TEXT,
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
              }}
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
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "16px 0",
              background: canSubmit ? ACCENT : "rgba(255,107,0,0.2)",
              color: BG,
              border: "none",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.15em",
              fontFamily: "monospace",
              textTransform: "uppercase",
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {submitting ? "Signing..." : "Sign and Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
