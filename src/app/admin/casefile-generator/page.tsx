"use client";

import { useState, useRef } from "react";

const ACCENT = "#FF6B00";

const PRESETS = [
  { id: "vine", label: "VINE — CASE-2025-VINE-001", description: "Full CaseFile from vine-osint.json + vine-smoking-guns.json" },
];

export default function CaseFileGeneratorPage() {
  const [mode, setMode] = useState<"preset" | "upload">("preset");
  const [selectedPreset, setSelectedPreset] = useState("vine");
  const [uploadToR2, setUploadToR2] = useState(false);
  const [customJson, setCustomJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ r2Key?: string; downloaded?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let body: Record<string, unknown>;
      if (mode === "preset") {
        body = { source: selectedPreset, uploadToR2 };
      } else {
        const parsed = JSON.parse(customJson);
        body = { data: parsed, uploadToR2 };
      }

      const res = await fetch("/api/casefile/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      if (uploadToR2) {
        const data = await res.json();
        setResult({ r2Key: data.r2Key });
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${mode === "preset" ? selectedPreset : "casefile"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setResult({ downloaded: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCustomJson(reader.result as string);
    reader.readAsText(file);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "32px 40px 80px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: ACCENT,
            fontWeight: 700,
          }}
        >
          CASEFILE GENERATOR
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
          Génère un PDF CaseFile INTERLIGENS depuis n'importe quel JSON OSINT
        </div>

        {/* Mode selector */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 24,
          }}
        >
          {(["preset", "upload"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "8px 16px",
                background: mode === m ? ACCENT : "rgba(255,255,255,0.04)",
                color: mode === m ? "#000" : "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              {m === "preset" ? "Case préchargé" : "Upload JSON"}
            </button>
          ))}
        </div>

        {/* Preset selection */}
        {mode === "preset" && (
          <div style={{ marginTop: 20 }}>
            {PRESETS.map((p) => (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 16,
                  background:
                    selectedPreset === p.id
                      ? "rgba(255,107,0,0.08)"
                      : "#0D0D0D",
                  border: `1px solid ${selectedPreset === p.id ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                <input
                  type="radio"
                  name="preset"
                  checked={selectedPreset === p.id}
                  onChange={() => setSelectedPreset(p.id)}
                  style={{ accentColor: ACCENT }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    {p.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.45)",
                      marginTop: 2,
                    }}
                  >
                    {p.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Upload JSON */}
        {mode === "upload" && (
          <div style={{ marginTop: 20 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              style={{
                padding: 8,
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "#fff",
                fontSize: 12,
                marginBottom: 12,
              }}
            />
            <textarea
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
              placeholder='{"case_meta": {"case_id": "...", ...}, "new_claims": [...], ...}'
              rows={12}
              style={{
                width: "100%",
                background: "#0D0D0D",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: 14,
                color: "#fff",
                fontFamily: "Menlo, monospace",
                fontSize: 11,
                lineHeight: 1.5,
                resize: "vertical",
              }}
            />
          </div>
        )}

        {/* Options + Generate */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 20,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <input
              type="checkbox"
              checked={uploadToR2}
              onChange={(e) => setUploadToR2(e.target.checked)}
              style={{ accentColor: ACCENT }}
            />
            Upload to R2 (returns key, no download)
          </label>

          <button
            onClick={handleGenerate}
            disabled={loading || (mode === "upload" && !customJson)}
            style={{
              padding: "12px 24px",
              background: loading ? "#333" : ACCENT,
              color: "#000",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              border: "none",
              borderRadius: 8,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Generating…" : "Generate PDF"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: "rgba(255,107,0,0.08)",
              border: "1px solid rgba(255,107,0,0.3)",
              borderRadius: 8,
              color: ACCENT,
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: "rgba(0,255,0,0.05)",
              border: "1px solid rgba(0,255,0,0.2)",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            {result.downloaded && (
              <span style={{ color: "#7FE28C" }}>
                PDF downloaded successfully.
              </span>
            )}
            {result.r2Key && (
              <span style={{ color: "#7FE28C" }}>
                Uploaded to R2:{" "}
                <code
                  style={{
                    fontFamily: "Menlo, monospace",
                    fontSize: 10,
                    color: "#fff",
                  }}
                >
                  {result.r2Key}
                </code>
              </span>
            )}
          </div>
        )}

        {/* Format guide */}
        <div
          style={{
            marginTop: 32,
            padding: 16,
            background: "#0D0D0D",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Format JSON attendu
          </div>
          <pre
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.6)",
              fontFamily: "Menlo, monospace",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
{`{
  "case_meta": {
    "case_id": "CASE-XXXX-TOKEN-001",
    "token_name": "...", "ticker": "$...",
    "mint": "...", "chain": "solana",
    "summary_fr": "...", "severity": "CRITICAL"
  },
  "timeline": [{ "date": "...", "title": "...", "description": "..." }],
  "shillers": [{ "handle": "@...", "severity": "HIGH", "timing": "..." }],
  "wallets_onchain": [{ "label": "...", "address": "...", "role": "..." }],
  "new_claims": [{ "claim_id": "C1", "title": "...", "severity": "CRITICAL" }],
  "smoking_guns": {
    "tier_1": [{ "id": "SG-1", "title": "...", "legal_weight": "..." }],
    "verdict_fr": "..."
  },
  "requisitions": [{ "priority": 1, "target": "...", "object": "..." }]
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
