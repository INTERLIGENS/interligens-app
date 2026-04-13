"use client";

import { useEffect, useState } from "react";

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
};

type ActiveShare = {
  id: string;
  expiresAt: string;
  createdAt: string;
};

type Hypothesis = {
  id: string;
  title: string;
  status: string;
  confidence: number;
};

type Props = {
  caseId: string;
  title: string;
  entities: Entity[];
  onClose: () => void;
};

const EXPIRY_OPTIONS = [
  { id: "1h", label: "1 hour" },
  { id: "24h", label: "24 hours" },
  { id: "7d", label: "7 days" },
];

export default function ShareCaseModal({
  caseId,
  title,
  entities,
  onClose,
}: Props) {
  const [expiresIn, setExpiresIn] = useState("24h");
  const [includeHypotheses, setIncludeHypotheses] = useState(false);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [generating, setGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [currentExpiry, setCurrentExpiry] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeShares, setActiveShares] = useState<ActiveShare[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/investigators/cases/${caseId}/shares`)
      .then((r) => r.json())
      .then((d) => setActiveShares(d.shares ?? []))
      .catch(() => {});
    fetch(`/api/investigators/cases/${caseId}/hypotheses`)
      .then((r) => r.json())
      .then((d) => setHypotheses(d.hypotheses ?? []))
      .catch(() => {});
  }, [caseId]);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const hypSnapshot = includeHypotheses
        ? hypotheses.map((h) => ({
            title: h.title,
            status: h.status,
            confidence: h.confidence,
          }))
        : null;
      const res = await fetch(
        `/api/investigators/cases/${caseId}/share`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expiresIn,
            titleSnapshot: title,
            entitySnapshot: entities.map((e) => ({
              type: e.type,
              value: e.value,
              label: e.label,
            })),
            hypothesisSnapshot: hypSnapshot,
          }),
        }
      );
      const data = await res.json();
      if (data.shareUrl) {
        setShareUrl(data.shareUrl);
        setCurrentExpiry(data.expiresAt ?? null);
        // Refresh active shares
        fetch(`/api/investigators/cases/${caseId}/shares`)
          .then((r) => r.json())
          .then((d) => setActiveShares(d.shares ?? []))
          .catch(() => {});
      } else {
        setError(data.error ?? "Failed to generate link");
      }
    } catch {
      setError("This action failed. Try again or reload the page.");
    } finally {
      setGenerating(false);
    }
  }

  function copy() {
    if (!shareUrl) return;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  async function revoke(shareId: string) {
    if (revoking) return;
    setRevoking(shareId);
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/share/${shareId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setActiveShares((prev) => prev.filter((s) => s.id !== shareId));
      }
    } finally {
      setRevoking(null);
    }
  }

  return (
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
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "#0a0a0a",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 8,
          padding: 24,
          maxWidth: 560,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 12 }}
        >
          <div
            style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF" }}
          >
            Share this case
          </div>
          <button
            onClick={onClose}
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.4)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {!shareUrl ? (
          <>
            {/* SHARE PREVIEW */}
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                marginBottom: 10,
                lineHeight: 1.6,
              }}
            >
              This share link will include:
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.8,
                marginBottom: 16,
                padding: 12,
                backgroundColor: "#0d0d0d",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div>
                <span style={{ color: "#4ADE80" }}>✓</span>{" "}
                {entities.length} derived entities (wallets, handles, hashes)
              </div>
              <div>
                <span style={{ color: "#4ADE80" }}>✓</span> Case title and tags
              </div>
              <div>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>✗</span>{" "}
                <span style={{ color: "rgba(255,255,255,0.4)" }}>
                  Notes (never included)
                </span>
              </div>
              <div>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>✗</span>{" "}
                <span style={{ color: "rgba(255,255,255,0.4)" }}>
                  Raw files (never included)
                </span>
              </div>
              <label
                className="flex items-center gap-2"
                style={{
                  marginTop: 10,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                <input
                  type="checkbox"
                  checked={includeHypotheses}
                  onChange={(e) => setIncludeHypotheses(e.target.checked)}
                />
                Include hypotheses ({hypotheses.length})
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 8,
                }}
              >
                Link expires in
              </div>
              <div className="flex gap-2">
                {EXPIRY_OPTIONS.map((opt) => {
                  const active = expiresIn === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setExpiresIn(opt.id)}
                      style={{
                        fontSize: 12,
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: active
                          ? "1px solid #FF6B00"
                          : "1px solid rgba(255,255,255,0.12)",
                        backgroundColor: active
                          ? "rgba(255,107,0,0.1)"
                          : "transparent",
                        color: active ? "#FF6B00" : "rgba(255,255,255,0.5)",
                        cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div
                style={{ fontSize: 12, color: "#FF3B5C", marginBottom: 10 }}
              >
                {error}
              </div>
            )}

            <button
              onClick={generate}
              disabled={generating}
              className="disabled:opacity-50"
              style={{
                backgroundColor: "#FF6B00",
                color: "#FFFFFF",
                height: 44,
                borderRadius: 6,
                fontSize: 14,
                padding: "0 20px",
                border: "none",
                cursor: "pointer",
                width: "100%",
              }}
            >
              {generating ? "Generating…" : "Generate share link"}
            </button>
          </>
        ) : (
          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
              }}
            >
              Share link
            </div>
            <div
              style={{
                padding: 12,
                backgroundColor: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
                color: "#FFFFFF",
                wordBreak: "break-all",
                marginBottom: 10,
              }}
            >
              {shareUrl}
            </div>
            {currentExpiry && (
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 12,
                }}
              >
                Expires {new Date(currentExpiry).toLocaleString()}
              </div>
            )}
            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              <button
                onClick={copy}
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
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                onClick={() => {
                  setShareUrl(null);
                  setCurrentExpiry(null);
                }}
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.6)",
                  height: 40,
                  borderRadius: 6,
                  fontSize: 13,
                  padding: "0 18px",
                  cursor: "pointer",
                }}
              >
                Generate another
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE SHARES LIST */}
        {activeShares.length > 0 && (
          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 10,
              }}
            >
              Active share links ({activeShares.length})
            </div>
            <div className="flex flex-col gap-2">
              {activeShares.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                >
                  <div style={{ color: "rgba(255,255,255,0.5)" }}>
                    Expires {new Date(s.expiresAt).toLocaleString()}
                  </div>
                  <button
                    onClick={() => revoke(s.id)}
                    disabled={revoking === s.id}
                    className="disabled:opacity-50"
                    style={{
                      fontSize: 11,
                      color: "#FF3B5C",
                      background: "none",
                      border: "1px solid rgba(255,59,92,0.3)",
                      borderRadius: 4,
                      padding: "3px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {revoking === s.id ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
