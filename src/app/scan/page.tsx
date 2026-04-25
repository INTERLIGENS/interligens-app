"use client";

import React, { useState, useCallback } from "react";
import ScoreCard from "@/components/scan/ScoreCard";
import AdvancedSignals from "@/components/scan/AdvancedSignals";
import type { PublicScoreResponse } from "@/lib/publicScore/schema";

type FeedbackType = "false_positive" | "missing_info" | "scam_report";

export default function ScanPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProjectInfo, setShowProjectInfo] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("scam_report");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const submitFeedback = useCallback(async () => {
    if (feedbackSubmitting) return;
    const msg = feedbackMessage.trim();
    if (!msg) {
      setFeedbackError("Please enter a message.");
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: feedbackType,
          message: msg,
          address: input.trim() || undefined,
          page: "/scan",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setFeedbackError("Too many reports. Please wait a minute.");
        } else {
          setFeedbackError(typeof data.error === "string" ? data.error : "Submission failed.");
        }
        return;
      }
      setFeedbackDone(true);
    } catch {
      setFeedbackError("Network error. Please try again.");
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [feedbackMessage, feedbackType, feedbackSubmitting, input]);

  const closeFeedback = () => {
    setFeedbackOpen(false);
    setTimeout(() => {
      setFeedbackDone(false);
      setFeedbackMessage("");
      setFeedbackError(null);
    }, 250);
  };

  const handleScan = useCallback(async () => {
    const mint = input.trim();
    if (!mint) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/v1/score?mint=${encodeURIComponent(mint)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? data.error ?? "Unknown error");
        return;
      }

      setResult(data as PublicScoreResponse);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleScan();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "monospace",
        color: "#FFFFFF",
        padding: "0 16px",
      }}
    >
      {/* Header */}
      <header style={{ textAlign: "center", paddingTop: 60, marginBottom: 40 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#FF6B00", letterSpacing: 2 }}>
          INTERLIGENS
        </div>
        <div style={{ fontSize: 14, color: "#888", marginTop: 8 }}>
          Scan before you swap
        </div>
      </header>

      {/* Input */}
      <div
        style={{
          display: "flex",
          gap: 8,
          width: "100%",
          maxWidth: 520,
          marginBottom: 32,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste a Solana token address or name"
          disabled={loading}
          style={{
            flex: 1,
            minWidth: 0,
            background: "#111118",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "12px 16px",
            color: "#fff",
            fontSize: 14,
            fontFamily: "monospace",
            outline: "none",
          }}
        />
        <button
          onClick={handleScan}
          disabled={loading || !input.trim()}
          style={{
            background: loading ? "#994000" : "#FF6B00",
            color: "#000",
            fontWeight: 700,
            fontSize: 14,
            padding: "12px 24px",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "wait" : "pointer",
            fontFamily: "monospace",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "SCANNING..." : "SCAN"}
        </button>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "3px solid #222",
              borderTop: "3px solid #FF6B00",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            color: "#FF3B5C",
            fontSize: 13,
            marginBottom: 24,
            textAlign: "center",
            maxWidth: 480,
          }}
        >
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ width: "100%", maxWidth: 520, marginBottom: 32 }}>
          <ScoreCard data={result} locale="en" />

          {/* PROJECT INFO DROPDOWN */}
          {(() => {
            const r = result as Record<string, unknown> & {
              ext?: Record<string, unknown>;
              meta?: Record<string, unknown>;
              info?: Record<string, unknown>;
              extensions?: Record<string, unknown>;
            };
            const pick = (k: string): string | null => {
              const v =
                (r?.[k] as string | undefined) ??
                (r?.ext?.[k] as string | undefined) ??
                (r?.meta?.[k] as string | undefined) ??
                (r?.info?.[k] as string | undefined) ??
                (r?.extensions?.[k] as string | undefined);
              return typeof v === "string" && v.trim() ? v : null;
            };
            const site = pick("website");
            const wp = pick("whitepaper");
            const tw = pick("twitter") ?? pick("twitter_username");
            const tg = pick("telegram");
            const hasAny = !!(site || wp || tw || tg);

            const linkRow = (label: string, href: string, display: string) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>{label}</span>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11,
                    color: "#aaa",
                    textDecoration: "none",
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {display}
                </a>
              </div>
            );

            return (
              <div
                style={{
                  marginTop: 16,
                  background: "#111118",
                  border: "1px solid #2a2a34",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setShowProjectInfo((v) => !v)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "#666",
                    fontSize: 11,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  <span>PROJECT INFO</span>
                  <span
                    style={{
                      display: "inline-block",
                      transform: showProjectInfo ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 200ms ease",
                      fontSize: 10,
                    }}
                  >
                    ▾
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: showProjectInfo ? 240 : 0,
                    overflow: "hidden",
                    transition: "max-height 220ms ease",
                  }}
                >
                  <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {!hasAny && (
                      <div style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>
                        No project info available
                      </div>
                    )}
                    {site && linkRow("Website", site.startsWith("http") ? site : `https://${site}`, site.replace(/^https?:\/\//, ""))}
                    {wp && linkRow("Whitepaper", wp.startsWith("http") ? wp : `https://${wp}`, "View →")}
                    {tw && linkRow("X / Twitter", tw.startsWith("http") ? tw : `https://x.com/${tw.replace("@", "")}`, tw.replace(/^https?:\/\/(x\.com|twitter\.com)\//, "@"))}
                    {tg && linkRow("Telegram", tg.startsWith("http") ? tg : `https://t.me/${tg.replace("@", "")}`, tg)}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ADVANCED SIGNALS */}
          <AdvancedSignals
            website={result.website}
            pairAgeDays={result.pairAgeDays}
            liquidityUsd={result.liquidityUsd}
            mintAuthority={result.mintAuthority}
            freezeAuthority={result.freezeAuthority}
            topHolderPct={result.topHolderPct}
            signals={result.signals.map((s) => ({ id: s.id, label: s.label, severity: s.severity }))}
          />

          {/* B3 — Swap anyway CTA */}
          <div
            style={{
              textAlign: "center",
              marginTop: 20,
              fontSize: 12,
              color: "#555",
            }}
          >
            <span style={{ color: "#FF6B00" }}>!</span>{" "}
            Proceeding at your own risk?{" "}
            <a
              href="https://jup.ag"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#666", textDecoration: "underline" }}
            >
              Swap on Jupiter
            </a>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        style={{
          marginTop: "auto",
          paddingBottom: 24,
          textAlign: "center",
          fontSize: 11,
          color: "#333",
        }}
      >
        Powered by INTERLIGENS | app.interligens.com
      </footer>

      {/* FEEDBACK BUTTON — discreet bottom-right */}
      <button
        type="button"
        onClick={() => setFeedbackOpen(true)}
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          background: "#1a1a24",
          border: "1px solid #2a2a34",
          color: "#888",
          fontSize: 10,
          fontFamily: "monospace",
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          padding: "8px 14px",
          borderRadius: 6,
          cursor: "pointer",
          zIndex: 50,
        }}
        aria-label="Send feedback"
      >
        Feedback
      </button>

      {/* FEEDBACK MODAL */}
      {feedbackOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeFeedback}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0a0a12",
              border: "1px solid #2a2a34",
              borderRadius: 10,
              padding: 20,
              width: "100%",
              maxWidth: 420,
              fontFamily: "monospace",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "#888",
                }}
              >
                Send Feedback
              </span>
              <button
                type="button"
                onClick={closeFeedback}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#666",
                  fontSize: 18,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {feedbackDone ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px 0 12px",
                  color: "#aaa",
                  fontSize: 13,
                }}
              >
                Thank you. Signal received.
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={closeFeedback}
                    style={{
                      background: "transparent",
                      border: "1px solid #333",
                      color: "#888",
                      fontSize: 11,
                      fontFamily: "monospace",
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      padding: "8px 16px",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: "#666",
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Type
                </label>
                <select
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
                  disabled={feedbackSubmitting}
                  style={{
                    width: "100%",
                    background: "#111118",
                    border: "1px solid #333",
                    color: "#ddd",
                    fontSize: 13,
                    fontFamily: "monospace",
                    padding: "8px 10px",
                    borderRadius: 6,
                    marginBottom: 14,
                    outline: "none",
                  }}
                >
                  <option value="scam_report">Scam report</option>
                  <option value="false_positive">False positive</option>
                  <option value="missing_info">Missing info</option>
                </select>

                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: "#666",
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Message
                </label>
                <textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  disabled={feedbackSubmitting}
                  placeholder="Describe the token, profile, or issue…"
                  rows={5}
                  maxLength={3000}
                  style={{
                    width: "100%",
                    background: "#111118",
                    border: "1px solid #333",
                    color: "#fff",
                    fontSize: 13,
                    fontFamily: "monospace",
                    padding: 10,
                    borderRadius: 6,
                    marginBottom: 12,
                    resize: "vertical",
                    outline: "none",
                  }}
                />

                {feedbackError && (
                  <div style={{ color: "#FF3B5C", fontSize: 12, marginBottom: 10 }}>
                    {feedbackError}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={closeFeedback}
                    disabled={feedbackSubmitting}
                    style={{
                      background: "transparent",
                      border: "1px solid #333",
                      color: "#888",
                      fontSize: 11,
                      fontFamily: "monospace",
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      padding: "8px 14px",
                      borderRadius: 6,
                      cursor: feedbackSubmitting ? "wait" : "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitFeedback}
                    disabled={feedbackSubmitting || !feedbackMessage.trim()}
                    style={{
                      background: feedbackSubmitting ? "#444" : "#FF6B00",
                      border: "none",
                      color: "#000",
                      fontSize: 11,
                      fontFamily: "monospace",
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      padding: "8px 14px",
                      borderRadius: 6,
                      cursor: feedbackSubmitting ? "wait" : "pointer",
                      opacity: !feedbackMessage.trim() ? 0.5 : 1,
                    }}
                  >
                    {feedbackSubmitting ? "Sending…" : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
