"use client";

import { useState } from "react";

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
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
  const [generating, setGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
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
          }),
        }
      );
      const data = await res.json();
      if (data.shareUrl) {
        setShareUrl(data.shareUrl);
      } else {
        setError(data.error ?? "Failed to generate link");
      }
    } catch {
      setError("Network error");
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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        zIndex: 90,
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
          maxWidth: 520,
          width: "100%",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 12 }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#FFFFFF",
            }}
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
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.4)",
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          Sharing will expose derived entities and hypotheses only. Notes,
          files, and raw content are never included.
        </div>

        {!shareUrl ? (
          <>
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
                style={{
                  fontSize: 12,
                  color: "#FF3B5C",
                  marginBottom: 10,
                }}
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
                marginBottom: 12,
              }}
            >
              {shareUrl}
            </div>
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
          </div>
        )}
      </div>
    </div>
  );
}
