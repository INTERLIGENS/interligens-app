"use client";

/**
 * src/app/admin/casefile-nova/_components/NovaGeneratorForm.tsx
 *
 * Client form for the $NOVA generator. Sends an authenticated POST and
 * triggers a browser download from the resulting PDF blob.
 */

import { useState } from "react";

const ACCENT = "#FF6B00";

export function NovaGeneratorForm({ flagEnabled }: { flagEnabled: boolean }) {
  const [version, setVersion] = useState("v1.1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/casefile-nova/generate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          detail = j.error ?? j.detail ?? detail;
        } catch {
          // body was not JSON
        }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `INTERLIGENS-Casefile-NOVA-${version}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSuccess(`PDF generated (${(blob.size / 1024).toFixed(1)} KB).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "#0A0A0A",
        border: "1px solid #27272A",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#71717A",
          }}
        >
          Version label
        </span>
        <input
          type="text"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          disabled={loading}
          style={{
            background: "#000",
            color: "#FFF",
            border: "1px solid #27272A",
            padding: "8px 10px",
            fontFamily: "\"Courier New\", monospace",
            fontSize: 13,
          }}
        />
      </label>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || !flagEnabled}
        style={{
          background: !flagEnabled ? "#222" : ACCENT,
          color: !flagEnabled ? "#666" : "#000",
          border: "none",
          padding: "12px 18px",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: !flagEnabled || loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Generating PDF..." : `Generate $NOVA PDF (${version})`}
      </button>

      {error && (
        <div
          style={{
            color: "#FF3B5C",
            fontSize: 12,
            fontFamily: "\"Courier New\", monospace",
          }}
        >
          Error: {error}
        </div>
      )}

      {success && (
        <div
          style={{
            color: "#00FF94",
            fontSize: 12,
            fontFamily: "\"Courier New\", monospace",
          }}
        >
          {success}
        </div>
      )}
    </div>
  );
}
