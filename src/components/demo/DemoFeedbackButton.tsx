"use client";
// Demo-context feedback button — shows on /en/demo and /fr/demo.
// Posts to /api/v1/feedback (beta session auth, no vault required).

import { usePathname } from "next/navigation";
import { useState } from "react";

const LABELS = {
  en: {
    button: "Feedback",
    title: "Send feedback",
    subtitle: "Goes directly to the team.",
    placeholder: "What's missing? What's confusing? What would help?",
    send: "Send",
    sending: "Sending…",
    cancel: "Cancel",
    sent: "Sent. Thank you.",
    types: [
      { value: "feedback", label: "General feedback" },
      { value: "wrong_result", label: "Wrong scan result" },
      { value: "missing_chain", label: "Missing chain / token" },
      { value: "bug", label: "Bug" },
    ],
  },
  fr: {
    button: "Feedback",
    title: "Envoyer un feedback",
    subtitle: "Va directement à l'équipe.",
    placeholder: "Qu'est-ce qui manque ? Qu'est-ce qui est confus ? Qu'est-ce qui aiderait ?",
    send: "Envoyer",
    sending: "Envoi…",
    cancel: "Annuler",
    sent: "Envoyé. Merci.",
    types: [
      { value: "feedback", label: "Feedback général" },
      { value: "wrong_result", label: "Résultat incorrect" },
      { value: "missing_chain", label: "Chain / token manquant" },
      { value: "bug", label: "Bug" },
    ],
  },
};

export default function DemoFeedbackButton() {
  const pathname = usePathname();
  const locale = pathname?.startsWith("/fr") ? "fr" : "en";
  const t = LABELS[locale];

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("feedback");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pathname?.match(/\/(en|fr)\/demo/)) return null;

  async function send() {
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), type, page: pathname }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => { setOpen(false); setSent(false); setMessage(""); }, 2200);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Send failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 100,
          backgroundColor: "rgba(255,107,0,0.12)",
          border: "1px solid rgba(255,107,0,0.35)",
          color: "#FF6B00", fontSize: 11, fontWeight: 800,
          padding: "8px 16px", borderRadius: 20, cursor: "pointer",
          fontFamily: "inherit", letterSpacing: "0.1em", textTransform: "uppercase",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        {t.button}
      </button>

      {open && (
        <div
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.72)",
            zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{
              backgroundColor: "#0a0a0a", border: "1px solid rgba(255,107,0,0.2)",
              borderRadius: 8, padding: 24, maxWidth: 440, width: "100%",
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{t.title}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>{t.subtitle}</p>

            {sent ? (
              <div style={{ padding: 16, backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 6, color: "#4ADE80", fontSize: 13 }}>
                {t.sent}
              </div>
            ) : (
              <>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  style={{ width: "100%", backgroundColor: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "8px 12px", color: "#fff", fontSize: 12, marginBottom: 8, fontFamily: "inherit" }}
                >
                  {t.types.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.placeholder}
                  style={{ width: "100%", height: 130, backgroundColor: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                />
                {error && <p style={{ color: "#FF3B5C", fontSize: 12, marginTop: 6 }}>{error}</p>}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
                  <button
                    onClick={send}
                    disabled={sending || !message.trim()}
                    style={{ backgroundColor: "#FF6B00", color: "#fff", height: 38, borderRadius: 6, fontSize: 13, padding: "0 18px", border: "none", cursor: "pointer", opacity: sending || !message.trim() ? 0.5 : 1 }}
                  >
                    {sending ? t.sending : t.send}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}
                  >
                    {t.cancel}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
