"use client";

/**
 * src/app/submit/SubmitForm.tsx
 *
 * SPRINT C1 — Formulaire client de soumission retail (rendu uniquement quand la
 * porte est ouverte). Upload 1-3 captures + URL tweet optionnelle + contexte
 * optionnel + widget Turnstile (si site key). Poste en multipart vers
 * /api/osint/submit, n'attend JAMAIS la vision (réponse 202 immédiate), affiche
 * le submissionId + le statut, et permet de re-vérifier le statut.
 *
 * Copie d'abus OBLIGATOIRE (exigence GPT) affichée avant le bouton. Design system :
 * fond noir, accent orange #FF6B00, jamais de cyan, zéro emoji.
 */

import { useEffect, useRef, useState } from "react";

const C = {
  accent: "#FF6B00",
  text: "#FFFFFF",
  danger: "#FF3B5C",
  warning: "#FFB800",
  safe: "#00FF94",
  dim: "#8A8A8A",
  line: "#1C1C1C",
  panel: "#0A0A0A",
  field: "#070707",
};

const MAX_IMAGES = 3;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

const eyebrow: React.CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.24em",
  fontWeight: 900,
  fontSize: 10,
  color: C.dim,
};
const mono: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };

declare global {
  interface Window {
    onTurnstileToken?: (token: string) => void;
    onTurnstileReset?: () => void;
  }
}

type Submitted = { submissionId: string; status: string; images: number };

export function SubmitForm({ siteKey }: { siteKey: string | null }) {
  const [files, setFiles] = useState<File[]>([]);
  const [tweetUrl, setTweetUrl] = useState("");
  const [context, setContext] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Submitted | null>(null);
  const [statusCheck, setStatusCheck] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.onTurnstileToken = (t: string) => setToken(t);
    window.onTurnstileReset = () => setToken(null);
    return () => {
      window.onTurnstileToken = undefined;
      window.onTurnstileReset = undefined;
    };
  }, []);

  function pickFiles(list: FileList | null) {
    setError(null);
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (!ACCEPT.includes(f.type)) {
        setError(`Unsupported file type: ${f.name}. PNG, JPG or WebP only.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError(`${f.name} is larger than 10 MB.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next.slice(0, MAX_IMAGES));
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setError(null);
    if (files.length < 1) {
      setError("Add at least one screenshot.");
      return;
    }
    if (siteKey && !token) {
      setError("Please complete the verification challenge.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("images", f);
      if (tweetUrl.trim()) fd.append("tweetUrl", tweetUrl.trim());
      if (context.trim()) fd.append("context", context.trim());
      if (token) fd.append("cf-turnstile-response", token);

      const resp = await fetch("/api/osint/submit", { method: "POST", body: fd });
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 202) {
        setDone({ submissionId: data.submissionId, status: data.status, images: data.images });
        setFiles([]);
        setTweetUrl("");
        setContext("");
        window.onTurnstileReset?.();
      } else if (resp.status === 403 && data.error === "submissions_closed") {
        setError("Submissions are closed right now.");
      } else if (resp.status === 403 && data.error === "turnstile_failed") {
        setError("Verification failed. Reload the page and try again.");
        setToken(null);
      } else if (resp.status === 429) {
        setError("You have reached the daily submission limit. Try again tomorrow.");
      } else if (resp.status === 413) {
        setError("One of your images is too large (10 MB max).");
      } else {
        setError(data.detail || data.error || "Something went wrong. Try again later.");
      }
    } catch {
      setError("Network error. Try again later.");
    } finally {
      setBusy(false);
    }
  }

  async function checkStatus() {
    if (!done) return;
    setStatusCheck("checking…");
    try {
      const resp = await fetch(`/api/osint/submission/${done.submissionId}`);
      const data = await resp.json().catch(() => ({}));
      setStatusCheck(resp.ok ? String(data.status) : "not found");
    } catch {
      setStatusCheck("network error");
    }
  }

  // ── Vue post-soumission ─────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.safe}`, background: C.panel, borderRadius: 8, padding: "26px 28px" }}>
        <p style={{ ...eyebrow, color: C.safe, marginBottom: 12 }}>Received</p>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 8px" }}>Your submission is in the queue.</h2>
        <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>
          {done.images} image{done.images > 1 ? "s" : ""} received. Processing is asynchronous and not
          guaranteed to be immediate. Nothing has been published.
        </p>
        <div style={{ ...mono, fontSize: 12, background: C.field, border: `1px solid ${C.line}`, borderRadius: 6, padding: "12px 14px", marginBottom: 16, wordBreak: "break-all" }}>
          <div style={{ color: C.dim, marginBottom: 6 }}>reference</div>
          <div style={{ color: C.accent }}>{done.submissionId}</div>
          <div style={{ color: C.dim, marginTop: 10 }}>status</div>
          <div>{statusCheck ?? done.status}</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={checkStatus} style={btnGhost}>Refresh status</button>
          <button onClick={() => { setDone(null); setStatusCheck(null); }} style={btnGhost}>Submit another</button>
        </div>
      </div>
    );
  }

  // ── Formulaire ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Upload */}
      <section>
        <label style={{ ...eyebrow, display: "block", marginBottom: 10 }}>1 — Screenshots (1 to 3)</label>
        <div
          onClick={() => fileRef.current?.click()}
          style={{ border: `1px dashed ${C.line}`, borderRadius: 8, background: C.field, padding: "26px 20px", textAlign: "center", cursor: "pointer" }}
        >
          <span style={{ color: C.accent, fontWeight: 800, fontSize: 14 }}>Choose images</span>
          <span style={{ color: C.dim, fontSize: 12, display: "block", marginTop: 6 }}>PNG, JPG or WebP · 10 MB max each</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          onChange={(e) => pickFiles(e.target.files)}
          style={{ display: "none" }}
        />
        {files.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
            {files.map((f, i) => (
              <li key={i} style={{ ...mono, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 12px" }}>
                <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 10 }}>{f.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: C.dim }}>{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button onClick={() => removeFile(i)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontWeight: 900, fontSize: 12 }}>remove</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tweet URL */}
      <section>
        <label style={{ ...eyebrow, display: "block", marginBottom: 10 }}>2 — Tweet URL (optional)</label>
        <input
          value={tweetUrl}
          onChange={(e) => setTweetUrl(e.target.value)}
          placeholder="https://x.com/..."
          style={inputStyle}
        />
      </section>

      {/* Context */}
      <section>
        <label style={{ ...eyebrow, display: "block", marginBottom: 10 }}>3 — Context (optional)</label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="What is this? Who is calling what?"
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </section>

      {/* Turnstile */}
      {siteKey ? (
        <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" data-callback="onTurnstileToken" data-expired-callback="onTurnstileReset" data-error-callback="onTurnstileReset" />
      ) : (
        <p style={{ color: C.dim, fontSize: 11 }}>Verification is not configured in this environment.</p>
      )}

      {/* ── COPIE D'ABUS OBLIGATOIRE ─────────────────────────────────────────── */}
      <section style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.warning}`, background: C.panel, borderRadius: 8, padding: "16px 18px" }}>
        <p style={{ ...eyebrow, color: C.warning, marginBottom: 10 }}>Before you submit</p>
        <p style={{ color: C.dim, fontSize: 12.5, lineHeight: 1.7, margin: 0 }}>
          INTERLIGENS ne garantit pas l&apos;analyse immédiate · soumettre ne publie rien · n&apos;envoyez
          JAMAIS seed phrase, clés privées, documents d&apos;identité, conversations privées · toute donnée
          peut être conservée pour audit interne · pas d&apos;asset recovery, pas de conseil juridique.
        </p>
      </section>

      {error && (
        <p style={{ color: C.danger, fontSize: 13, fontWeight: 700, margin: 0 }}>{error}</p>
      )}

      <button onClick={submit} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}>
        {busy ? "Sending…" : "Submit for review"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#070707",
  border: "1px solid #1C1C1C",
  borderRadius: 6,
  padding: "12px 14px",
  color: "#FFFFFF",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  background: "#FF6B00",
  color: "#000000",
  border: "none",
  borderRadius: 6,
  padding: "14px 20px",
  fontWeight: 900,
  fontSize: 14,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "#FF6B00",
  border: "1px solid #FF6B00",
  borderRadius: 6,
  padding: "10px 16px",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  cursor: "pointer",
};
