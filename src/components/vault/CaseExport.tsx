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
  tags: string[];
  entities: Entity[];
  notes: { id: string; content: string; createdAt: string }[];
};

type RetailSummary = {
  summary: string;
  redFlags: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskJustification: string;
  disclaimer: string;
};

const SECTION_TITLE: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.3)",
  marginBottom: 10,
};

const SEPARATOR: React.CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.06)",
  margin: "28px 0",
};

const PRIMARY_BTN: React.CSSProperties = {
  backgroundColor: "#FF6B00",
  color: "#FFFFFF",
  height: 44,
  borderRadius: 6,
  fontSize: 14,
  padding: "0 20px",
  border: "none",
  cursor: "pointer",
};

const SECONDARY_BTN: React.CSSProperties = {
  backgroundColor: "transparent",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.7)",
  height: 44,
  borderRadius: 6,
  fontSize: 14,
  padding: "0 20px",
  cursor: "pointer",
};

export default function CaseExport({
  caseId,
  title,
  tags,
  entities,
  notes,
}: Props) {
  const [includeNotes, setIncludeNotes] = useState(false);
  const [retail, setRetail] = useState<RetailSummary | null>(null);
  const [retailLoading, setRetailLoading] = useState(false);
  const [retailError, setRetailError] = useState<string | null>(null);
  const [retailMock, setRetailMock] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(entities.map((e) => e.id))
  );
  const [publishSummary, setPublishSummary] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  function toggleEntity(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportJSON() {
    const full = {
      title,
      tags,
      entities,
      notes: notes.map((n) => ({ content: n.content, createdAt: n.createdAt })),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(full, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "case"}-report.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function openPrint() {
    const url = `/investigators/box/cases/${caseId}/print${includeNotes ? "?includeNotes=true" : ""}`;
    window.open(url, "_blank");
  }

  async function generateRetail() {
    if (retailLoading) return;
    setRetailLoading(true);
    setRetailError(null);
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/ai-summary`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "retail" }),
        }
      );
      const data = await res.json();
      if (data.summary) {
        setRetail(data.summary);
        setRetailMock(Boolean(data.mock));
      } else {
        setRetailError(data.error ?? "Generation failed");
      }
    } catch {
      setRetailError("Network error");
    } finally {
      setRetailLoading(false);
    }
  }

  function copyRetail() {
    if (!retail) return;
    const text = [
      retail.summary,
      "",
      "RED FLAGS:",
      ...retail.redFlags.map((f) => `- ${f}`),
      "",
      `RISK: ${retail.riskLevel} — ${retail.riskJustification}`,
      "",
      retail.disclaimer,
    ].join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  async function submitPublish() {
    if (publishing) return;
    if (selectedIds.size === 0) {
      setPublishError("Select at least one entity.");
      return;
    }
    if (publishSummary.trim().length < 100) {
      setPublishError("Summary must be at least 100 characters.");
      return;
    }
    if (!confirmed) {
      setPublishError("Please confirm.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/publish-candidate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            entityIds: Array.from(selectedIds),
            summary: publishSummary.trim(),
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setPublishSuccess(true);
      } else {
        setPublishError(data.error ?? "Submission failed");
      }
    } catch {
      setPublishError("Network error");
    } finally {
      setPublishing(false);
    }
  }

  const riskColors: Record<RetailSummary["riskLevel"], string> = {
    LOW: "#4ADE80",
    MEDIUM: "#FF6B00",
    HIGH: "#FF3B5C",
  };

  return (
    <div>
      {/* JSON + PDF */}
      <div style={SECTION_TITLE}>Investigator report</div>
      <div className="flex flex-col gap-3" style={{ marginBottom: 16 }}>
        <button onClick={exportJSON} style={PRIMARY_BTN}>
          Investigator report (JSON)
        </button>
        <div className="flex items-center gap-3">
          <button onClick={openPrint} style={SECONDARY_BTN}>
            Investigator report (PDF)
          </button>
          <label
            className="flex items-center gap-2"
            style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}
          >
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
            />
            Include notes
          </label>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            lineHeight: 1.5,
          }}
        >
          Print or save as PDF from your browser. Raw files are never included.
        </div>
      </div>

      <div style={SEPARATOR} />

      {/* AI retail summary */}
      <div style={SECTION_TITLE}>Retail summary (AI)</div>
      {!retail && !retailLoading && (
        <button onClick={generateRetail} style={PRIMARY_BTN}>
          Generate retail summary
        </button>
      )}
      {retailLoading && (
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
          Analyzing derived intelligence…
        </div>
      )}
      {retailError && !retailLoading && (
        <div style={{ color: "#FF3B5C", fontSize: 13 }}>{retailError}</div>
      )}
      {retail && !retailLoading && (
        <div
          style={{
            backgroundColor: "#0a0a0a",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: 6,
            padding: 16,
          }}
        >
          <div
            style={{
              ...SECTION_TITLE,
              color: "#FF6B00",
              marginBottom: 8,
            }}
          >
            Retail summary
          </div>
          {retailMock && (
            <div
              style={{
                fontSize: 10,
                color: "#FF3B5C",
                marginBottom: 8,
              }}
            >
              MOCK RESPONSE — ANTHROPIC_API_KEY not configured
            </div>
          )}
          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.6,
            }}
          >
            {retail.summary}
          </div>
          {retail.redFlags?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  ...SECTION_TITLE,
                  color: "rgba(255,107,0,0.7)",
                  marginBottom: 6,
                }}
              >
                Red flags
              </div>
              <ul
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.7)",
                  paddingLeft: 18,
                }}
              >
                {retail.redFlags.map((f, i) => (
                  <li key={i} style={{ listStyle: "disc", marginBottom: 4 }}>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-3" style={{ marginTop: 14 }}>
            <span
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "4px 12px",
                borderRadius: 4,
                color: riskColors[retail.riskLevel],
                border: `1px solid ${riskColors[retail.riskLevel]}`,
              }}
            >
              {retail.riskLevel}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              {retail.riskJustification}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              fontStyle: "italic",
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            {retail.disclaimer}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              marginTop: 6,
            }}
          >
            This summary is based on derived entities only. Raw files were not
            accessed.
          </div>
          <div className="flex gap-2" style={{ marginTop: 14 }}>
            <button
              onClick={copyRetail}
              style={{
                ...SECONDARY_BTN,
                height: 36,
                fontSize: 12,
                padding: "0 14px",
              }}
            >
              Copy summary
            </button>
            <button
              onClick={generateRetail}
              style={{
                ...SECONDARY_BTN,
                height: 36,
                fontSize: 12,
                padding: "0 14px",
              }}
            >
              Regenerate
            </button>
          </div>
        </div>
      )}

      <div style={SEPARATOR} />

      {/* PUBLISH TO INTEL VAULT */}
      <div style={SECTION_TITLE}>Contribute to Intel Vault</div>
      {publishSuccess ? (
        <div
          style={{
            padding: 20,
            backgroundColor: "rgba(74,222,128,0.06)",
            border: "1px solid rgba(74,222,128,0.3)",
            borderRadius: 6,
            color: "#4ADE80",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          Submitted for review. The INTERLIGENS team will review your
          contribution and contact you via your profile.
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              marginBottom: 16,
              lineHeight: 1.6,
            }}
          >
            Submit a selection of derived intelligence for publication review.
            Raw files are never included. Your contribution will be reviewed
            before publication. Attribution will use your investigator handle.
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
              Step 1 — Select entities to share
            </div>
            <div
              className="flex flex-col gap-1"
              style={{
                maxHeight: 220,
                overflowY: "auto",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                padding: 10,
              }}
            >
              {entities.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  No entities in this case.
                </div>
              ) : (
                entities.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center gap-2"
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.7)",
                      cursor: "pointer",
                      padding: "4px 0",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(e.id)}
                      onChange={() => toggleEntity(e.id)}
                    />
                    <span
                      style={{
                        color: "#FF6B00",
                        fontSize: 9,
                        textTransform: "uppercase",
                        width: 60,
                      }}
                    >
                      {e.type}
                    </span>
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {e.value}
                    </span>
                  </label>
                ))
              )}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                marginTop: 6,
              }}
            >
              Only selected entities will be submitted. Notes and files are
              excluded.
            </div>
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
              Step 2 — Write a submission summary ({publishSummary.length}
              /4000)
            </div>
            <textarea
              value={publishSummary}
              onChange={(e) => setPublishSummary(e.target.value)}
              placeholder="This case documents a KOL paid promotion scheme involving..."
              rows={5}
              style={{
                width: "100%",
                backgroundColor: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                padding: "10px 12px",
                color: "#FFFFFF",
                fontSize: 13,
                outline: "none",
                resize: "vertical",
              }}
            />
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                marginTop: 4,
              }}
            >
              Minimum 100 characters.
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              className="flex items-start gap-2"
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                lineHeight: 1.5,
              }}
            >
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              I confirm this submission. Selected derived entities and my
              summary may be published in the INTERLIGENS Intel Vault with
              attribution to my handle.
            </label>
          </div>

          {publishError && (
            <div
              style={{
                color: "#FF3B5C",
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              {publishError}
            </div>
          )}

          <button
            onClick={submitPublish}
            disabled={publishing || !confirmed}
            className="disabled:opacity-50"
            style={{ ...PRIMARY_BTN, width: "100%" }}
          >
            {publishing ? "Submitting…" : "Submit for review"}
          </button>
        </>
      )}
    </div>
  );
}
