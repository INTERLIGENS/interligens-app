"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  deriveKeys,
  hashNdaDocument,
  randomSaltHex,
} from "@/lib/vault/crypto.client";
import { setVaultSession } from "@/lib/vault/session.client";

type Step = 1 | 2 | 3 | 4;

const SPECIALTY_OPTIONS = [
  "Solana Forensics",
  "EVM Forensics",
  "CEX Trails",
  "KOL Analysis",
  "DeFi Rug Analysis",
  "Social Engineering",
  "NFT Fraud",
  "Cross-chain Bridges",
  "Other",
];

const VISIBILITY_OPTIONS: {
  value: "PRIVATE" | "SEMI_PUBLIC" | "PUBLIC";
  label: string;
  helper: string;
}[] = [
  {
    value: "PRIVATE",
    label: "Private",
    helper: "Your profile is not listed",
  },
  {
    value: "SEMI_PUBLIC",
    label: "Listed",
    helper: "Visible in the directory, no contact info shown",
  },
  {
    value: "PUBLIC",
    label: "Public",
    helper: "Visible with contact information",
  },
];

const LABEL_STYLE: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.4)",
  display: "block",
  marginBottom: 8,
};

const HELPER_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.5)",
  marginTop: 6,
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 6,
  padding: "12px 14px",
  color: "#FFFFFF",
  fontSize: 14,
  outline: "none",
};

const PRIMARY_BTN: React.CSSProperties = {
  backgroundColor: "#FF6B00",
  color: "#FFFFFF",
  height: 44,
  borderRadius: 6,
  fontWeight: 500,
  fontSize: 14,
  paddingLeft: 20,
  paddingRight: 20,
};

const FIELD_ERROR_STYLE: React.CSSProperties = {
  color: "#ff6b6b",
  fontSize: 12,
  marginTop: 6,
};

function renderNda(md: string) {
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(<div key={i} style={{ height: 8 }} />);
      return;
    }
    if (trimmed.startsWith("## ")) {
      out.push(
        <h2
          key={i}
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#FFFFFF",
            marginTop: 18,
            marginBottom: 8,
          }}
        >
          {trimmed.replace(/^##\s+/, "")}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith("# ")) {
      out.push(
        <h1
          key={i}
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "#FFFFFF",
            marginTop: 20,
            marginBottom: 10,
          }}
        >
          {trimmed.replace(/^#\s+/, "")}
        </h1>
      );
      return;
    }
    if (trimmed.startsWith("### ")) {
      out.push(
        <h3
          key={i}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            marginTop: 14,
            marginBottom: 6,
          }}
        >
          {trimmed.replace(/^###\s+/, "")}
        </h3>
      );
      return;
    }
    const parts = trimmed.split(/(\*\*[^*]+\*\*)/g).map((p, j) => {
      if (p.startsWith("**") && p.endsWith("**")) {
        return (
          <strong key={j} style={{ color: "#FFFFFF" }}>
            {p.slice(2, -2)}
          </strong>
        );
      }
      return <span key={j}>{p}</span>;
    });
    out.push(
      <p
        key={i}
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.7)",
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {parts}
      </p>
    );
  });
  return out;
}

function humanHandleError(code: string): string {
  if (code === "bad_handle")
    return "Only lowercase letters, numbers, and hyphens are allowed";
  if (code === "handle_taken") return "This handle is already taken";
  return "This handle is not valid";
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — NDA
  const [ndaText, setNdaText] = useState<string>("");
  const [signerName, setSignerName] = useState("");
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [ndaError, setNdaError] = useState<string | null>(null);

  // Step 2 — Profile
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<
    "PRIVATE" | "SEMI_PUBLIC" | "PUBLIC"
  >("PRIVATE");
  const [specialties, setSpecialties] = useState<string[]>([]);

  // Step 3 — Key
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understoodLoss, setUnderstoodLoss] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/investigators/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d?.profile) router.replace("/investigators/box");
      })
      .catch(() => {});
    fetch("/legal/investigator-nda-v1.md")
      .then((r) => r.text())
      .then(setNdaText)
      .catch(() =>
        setNdaText("NDA text unavailable. Refresh to retry.")
      );
  }, [router]);

  const passphraseStrength = useMemo(() => {
    const len = passphrase.length;
    if (len === 0) return { level: 0, color: "transparent" };
    if (len < 8) return { level: 1, color: "#ff4d4d" };
    if (len < 12) return { level: 2, color: "#FF6B00" };
    const hasMixed =
      /[a-z]/.test(passphrase) &&
      /[A-Z0-9]/.test(passphrase);
    if (len >= 12 && hasMixed) return { level: 3, color: "#22c55e" };
    return { level: 2, color: "#FF6B00" };
  }, [passphrase]);

  async function submitNda() {
    setNdaError(null);
    if (!signerName.trim()) {
      setNdaError("Please enter your full legal name.");
      return;
    }
    if (!ndaAccepted) {
      setNdaError("You must accept the agreement to continue.");
      return;
    }
    if (!ndaText) {
      setNdaError("NDA failed to load. Refresh the page.");
      return;
    }
    setLoading(true);
    try {
      const ndaDocHash = await hashNdaDocument(ndaText);
      const res = await fetch("/api/investigators/onboarding/nda", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signerName,
          ndaVersion: "v1.0",
          ndaDocHash,
          accepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNdaError("Could not save your signature. Please try again.");
        return;
      }
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  function submitProfile() {
    setHandleError(null);
    if (!/^[a-z0-9-]{2,30}$/.test(handle)) {
      setHandleError(humanHandleError("bad_handle"));
      return;
    }
    setStep(3);
  }

  function toggleSpecialty(s: string) {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function submitKey() {
    setKeyError(null);
    if (passphrase.length < 12) {
      setKeyError("Passphrase must be at least 12 characters.");
      return;
    }
    if (passphrase !== confirm) {
      setKeyError("Passphrases do not match.");
      return;
    }
    if (!understoodLoss) {
      setKeyError(
        "You must acknowledge that losing your passphrase means permanent data loss."
      );
      return;
    }
    setLoading(true);
    try {
      const kdfSalt = randomSaltHex();
      const keys = await deriveKeys(passphrase, kdfSalt);
      await setVaultSession(keys);

      const res = await fetch("/api/investigators/onboarding/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handle,
          displayName,
          bio,
          specialties,
          visibility,
          kdfSalt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "handle_taken") {
          setHandleError(humanHandleError("handle_taken"));
          setStep(2);
          return;
        }
        setKeyError("Could not create your workspace. Please try again.");
        return;
      }
      setStep(4);
    } catch {
      setKeyError("Key derivation failed in this browser. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto px-6 py-16" style={{ maxWidth: 672 }}>
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          INTERLIGENS INVESTIGATORS
        </div>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: "#FFFFFF",
            marginTop: 8,
          }}
        >
          Workspace onboarding
        </h1>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            marginTop: 6,
            marginBottom: 32,
          }}
        >
          Step {step} of 4
        </div>

        {step === 1 && (
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#FFFFFF",
                marginBottom: 16,
              }}
            >
              Mutual Non-Disclosure Agreement
            </h2>
            <div
              style={{
                backgroundColor: "#0a0a0a",
                border: "1px solid rgba(255,107,0,0.15)",
                borderRadius: 6,
                padding: 24,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {ndaText ? (
                renderNda(ndaText)
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  Loading…
                </div>
              )}
            </div>

            <div style={{ marginTop: 24 }}>
              <label style={LABEL_STYLE}>Your full name</label>
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Full legal name"
                style={INPUT_STYLE}
                onFocus={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,107,0,0.6)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.08)")
                }
              />
            </div>

            <label
              className="flex items-start gap-3"
              style={{
                marginTop: 20,
                fontSize: 13,
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.6,
              }}
            >
              <input
                type="checkbox"
                checked={ndaAccepted}
                onChange={(e) => setNdaAccepted(e.target.checked)}
                className="mt-1"
                style={{ accentColor: "#FF6B00" }}
              />
              <span>
                I accept the terms of this Mutual Non-Disclosure Agreement
              </span>
            </label>

            {ndaError && <div style={FIELD_ERROR_STYLE}>{ndaError}</div>}

            <button
              onClick={submitNda}
              disabled={loading}
              className="disabled:opacity-50"
              style={{ ...PRIMARY_BTN, marginTop: 24 }}
            >
              {loading ? "Signing…" : "Sign and proceed"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#FFFFFF",
                marginBottom: 24,
              }}
            >
              Your profile
            </h2>

            <div style={{ marginBottom: 20 }}>
              <label style={LABEL_STYLE}>Handle</label>
              <input
                value={handle}
                onChange={(e) =>
                  setHandle(
                    e.target.value.toLowerCase().replace(/[@\s]/g, "")
                  )
                }
                placeholder="analyst-01"
                style={INPUT_STYLE}
                onFocus={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,107,0,0.6)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.08)")
                }
              />
              <div style={HELPER_STYLE}>
                Lowercase letters, numbers, and hyphens only. No @ symbol
                needed.
              </div>
              {handleError && (
                <div style={FIELD_ERROR_STYLE}>{handleError}</div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={LABEL_STYLE}>Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={INPUT_STYLE}
                onFocus={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,107,0,0.6)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.08)")
                }
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={LABEL_STYLE}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                style={{ ...INPUT_STYLE, resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={LABEL_STYLE}>Specialties</label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTY_OPTIONS.map((s) => {
                  const selected = specialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      style={{
                        fontSize: 12,
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: selected
                          ? "1px solid #FF6B00"
                          : "1px solid rgba(255,255,255,0.12)",
                        backgroundColor: selected
                          ? "rgba(255,107,0,0.15)"
                          : "transparent",
                        color: selected
                          ? "#FFFFFF"
                          : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={LABEL_STYLE}>Visibility</label>
              <div className="flex flex-col gap-2">
                {VISIBILITY_OPTIONS.map((v) => {
                  const selected = visibility === v.value;
                  return (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => setVisibility(v.value)}
                      className="text-left"
                      style={{
                        padding: "12px 16px",
                        borderRadius: 6,
                        border: selected
                          ? "1px solid #FF6B00"
                          : "1px solid rgba(255,255,255,0.12)",
                        backgroundColor: selected
                          ? "rgba(255,107,0,0.15)"
                          : "transparent",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          color: "#FFFFFF",
                          fontWeight: 500,
                        }}
                      >
                        {v.label}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.4)",
                          marginTop: 2,
                        }}
                      >
                        {v.helper}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button onClick={submitProfile} style={PRIMARY_BTN}>
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#FFFFFF",
                marginBottom: 20,
              }}
            >
              Create your key
            </h2>

            <div
              style={{
                border: "1px solid rgba(255,107,0,0.3)",
                backgroundColor: "rgba(255,107,0,0.04)",
                borderRadius: 6,
                padding: 20,
                marginBottom: 28,
                fontSize: 13,
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.7,
              }}
            >
              Titles, filenames, tags, notes, and raw contents are encrypted
              before they reach our servers. We receive only opaque encrypted
              data. We cannot read your work. If you lose your passphrase,
              your data is permanently inaccessible. We cannot recover it —
              we do not hold your key.
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={LABEL_STYLE}>Passphrase</label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                style={INPUT_STYLE}
                onFocus={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,107,0,0.6)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.08)")
                }
              />
              <div
                style={{
                  width: "100%",
                  height: 3,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  marginTop: 8,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(passphraseStrength.level / 3) * 100}%`,
                    height: "100%",
                    backgroundColor: passphraseStrength.color,
                    transition: "width 150ms ease",
                  }}
                />
              </div>
              <div style={HELPER_STYLE}>
                Use a long phrase you will remember. There is no reset
                option.
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={LABEL_STYLE}>Confirm passphrase</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={INPUT_STYLE}
                onFocus={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,107,0,0.6)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.08)")
                }
              />
            </div>

            <label
              className="flex items-start gap-3"
              style={{
                marginBottom: 20,
                fontSize: 13,
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.6,
              }}
            >
              <input
                type="checkbox"
                checked={understoodLoss}
                onChange={(e) => setUnderstoodLoss(e.target.checked)}
                className="mt-1"
                style={{ accentColor: "#FF6B00" }}
              />
              <span>
                I understand that losing my passphrase means permanent data
                loss
              </span>
            </label>

            {keyError && (
              <div style={{ ...FIELD_ERROR_STYLE, marginBottom: 16 }}>
                {keyError}
              </div>
            )}

            <button
              onClick={submitKey}
              disabled={loading}
              className="disabled:opacity-60"
              style={PRIMARY_BTN}
            >
              {loading
                ? "Generating your key in this browser…"
                : "Generate my key"}
            </button>
          </div>
        )}

        {step === 4 && (
          <div
            className="mx-auto"
            style={{ maxWidth: 480, paddingTop: 40 }}
          >
            <div className="flex flex-col items-center text-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="6"
                  y="14"
                  width="20"
                  height="14"
                  rx="2"
                  stroke="#FF6B00"
                  strokeWidth="1.5"
                />
                <path
                  d="M10 14V10C10 7.79 11.79 6 14 6h4c2.21 0 4 1.79 4 4v4"
                  stroke="#FF6B00"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="16" cy="21" r="2" fill="#FF6B00" />
              </svg>
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  marginTop: 24,
                }}
              >
                Your vault is sealed.
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.5)",
                  marginTop: 8,
                  lineHeight: 1.6,
                }}
              >
                Your workspace is now active and encrypted with a key only
                you hold.
              </p>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                margin: "40px 0",
              }}
            />

            <div
              style={{
                textTransform: "uppercase",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 16,
              }}
            >
              What this means
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 2,
              }}
            >
              <div>
                →&nbsp;&nbsp;Everything you deposit is encrypted before it
                leaves your device.
              </div>
              <div>→&nbsp;&nbsp;We cannot read your work.</div>
              <div>
                →&nbsp;&nbsp;If you lose your passphrase, your data is gone.
                By design.
              </div>
              <div>
                →&nbsp;&nbsp;Your cases belong to you. Not to us.
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                margin: "40px 0 24px",
              }}
            />

            <div
              style={{
                textTransform: "uppercase",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.5)",
                marginBottom: 16,
              }}
            >
              How your box works
            </div>
            <div className="flex flex-col gap-3" style={{ marginBottom: 32 }}>
              {[
                {
                  icon: (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FF6B00"
                      strokeWidth="1.5"
                    >
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  ),
                  text: "Your raw files and notes are encrypted in your browser. We receive only opaque ciphertext.",
                },
                {
                  icon: (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FF6B00"
                      strokeWidth="1.5"
                    >
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <rect x="9" y="9" width="6" height="6" />
                      <line x1="9" y1="1" x2="9" y2="4" />
                      <line x1="15" y1="1" x2="15" y2="4" />
                      <line x1="9" y1="20" x2="9" y2="23" />
                      <line x1="15" y1="20" x2="15" y2="23" />
                    </svg>
                  ),
                  text: "Our intelligence engine works from derived entities only — wallets, handles, hashes you choose to extract.",
                },
                {
                  icon: (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FF6B00"
                      strokeWidth="1.5"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ),
                  text: "Your assistant sees derived data only. Never your notes. Never your files.",
                },
                {
                  icon: (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FF6B00"
                      strokeWidth="1.5"
                    >
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  ),
                  text: "Sharing and publishing are always opt-in. Nothing leaves your box without your explicit action.",
                },
              ].map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ marginTop: 2, flexShrink: 0 }}>
                    {row.icon}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.6)",
                      lineHeight: 1.6,
                    }}
                  >
                    {row.text}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                margin: "0 0 24px",
              }}
            />

            <button
              onClick={() => router.push("/investigators/box")}
              className="w-full"
              style={PRIMARY_BTN}
            >
              Enter your workspace →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
