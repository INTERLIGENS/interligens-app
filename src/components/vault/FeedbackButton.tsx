"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type SR = {
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

function getRecognition(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  const Cls = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Cls) return null;
  const r = new Cls();
  r.continuous = true;
  r.interimResults = false;
  r.lang = "en-US";
  return r;
}

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recogRef = useRef<SR | null>(null);
  const [supportsVoice, setSupportsVoice] = useState(false);

  useEffect(() => {
    setSupportsVoice(getRecognition() !== null);
  }, []);

  // Only show on /investigators/box/* pages (not onboarding)
  if (!pathname?.startsWith("/investigators/box")) return null;

  const caseIdMatch = pathname.match(/\/cases\/([^/]+)/);
  const caseId = caseIdMatch?.[1];

  function startVoice() {
    const r = getRecognition();
    if (!r) return;
    recogRef.current = r;
    r.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript + " ";
      }
      setMessage((prev) => (prev ? prev + " " : "") + transcript.trim());
    };
    r.onend = () => setRecording(false);
    r.onerror = () => setRecording(false);
    r.start();
    setRecording(true);
  }

  function stopVoice() {
    recogRef.current?.stop();
    setRecording(false);
  }

  async function send() {
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/investigators/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: message.trim(), caseId }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          setSuccess(false);
          setMessage("");
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Send failed");
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
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 100,
          backgroundColor: "rgba(255,107,0,0.15)",
          border: "1px solid rgba(255,107,0,0.3)",
          color: "#FF6B00",
          fontSize: 12,
          padding: "8px 16px",
          borderRadius: 20,
          cursor: "pointer",
          pointerEvents: "auto",
          fontFamily: "inherit",
          lineHeight: 1.2,
        }}
      >
        Feedback
      </button>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            pointerEvents: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: "#0a0a0a",
              border: "1px solid rgba(255,107,0,0.2)",
              borderRadius: 8,
              padding: 24,
              maxWidth: 480,
              width: "100%",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#FFFFFF",
                marginBottom: 4,
              }}
            >
              Send feedback to INTERLIGENS
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                marginBottom: 16,
              }}
            >
              Your message goes directly to the team.
            </div>

            {success ? (
              <div
                style={{
                  padding: 16,
                  backgroundColor: "rgba(74,222,128,0.06)",
                  border: "1px solid rgba(74,222,128,0.3)",
                  borderRadius: 6,
                  color: "#4ADE80",
                  fontSize: 13,
                }}
              >
                Feedback sent. Thank you.
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's working? What's missing? What would make your work easier?"
                  autoComplete="off"
                  style={{
                    width: "100%",
                    height: 150,
                    backgroundColor: "#0d0d0d",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6,
                    padding: "10px 12px",
                    color: "#FFFFFF",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                    pointerEvents: "auto",
                    cursor: "text",
                  }}
                />
                {supportsVoice && (
                  <button
                    onClick={recording ? stopVoice : startVoice}
                    style={{
                      marginTop: 8,
                      backgroundColor: "transparent",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: recording ? "#FF6B00" : "rgba(255,255,255,0.7)",
                      borderRadius: 6,
                      fontSize: 12,
                      padding: "6px 12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                    {recording ? "Stop dictation" : "Start dictation"}
                  </button>
                )}
                {error && (
                  <div
                    style={{
                      color: "#FF3B5C",
                      fontSize: 12,
                      marginTop: 8,
                    }}
                  >
                    {error}
                  </div>
                )}
                <div className="flex items-center gap-3" style={{ marginTop: 16 }}>
                  <button
                    onClick={send}
                    disabled={sending || !message.trim()}
                    className="disabled:opacity-50"
                    style={{
                      backgroundColor: "#FF6B00",
                      color: "#FFFFFF",
                      height: 40,
                      borderRadius: 6,
                      fontSize: 13,
                      padding: "0 18px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {sending ? "Sending…" : "Send feedback"}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 12,
                      background: "none",
                      border: "none",
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
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
