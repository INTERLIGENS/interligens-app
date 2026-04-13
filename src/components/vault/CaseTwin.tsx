"use client";

import { useEffect, useState } from "react";

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
  confidence: number | null;
  extractionMethod: string | null;
  sourceFileId: string | null;
  createdAt: string;
};

type EntityEnrichment = {
  inWatchlist: boolean;
  isKnownBad: boolean;
  knownBadScore: number | null;
  inKolRegistry: boolean;
  kolName: string | null;
  kolScore: number | null;
  inIntelVault: boolean;
};

type Hypothesis = {
  id: string;
  title: string;
  status: "OPEN" | "CONFIRMED" | "REFUTED" | "NEEDS_VERIFICATION";
  confidence: number;
  notes: string | null;
  createdAt: string;
};

type Props = {
  caseId: string;
  entities: Entity[];
  notes: { id: string; content: string }[];
  caseTemplate: string | null;
  updatedAt: string;
  enrichment: Record<string, EntityEnrichment>;
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
  margin: "20px 0",
};

const BODY: React.CSSProperties = {
  fontSize: 14,
  color: "rgba(255,255,255,0.7)",
  lineHeight: 1.6,
};

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
}

export default function CaseTwin({
  caseId,
  entities,
  notes,
  caseTemplate,
  updatedAt,
  enrichment,
}: Props) {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [timelineEvents, setTimelineEvents] = useState(0);
  const [collisionCount, setCollisionCount] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<{
    caseAssessment: string;
    keyPatterns: string[];
    evidenceStrengths: string[];
    openQuestions: string[];
    nextSteps: string[];
    publishabilityNote: string;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/investigators/cases/${caseId}/timeline-events`)
      .then((r) => r.json())
      .then((d) => setTimelineEvents((d.events ?? []).length))
      .catch(() => {});
    fetch(`/api/investigators/entities/collisions?caseId=${caseId}`)
      .then((r) => r.json())
      .then((d) => setCollisionCount(d.collisionCount ?? 0))
      .catch(() => {});
  }, [caseId]);

  async function generateAnalysis() {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/ai-summary`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "investigator" }),
        }
      );
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
      } else {
        setAiError(data.error ?? "Generation failed");
      }
    } catch (err) {
      setAiError("Network error");
    } finally {
      setAiLoading(false);
    }
  }

  function copyAnalysis() {
    if (!aiAnalysis) return;
    const text = [
      `CASE ASSESSMENT: ${aiAnalysis.caseAssessment}`,
      `KEY PATTERNS:\n${aiAnalysis.keyPatterns.map((p) => `- ${p}`).join("\n")}`,
      `EVIDENCE STRENGTHS:\n${aiAnalysis.evidenceStrengths.map((s) => `- ${s}`).join("\n")}`,
      `OPEN QUESTIONS:\n${aiAnalysis.openQuestions.map((q) => `? ${q}`).join("\n")}`,
      `NEXT STEPS:\n${aiAnalysis.nextSteps.map((s) => `→ ${s}`).join("\n")}`,
      `PUBLISHABILITY: ${aiAnalysis.publishabilityNote}`,
    ].join("\n\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState<Hypothesis["status"]>("OPEN");
  const [newConfidence, setNewConfidence] = useState(50);
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissedConflicts, setDismissedConflicts] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/investigators/cases/${caseId}/hypotheses`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setHypotheses(d.hypotheses ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  async function addHypothesis() {
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/hypotheses`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: newTitle.trim(),
            status: newStatus,
            confidence: newConfidence,
            notes: newNotes.trim() || undefined,
          }),
        }
      );
      if (res.ok) {
        const d = await res.json();
        if (d.hypothesis) setHypotheses((prev) => [d.hypothesis, ...prev]);
        setNewTitle("");
        setNewStatus("OPEN");
        setNewConfidence(50);
        setNewNotes("");
        setShowAddForm(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteHypothesis(id: string) {
    const res = await fetch(
      `/api/investigators/cases/${caseId}/hypotheses/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setHypotheses((prev) => prev.filter((h) => h.id !== id));
    }
  }

  const STATUS_COLORS: Record<Hypothesis["status"], { bg: string; border: string; text: string }> = {
    OPEN: {
      bg: "rgba(255,255,255,0.05)",
      border: "rgba(255,255,255,0.2)",
      text: "rgba(255,255,255,0.7)",
    },
    CONFIRMED: {
      bg: "rgba(74,222,128,0.08)",
      border: "rgba(74,222,128,0.4)",
      text: "#4ADE80",
    },
    REFUTED: {
      bg: "rgba(255,59,92,0.08)",
      border: "rgba(255,59,92,0.4)",
      text: "#FF3B5C",
    },
    NEEDS_VERIFICATION: {
      bg: "rgba(255,107,0,0.08)",
      border: "rgba(255,107,0,0.4)",
      text: "#FF6B00",
    },
  };

  const STATUS_OPTIONS: Hypothesis["status"][] = [
    "OPEN",
    "CONFIRMED",
    "REFUTED",
    "NEEDS_VERIFICATION",
  ];

  // CONFLICTS (Bloc 3) — rule-based detection
  const conflicts: { id: string; description: string }[] = [];

  // Rule 1: same value with different types
  const valueTypeMap = new Map<string, Set<string>>();
  for (const e of entities) {
    const s = valueTypeMap.get(e.value) ?? new Set<string>();
    s.add(e.type);
    valueTypeMap.set(e.value, s);
  }
  for (const [val, types] of valueTypeMap.entries()) {
    if (types.size > 1) {
      conflicts.push({
        id: `type:${val}`,
        description: `Entity '${val.slice(0, 20)}${val.length > 20 ? "…" : ""}' is typed as ${Array.from(types).join(" and ")}`,
      });
    }
  }

  // Rule 2: same value with different labels
  const valueLabelMap = new Map<string, Set<string>>();
  for (const e of entities) {
    if (!e.label) continue;
    const s = valueLabelMap.get(e.value) ?? new Set<string>();
    s.add(e.label);
    valueLabelMap.set(e.value, s);
  }
  for (const [val, labels] of valueLabelMap.entries()) {
    if (labels.size > 1) {
      const labelList = Array.from(labels).map((l) => `'${l}'`).join(" and ");
      conflicts.push({
        id: `label:${val}`,
        description: `Entity '${val.slice(0, 20)}${val.length > 20 ? "…" : ""}' has different labels: ${labelList}`,
      });
    }
  }

  // Rule 3: CONFIRMED hypothesis with no supporting entity
  for (const h of hypotheses) {
    if (h.status === "CONFIRMED") {
      conflicts.push({
        id: `hyp-empty:${h.id}`,
        description: `Hypothesis '${h.title}' is marked CONFIRMED — verify supporting evidence is linked`,
      });
    }
  }

  // Section A — counts
  const wallets = entities.filter((e) => e.type === "WALLET");
  const handles = entities.filter((e) => e.type === "HANDLE");
  const txs = entities.filter((e) => e.type === "TX_HASH");
  const domains = entities.filter(
    (e) => e.type === "URL" || e.type === "DOMAIN"
  );

  const kolHits = Object.values(enrichment).filter((e) => e.inKolRegistry).length;
  const watchHits = Object.values(enrichment).filter((e) => e.inWatchlist).length;

  // Section C — gaps
  const gaps: string[] = [];
  if (entities.length === 0) gaps.push("No evidence deposited yet");
  if (wallets.length > 0 && txs.length === 0) {
    gaps.push("No transaction hashes linked to wallets");
  }
  if (txs.length > 0 && timelineEvents === 0) {
    gaps.push("No timeline built yet");
  }
  if (entities.length > 0 && notes.length === 0) {
    gaps.push("No analyst notes added");
  }
  const age = daysAgo(updatedAt);
  if (age > 7) gaps.push(`Case inactive for ${age} days`);
  if (!caseTemplate || caseTemplate === "blank") {
    gaps.push("No case structure defined");
  }
  const unlabeled = entities.filter((e) => !e.label).length;
  if (unlabeled > 0) {
    gaps.push(`${unlabeled} entities have no analyst label`);
  }

  // Section D — readiness
  let readinessScore = 0;
  if (entities.length >= 3) readinessScore++;
  if (hypotheses.some((h) => h.status === "CONFIRMED")) readinessScore++;
  if (notes.length >= 1) readinessScore++;
  if (gaps.length === 0) readinessScore++;
  if (entities.some((e) => e.confidence != null && e.confidence >= 0.8)) {
    readinessScore++;
  }

  let readinessText = "";
  let readinessColor = "rgba(255,255,255,0.4)";
  if (readinessScore <= 1) {
    readinessText = "Not ready · Too little evidence";
    readinessColor = "#FF3B5C";
  } else if (readinessScore <= 3) {
    readinessText = "In progress · Build more before publishing";
    readinessColor = "#FF6B00";
  } else {
    readinessText = "Ready to review · Consider publishing";
    readinessColor = "#4ADE80";
  }

  // Section E — next action
  let nextAction = "";
  if (entities.length === 0) {
    nextAction = "Add your first entity — start with a wallet or handle";
  } else if (wallets.length > 0 && txs.length === 0) {
    nextAction = "Look for transaction hashes linked to these wallets";
  } else if (handles.length > 0 && kolHits === 0) {
    nextAction = "Check these handles against the KOL Registry";
  } else if (hypotheses.length === 0) {
    nextAction = "Add your first working hypothesis";
  } else if (notes.length === 0) {
    nextAction = "Write your first analyst note";
  } else if (timelineEvents === 0) {
    nextAction = "Build the case timeline";
  } else {
    nextAction = "Review publication readiness — this case may be ready";
  }

  const scoredRed = entities.filter((e) => {
    const r = enrichment[e.id];
    return r?.isKnownBad;
  }).length;

  return (
    <div>
      {/* SECTION A */}
      <div style={SECTION_TITLE}>What we know</div>
      <div style={BODY}>
        {wallets.length} wallets · {handles.length} handles · {txs.length} transactions · {domains.length} domains
      </div>
      {(scoredRed > 0 || kolHits > 0 || watchHits > 0) && (
        <div style={{ ...BODY, marginTop: 6 }}>
          {scoredRed > 0 && `${scoredRed} flagged known-bad · `}
          {kolHits > 0 && `${kolHits} KOL Registry match · `}
          {watchHits > 0 && `${watchHits} Watchlist match`}
        </div>
      )}
      {collisionCount > 0 && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            backgroundColor: "rgba(255,176,32,0.04)",
            border: "1px solid rgba(255,176,32,0.2)",
            borderRadius: 6,
            fontSize: 12,
            color: "rgba(255,176,32,0.85)",
            lineHeight: 1.6,
          }}
        >
          {collisionCount} of your entities have been seen in other active
          investigations. We cannot reveal which ones or by whom — this is by
          design.
        </div>
      )}

      <div style={SEPARATOR} />

      {/* SECTION B — Hypotheses */}
      <div style={SECTION_TITLE}>Working hypotheses</div>
      {hypotheses.length === 0 && !showAddForm && (
        <div style={BODY}>
          <div>No working hypotheses yet.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            What do you believe happened? Add your first theory.
          </div>
        </div>
      )}
      {hypotheses.length > 0 && (
        <div className="flex flex-col gap-2">
          {hypotheses.map((h) => {
            const c = STATUS_COLORS[h.status];
            return (
              <div
                key={h.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 6,
                  padding: "12px 14px",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    style={{
                      fontSize: 13,
                      color: "#FFFFFF",
                      flex: 1,
                      wordBreak: "break-word",
                    }}
                  >
                    {h.title}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "2px 8px",
                        borderRadius: 4,
                        color: c.text,
                        border: `1px solid ${c.border}`,
                        backgroundColor: c.bg,
                      }}
                    >
                      {h.status}
                    </span>
                    <button
                      onClick={() => deleteHypothesis(h.id)}
                      aria-label="Delete"
                      style={{
                        fontSize: 14,
                        color: "rgba(255,255,255,0.3)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    height: 4,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${h.confidence}%`,
                      height: "100%",
                      backgroundColor: c.text,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.3)",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Confidence {h.confidence}%
                </div>
                {h.notes && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.5)",
                      marginTop: 8,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {h.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showAddForm ? (
        <div style={{ marginTop: 14 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Hypothesis title"
            style={{
              width: "100%",
              backgroundColor: "#0d0d0d",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              padding: "10px 12px",
              color: "#FFFFFF",
              fontSize: 13,
              outline: "none",
              marginBottom: 10,
            }}
          />
          <div className="flex flex-wrap gap-2" style={{ marginBottom: 10 }}>
            {STATUS_OPTIONS.map((s) => {
              const active = newStatus === s;
              const col = STATUS_COLORS[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNewStatus(s)}
                  style={{
                    fontSize: 10,
                    padding: "4px 10px",
                    borderRadius: 20,
                    border: `1px solid ${active ? col.border : "rgba(255,255,255,0.12)"}`,
                    backgroundColor: active ? col.bg : "transparent",
                    color: active ? col.text : "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <textarea
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={3}
            style={{
              width: "100%",
              backgroundColor: "#0d0d0d",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              padding: "10px 12px",
              color: "#FFFFFF",
              fontSize: 13,
              outline: "none",
              marginBottom: 10,
              resize: "vertical",
            }}
          />
          <div className="flex gap-3 items-center">
            <button
              onClick={addHypothesis}
              disabled={saving || !newTitle.trim()}
              className="disabled:opacity-50"
              style={{
                backgroundColor: "#FF6B00",
                color: "#FFFFFF",
                borderRadius: 6,
                padding: "10px 16px",
                fontSize: 13,
                border: "none",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving…" : "Save hypothesis"}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewTitle("");
                setNewNotes("");
                setNewConfidence(50);
                setNewStatus("OPEN");
              }}
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
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            marginTop: 12,
            color: "#FF6B00",
            fontSize: 12,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          + Add hypothesis
        </button>
      )}

      <div style={SEPARATOR} />

      {/* SECTION C — Gaps */}
      <div style={SECTION_TITLE}>Gaps detected</div>
      {gaps.length === 0 ? (
        <div style={BODY}>No gaps detected.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {gaps.map((gap) => (
            <div key={gap} className="flex items-center gap-2">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 8,
                  backgroundColor: "#FF6B00",
                  display: "inline-block",
                }}
              />
              <span style={BODY}>{gap}</span>
            </div>
          ))}
        </div>
      )}

      <div style={SEPARATOR} />

      {/* CONFLICTS (Bloc 3) */}
      <div style={{ ...SECTION_TITLE, color: "#FF6B00" }}>
        Conflicts detected
      </div>
      {conflicts.filter((c) => !dismissedConflicts[c.id]).length === 0 ? (
        <div style={BODY}>No conflicts detected.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {conflicts
            .filter((c) => !dismissedConflicts[c.id])
            .map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-3"
                style={{
                  border: "1px solid rgba(255,107,0,0.12)",
                  borderRadius: 6,
                  padding: "10px 12px",
                }}
              >
                <div className="flex items-start gap-2">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 8,
                      backgroundColor: "#FF6B00",
                      display: "inline-block",
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <span style={BODY}>{c.description}</span>
                </div>
                <button
                  onClick={() =>
                    setDismissedConflicts((p) => ({ ...p, [c.id]: true }))
                  }
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                    flexShrink: 0,
                  }}
                >
                  Dismiss
                </button>
              </div>
            ))}
        </div>
      )}

      <div style={SEPARATOR} />

      {/* SECTION D — Readiness */}
      <div style={SECTION_TITLE}>Publication readiness</div>
      <div className="flex items-center gap-3">
        <span
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "4px 10px",
            borderRadius: 4,
            color: readinessColor,
            border: `1px solid ${readinessColor}`,
          }}
        >
          {readinessScore}/5
        </span>
        <span style={BODY}>{readinessText}</span>
      </div>

      <div style={SEPARATOR} />

      {/* SECTION E — Next action */}
      <div style={SECTION_TITLE}>Next suggested action</div>
      <div
        style={{
          backgroundColor: "#0a0a0a",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 6,
          padding: 14,
          fontSize: 14,
          color: "#FFFFFF",
        }}
      >
        {nextAction}
      </div>

      <div style={SEPARATOR} />

      {/* SECTION F — AI Analysis */}
      <div style={SECTION_TITLE}>AI analysis</div>
      {!aiAnalysis && !aiLoading && (
        <button
          onClick={generateAnalysis}
          style={{
            backgroundColor: "#FF6B00",
            color: "#FFFFFF",
            height: 44,
            borderRadius: 6,
            fontSize: 14,
            padding: "0 20px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Generate case analysis
        </button>
      )}
      {aiLoading && (
        <div style={{ ...BODY, color: "rgba(255,255,255,0.5)" }}>
          Analyzing derived intelligence…
        </div>
      )}
      {aiError && !aiLoading && (
        <div style={{ ...BODY, color: "#FF3B5C" }}>{aiError}</div>
      )}
      {aiAnalysis && !aiLoading && (
        <div className="flex flex-col gap-4">
          <div>
            <div
              style={{
                ...SECTION_TITLE,
                color: "rgba(255,107,0,0.7)",
                marginBottom: 6,
              }}
            >
              Case assessment
            </div>
            <div style={BODY}>{aiAnalysis.caseAssessment}</div>
          </div>
          {aiAnalysis.keyPatterns?.length > 0 && (
            <div>
              <div
                style={{
                  ...SECTION_TITLE,
                  color: "rgba(255,107,0,0.7)",
                  marginBottom: 6,
                }}
              >
                Key patterns
              </div>
              <ul style={{ ...BODY, paddingLeft: 16 }}>
                {aiAnalysis.keyPatterns.map((p, i) => (
                  <li key={i} style={{ listStyle: "disc" }}>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aiAnalysis.evidenceStrengths?.length > 0 && (
            <div>
              <div
                style={{
                  ...SECTION_TITLE,
                  color: "rgba(255,107,0,0.7)",
                  marginBottom: 6,
                }}
              >
                Evidence strengths
              </div>
              <ul style={{ ...BODY, paddingLeft: 16 }}>
                {aiAnalysis.evidenceStrengths.map((s, i) => (
                  <li key={i} style={{ listStyle: "disc" }}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aiAnalysis.openQuestions?.length > 0 && (
            <div>
              <div
                style={{
                  ...SECTION_TITLE,
                  color: "rgba(255,107,0,0.7)",
                  marginBottom: 6,
                }}
              >
                Open questions
              </div>
              <div className="flex flex-col gap-1">
                {aiAnalysis.openQuestions.map((q, i) => (
                  <div key={i} style={BODY}>
                    <span style={{ color: "#FF6B00", marginRight: 6 }}>?</span>
                    {q}
                  </div>
                ))}
              </div>
            </div>
          )}
          {aiAnalysis.nextSteps?.length > 0 && (
            <div>
              <div
                style={{
                  ...SECTION_TITLE,
                  color: "rgba(255,107,0,0.7)",
                  marginBottom: 6,
                }}
              >
                Next steps
              </div>
              <div className="flex flex-col gap-1">
                {aiAnalysis.nextSteps.map((s, i) => (
                  <div key={i} style={BODY}>
                    <span style={{ color: "#FF6B00", marginRight: 6 }}>→</span>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}
          {aiAnalysis.publishabilityNote && (
            <div>
              <div
                style={{
                  ...SECTION_TITLE,
                  color: "rgba(255,107,0,0.7)",
                  marginBottom: 6,
                }}
              >
                Publishability
              </div>
              <div style={BODY}>{aiAnalysis.publishabilityNote}</div>
            </div>
          )}
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              fontStyle: "italic",
            }}
          >
            Based on derived entities only. Raw files not accessed.
          </div>
          <div className="flex gap-3">
            <button
              onClick={generateAnalysis}
              style={{
                backgroundColor: "transparent",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                fontSize: 12,
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              Regenerate
            </button>
            <button
              onClick={copyAnalysis}
              style={{
                backgroundColor: "transparent",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                fontSize: 12,
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
